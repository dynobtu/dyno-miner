// ===============================
// 1. CONFIGURAÇÕES
// ===============================
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";

const PANCAKE_LINK = "https://pancakeswap.finance/swap?chain=bsc&inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";

const tokenABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// ===============================
// 2. DYNOS (COM SEU LUCRO REAL)
// ===============================
const gpus = [
  { id: 1, nome: "Dyno Normal", custo: 100, retornoFinal: 105, img: "NORMAL.png" },
  { id: 2, nome: "Dyno Raro", custo: 200, retornoFinal: 220, img: "RARO.png" },
  { id: 3, nome: "Dyno Épico", custo: 400, retornoFinal: 460, img: "ÉPICO.png" },
  { id: 4, nome: "Dyno Lendário", custo: 800, retornoFinal: 960, img: "LENDÁRIO.png" },
  { id: 5, nome: "Super Lendário", custo: 1600, retornoFinal: 2000, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null;
let purchaseHistory = JSON.parse(localStorage.getItem("dyno_purchases")) || {};
let miningLoop = null;

// ===============================
// 3. FUNÇÕES AUXILIARES
// ===============================
function formatTime(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getTotalDynos() {
  let total = 0;
  for (const gpu of gpus) {
    if (purchaseHistory[gpu.id]) total++;
  }
  return total;
}

function updateHashrateUI() {
  const el = document.getElementById("hashrate");
  if (!el) return;

  const dynos = getTotalDynos();
  el.innerText = dynos > 0 ? `${dynos}` : "0";
}

function setPancakeButton() {
  const btn = document.getElementById("btnObterDyno");
  if (btn) btn.href = PANCAKE_LINK;
}

// ===============================
// 4. CALCULAR GANHO POR SEGUNDO
// (RETORNO FINAL - CUSTO) / 10 DIAS
// ===============================
function calcularLucroPorSegundo() {
  let lucroPorDia = 0;

  for (const gpu of gpus) {
    if (purchaseHistory[gpu.id]) {
      const lucroTotal = gpu.retornoFinal - gpu.custo; // Ex: 105 - 100 = 5
      const lucroDiario = lucroTotal / 10; // em 10 dias
      lucroPorDia += lucroDiario;
    }
  }

  if (lucroPorDia <= 0) return 0;

  const lucroPorSegundo = lucroPorDia / 86400;
  return lucroPorSegundo;
}

// ===============================
// 5. CRIAR OU BUSCAR USUÁRIO
// ===============================
async function getOrCreateUser() {
  if (!userAccount) return null;

  const carteira = userAccount.toLowerCase();

  const { data, error } = await _supabase
    .from("usuarios")
    .select("*")
    .eq("carteira", carteira)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar usuário:", error);
    return null;
  }

  if (data) return data;

  const { data: inserted, error: insertError } = await _supabase
    .from("usuarios")
    .insert([
      {
        carteira: carteira,
        saldo_minerado: 0,
        ref_count: 0,
        ref_earnings: 0,
        mining_until: null,
        last_update: new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (insertError) {
    console.error("Erro ao criar usuário:", insertError);
    return null;
  }

  return inserted;
}

// ===============================
// 6. CONECTAR WALLET
// ===============================
async function connectWallet() {
  if (!window.ethereum) {
    return alert("Metamask não detectada!");
  }

  try {
    const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
    userAccount = accs[0];

    document.getElementById("walletDisplay").innerText =
      userAccount.substring(0, 6) + "..." + userAccount.substring(userAccount.length - 4);

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const network = await provider.getNetwork();

    if (network.chainId !== 56) {
      alert("⚠️ Conecte na rede Binance Smart Chain (BSC)!");
      return;
    }

    // gerar link afiliado
    const inputRef = document.getElementById("refLink");
    if (inputRef) {
      inputRef.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
    }

    await getOrCreateUser();
    await registrarReferencia();
    await atualizarSaldo();
    await atualizarDadosUsuario();

    renderShop();
    updateHashrateUI();

    iniciarMineracaoLoop();

  } catch (e) {
    console.error(e);
    alert("Erro ao conectar carteira.");
  }
}

// Atualiza ao trocar de conta
if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length > 0) {
      userAccount = accounts[0];
      connectWallet();
    }
  });

  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
}

// ===============================
// 7. SALDO TOKEN NA WALLET
// ===============================
async function atualizarSaldo() {
  if (!userAccount) return;

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(tokenAddr, tokenABI, provider);

    const balance = await contract.balanceOf(userAccount);
    const dec = await contract.decimals();

    const formatted = ethers.utils.formatUnits(balance, dec);
    document.getElementById("walletBalance").innerText = parseFloat(formatted).toFixed(2);

  } catch (e) {
    console.error("Erro ao atualizar saldo:", e);
  }
}

// ===============================
// 8. DADOS DO USUÁRIO
// ===============================
async function atualizarDadosUsuario() {
  if (!userAccount) return;

  const carteira = userAccount.toLowerCase();

  const { data, error } = await _supabase
    .from("usuarios")
    .select("*")
    .eq("carteira", carteira)
    .maybeSingle();

  if (error || !data) {
    console.error("Erro ao atualizar dados usuário:", error);
    return;
  }

  document.getElementById("visualGain").innerText = Number(data.saldo_minerado || 0).toFixed(6);
  document.getElementById("refCount").innerText = data.ref_count || 0;
  document.getElementById("refEarnings").innerText = Number(data.ref_earnings || 0).toFixed(2);

  updateTimerUI(data.mining_until);
}

// ===============================
// 9. TIMER UI
// ===============================
function updateTimerUI(miningUntil) {
  const btn = document.getElementById("btnActivate");
  const timerEl = document.getElementById("activationTimer");

  if (!miningUntil) {
    if (timerEl) timerEl.innerText = "00:00:00";
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
    return;
  }

  const fim = new Date(miningUntil).getTime();
  const agora = Date.now();

  if (agora >= fim) {
    if (timerEl) timerEl.innerText = "00:00:00";
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  } else {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
    }
  }
}

// ===============================
// 10. LINK AFILIADO
// ===============================
function copyRefLink() {
  const input = document.getElementById("refLink");

  if (!input || !input.value || input.value.includes("Conecte")) {
    return alert("Conecte a carteira para gerar seu link!");
  }

  navigator.clipboard.writeText(input.value);
  alert("✅ Link de Afiliado Copiado!");
}

// ===============================
// 11. SAQUE
// ===============================
async function solicitarSaque() {
  if (!userAccount) return alert("Conecte a carteira!");

  const carteira = userAccount.toLowerCase();

  const { data } = await _supabase
    .from("usuarios")
    .select("saldo_minerado")
    .eq("carteira", carteira)
    .single();

  const saldoAtual = Number(data?.saldo_minerado || 0);

  if (saldoAtual < 100) return alert("Saque mínimo: 100 $DYNO");

  const { error } = await _supabase.from("saques_pendentes").insert([
    {
      carteira: carteira,
      valor: saldoAtual
    }
  ]);

  if (!error) {
    await _supabase
      .from("usuarios")
      .update({ saldo_minerado: 0 })
      .eq("carteira", carteira);

    document.getElementById("visualGain").innerText = "0.000000";
    alert("✅ Saque solicitado com sucesso!");
  } else {
    console.error(error);
    alert("Erro ao processar saque.");
  }
}

// ===============================
// 12. COMPRAR DYNO
// ===============================
async function buyGPU(i) {
  if (!userAccount) return alert("Conecte a carteira!");

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(tokenAddr, tokenABI, signer);

    const dec = await contract.decimals();

    const tx = await contract.transfer(
      receptor,
      ethers.utils.parseUnits(gpus[i].custo.toString(), dec)
    );

    await tx.wait();

    purchaseHistory[gpus[i].id] = Date.now();
    localStorage.setItem("dyno_purchases", JSON.stringify(purchaseHistory));

    renderShop();
    updateHashrateUI();
    await atualizarSaldo();

    alert("✅ Compra concluída!");

  } catch (e) {
    console.error(e);
    alert("❌ Erro na compra. Verifique saldo e se está na rede BSC.");
  }
}

// ===============================
// 13. RENDER SHOP
// ===============================
function renderShop() {
  const grid = document.getElementById("gpu-grid");
  if (!grid) return;

  grid.innerHTML = gpus.map((g, i) => {
    const dono = purchaseHistory[g.id];

    const lucroTotal = g.retornoFinal - g.custo;
    const lucroPorDia = lucroTotal / 10;

    return `
      <div class="gpu-item">
        <span class="badge-profit">+${lucroTotal} DYNO</span>
        <img src="${g.img}" alt="${g.nome}">
        <h4>${g.nome}</h4>
        <p style="font-size:0.8rem; margin: 5px 0;">CUSTO: ${g.custo} DYNO</p>
        <p style="font-size:0.75rem; opacity:0.7;">RETORNO FINAL: ${g.retornoFinal} DYNO</p>
        <p style="font-size:0.75rem; opacity:0.7;">LUCRO/DIA: ${lucroPorDia.toFixed(2)} DYNO</p>

        <button onclick="buyGPU(${i})" ${dono ? "disabled" : ""}>
          ${dono ? "LOCKED" : "ADQUIRIR"}
        </button>
      </div>
    `;
  }).join("");
}

// ===============================
// 14. ATIVAR MINERAÇÃO (24H)
// ===============================
async function activateMining() {
  if (!userAccount) return alert("Conecte a carteira!");

  if (getTotalDynos() <= 0) {
    return alert("❌ Você precisa comprar pelo menos 1 Dyno para minerar!");
  }

  const carteira = userAccount.toLowerCase();

  const { data } = await _supabase
    .from("usuarios")
    .select("mining_until")
    .eq("carteira", carteira)
    .single();

  const miningUntilAtual = data?.mining_until ? new Date(data.mining_until).getTime() : 0;

  if (Date.now() < miningUntilAtual) {
    return alert("⚠️ Sua mineração ainda está ativa. Aguarde terminar as 24 horas.");
  }

  const agora = new Date();
  const fim = new Date(Date.now() + 86400000);

  const { error } = await _supabase
    .from("usuarios")
    .update({
      mining_until: fim.toISOString(),
      last_update: agora.toISOString()
    })
    .eq("carteira", carteira);

  if (error) {
    console.error(error);
    return alert("Erro ao ativar mineração.");
  }

  alert("✅ Mineração ativada por 24 horas!");
  await atualizarDadosUsuario();
  iniciarMineracaoLoop();
}

// ===============================
// 15. MINERAÇÃO OFFLINE REAL
// ===============================
async function calcularMineracaoOffline() {
  if (!userAccount) return;

  if (getTotalDynos() <= 0) return; // sem dyno = sem lucro

  const carteira = userAccount.toLowerCase();

  const { data, error } = await _supabase
    .from("usuarios")
    .select("*")
    .eq("carteira", carteira)
    .single();

  if (error || !data) return;

  if (!data.mining_until || !data.last_update) return;

  const agora = Date.now();
  const miningUntil = new Date(data.mining_until).getTime();
  const lastUpdate = new Date(data.last_update).getTime();

  // se já acabou mineração, não minera mais
  if (agora > miningUntil && lastUpdate >= miningUntil) return;

  const limite = Math.min(agora, miningUntil);
  const segundos = Math.floor((limite - lastUpdate) / 1000);

  if (segundos <= 0) return;

  const lucroPorSegundo = calcularLucroPorSegundo();
  if (lucroPorSegundo <= 0) return;

  const ganho = segundos * lucroPorSegundo;
  const novoSaldo = Number(data.saldo_minerado || 0) + ganho;

  const { error: updateError } = await _supabase
    .from("usuarios")
    .update({
      saldo_minerado: novoSaldo,
      last_update: new Date(limite).toISOString()
    })
    .eq("carteira", carteira);

  if (updateError) {
    console.error(updateError);
    return;
  }

  document.getElementById("visualGain").innerText = novoSaldo.toFixed(6);
}

// ===============================
// 16. LOOP TIMER + MINERAÇÃO
// ===============================
function iniciarMineracaoLoop() {
  if (miningLoop) clearInterval(miningLoop);

  miningLoop = setInterval(async () => {
    await calcularMineracaoOffline();
    await atualizarDadosUsuario();

    if (!userAccount) return;

    const { data } = await _supabase
      .from("usuarios")
      .select("mining_until")
      .eq("carteira", userAccount.toLowerCase())
      .single();

    if (!data?.mining_until) return;

    const fim = new Date(data.mining_until).getTime();
    const agora = Date.now();
    const restante = fim - agora;

    const timerEl = document.getElementById("activationTimer");
    if (timerEl) {
      timerEl.innerText = restante > 0 ? formatTime(restante) : "00:00:00";
    }

    const btn = document.getElementById("btnActivate");
    if (btn) {
      if (restante > 0) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
      } else {
        btn.disabled = false;
        btn.style.opacity = "1";
      }
    }

  }, 2000);
}

// ===============================
// 17. AFILIADOS (REGISTRAR REF)
// ===============================
async function registrarReferencia() {
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get("ref");

  if (!ref) return;
  if (!userAccount) return;

  const carteira = userAccount.toLowerCase();

  if (ref.toLowerCase() === carteira) return;

  const jaRegistrado = localStorage.getItem("ref_registrado");
  if (jaRegistrado === "1") return;

  const { data: donoRef } = await _supabase
    .from("usuarios")
    .select("*")
    .eq("carteira", ref.toLowerCase())
    .maybeSingle();

  if (!donoRef) return;

  await _supabase
    .from("usuarios")
    .update({
      ref_count: Number(donoRef.ref_count || 0) + 1
    })
    .eq("carteira", ref.toLowerCase());

  localStorage.setItem("ref_registrado", "1");
}

// ===============================
// 18. INIT
// ===============================
window.onload = () => {
  setPancakeButton();
  renderShop();
  updateHashrateUI();
};
