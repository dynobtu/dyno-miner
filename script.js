// ===============================
// 1. CONFIGURAÇÕES
// ===============================
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";

const tokenABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// ===============================
// 2. GPUS (VALORES CERTOS)
// ===============================
const gpus = [
  { id: 1, nome: "Dyno Normal", custo: 100, final: 105, img: "NORMAL.png", hash: 50 },
  { id: 2, nome: "Dyno Raro", custo: 200, final: 220, img: "RARO.png", hash: 100 },
  { id: 3, nome: "Dyno Épico", custo: 400, final: 460, img: "ÉPICO.png", hash: 200 },
  { id: 4, nome: "Dyno Lendário", custo: 800, final: 960, img: "LENDÁRIO.png", hash: 400 },
  { id: 5, nome: "Super Lendário", custo: 1600, final: 2000, img: "SUPER LENDÁRIO.png", hash: 800 }
];

let userAccount = null;
let purchasedDynos = {};
let miningLoop = null;
let isConnecting = false;

// ===============================
// 3. FUNÇÕES AUXILIARES
// ===============================
function formatTime(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getTotalHashrate() {
  let total = 0;
  for (const gpu of gpus) {
    if (purchasedDynos[gpu.id]) total += gpu.hash;
  }
  return total;
}

function updateHashrate() {
  const totalHash = getTotalHashrate();
  const el = document.getElementById("hashrate");
  if (el) el.innerText = totalHash.toString();
}

// ===============================
// 4. CALCULAR LUCRO REAL
// ===============================
function getLucroTotalPorDia() {
  let totalLucro = 0;

  for (const gpu of gpus) {
    if (purchasedDynos[gpu.id]) {
      const lucro = gpu.final - gpu.custo;
      totalLucro += lucro;
    }
  }

  return totalLucro;
}

function getLucroPorSegundo() {
  const lucroDia = getLucroTotalPorDia();
  if (lucroDia <= 0) return 0;

  return lucroDia / 86400;
}

// ===============================
// 5. BUSCAR COMPRAS DO SUPABASE
// ===============================
async function carregarDynosComprados() {
  if (!userAccount) return;

  const carteira = userAccount.toLowerCase();

  const { data, error } = await _supabase
    .from("dynos_comprados")
    .select("*")
    .eq("carteira", carteira);

  if (error) {
    console.error("Erro ao carregar dynos:", error);
    return;
  }

  purchasedDynos = {};

  if (data && data.length > 0) {
    for (const item of data) {
      purchasedDynos[item.dyno_id] = true;
    }
  }
}

// ===============================
// 6. SISTEMA DE INDICAÇÃO (REGISTRAR REF)
// ===============================
async function registrarIndicacaoSeExistir() {
  if (!userAccount) return;

  const carteira = userAccount.toLowerCase();

  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get("ref");

  if (!ref) return;
  if (ref.toLowerCase() === carteira) return;

  const { data: userData } = await _supabase
    .from("usuarios")
    .select("carteira, indicado_por")
    .eq("carteira", carteira)
    .maybeSingle();

  if (userData?.indicado_por) return;

  const { error: updateError } = await _supabase
    .from("usuarios")
    .update({ indicado_por: ref.toLowerCase() })
    .eq("carteira", carteira);

  if (updateError) {
    console.error("Erro ao salvar indicado_por:", updateError);
    return;
  }

  const { data: patrocinador } = await _supabase
    .from("usuarios")
    .select("ref_count")
    .eq("carteira", ref.toLowerCase())
    .maybeSingle();

  const atual = Number(patrocinador?.ref_count || 0);

  await _supabase
    .from("usuarios")
    .update({ ref_count: atual + 1 })
    .eq("carteira", ref.toLowerCase());
}

// ===============================
// 7. CRIAR OU BUSCAR USUÁRIO
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
        hash_rate: 0,
        mining_until: null,
        last_update: new Date().toISOString(),
        indicado_por: null
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
// 8. CONECTAR WALLET
// ===============================
async function connectWallet() {
  if (isConnecting) return;
  isConnecting = true;

  if (!window.ethereum) {
    isConnecting = false;
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
      isConnecting = false;
      return;
    }

    const inputRef = document.getElementById("refLink");
    if (inputRef) {
      inputRef.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
    }

    await getOrCreateUser();
    await registrarIndicacaoSeExistir();
    await carregarDynosComprados();

    await atualizarSaldo();
    await atualizarDadosUsuario();

    renderShop();
    updateHashrate();
    iniciarMineracaoLoop();

  } catch (e) {
    console.error(e);
    alert("Erro ao conectar carteira.");
  }

  isConnecting = false;
}

if (window.ethereum) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    if (accounts.length > 0) {
      userAccount = accounts[0];
      await atualizarSaldo();
      await atualizarDadosUsuario();
      await carregarDynosComprados();
      renderShop();
      updateHashrate();
    }
  });

  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
}

// ===============================
// 9. SALDO TOKEN
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
// 10. DADOS DO USUÁRIO
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
// 11. TIMER UI
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
// 12. LINK AFILIADO
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
// 13. RESGATAR COMISSÃO PARA SALDO MINERADO
// ===============================
async function resgatarComissaoParaSaldo() {
  if (!userAccount) return alert("Conecte a carteira!");

  const carteira = userAccount.toLowerCase();

  const { data, error } = await _supabase
    .from("usuarios")
    .select("saldo_minerado, ref_earnings")
    .eq("carteira", carteira)
    .single();

  if (error) {
    console.error(error);
    return alert("Erro ao buscar comissão.");
  }

  const minerado = Number(data.saldo_minerado || 0);
  const comissao = Number(data.ref_earnings || 0);

  if (comissao <= 0) {
    return alert("Você não tem comissão disponível.");
  }

  const novoSaldo = minerado + comissao;

  const { error: updateError } = await _supabase
    .from("usuarios")
    .update({
      saldo_minerado: novoSaldo,
      ref_earnings: 0
    })
    .eq("carteira", carteira);

  if (updateError) {
    console.error(updateError);
    return alert("Erro ao resgatar comissão.");
  }

  document.getElementById("visualGain").innerText = novoSaldo.toFixed(6);
  document.getElementById("refEarnings").innerText = "0.00";

  alert(`✅ Comissão de ${comissao.toFixed(2)} DYNO adicionada ao saldo minerado!`);
}

// ===============================
// 14. SAQUE (SOMA MINERAÇÃO + INDICAÇÃO + TAXA 5%)
// ===============================
async function solicitarSaque() {
  if (!userAccount) return alert("Conecte a carteira!");

  const carteira = userAccount.toLowerCase();

  const { data, error: saldoError } = await _supabase
    .from("usuarios")
    .select("saldo_minerado, ref_earnings")
    .eq("carteira", carteira)
    .single();

  if (saldoError) {
    console.error(saldoError);
    return alert("Erro ao buscar saldo.");
  }

  const saldoMinerado = Number(data?.saldo_minerado || 0);
  const saldoIndicacao = Number(data?.ref_earnings || 0);

  const saldoTotal = saldoMinerado + saldoIndicacao;

  if (saldoTotal < 100) {
    return alert("Saque mínimo: 100 $DYNO");
  }

  const taxa = saldoTotal * 0.05;
  const valorFinal = saldoTotal - taxa;

  const { error: insertError } = await _supabase
    .from("saques_pendentes")
    .insert([
      {
        carteira_usuario: carteira,
        valor_solicitado: saldoTotal,
        taxa: taxa,
        valor_final: valorFinal,
        status: "pendente"
      }
    ]);

  if (insertError) {
    console.error(insertError);
    return alert("Erro ao processar saque.");
  }

  const { error: updateError } = await _supabase
    .from("usuarios")
    .update({
      saldo_minerado: 0,
      ref_earnings: 0
    })
    .eq("carteira", carteira);

  if (updateError) {
    console.error(updateError);
    return alert("Erro ao zerar saldo após saque.");
  }

  document.getElementById("visualGain").innerText = "0.000000";
  document.getElementById("refEarnings").innerText = "0.00";

  alert(
    `✅ Saque solicitado!\n\n` +
    `💰 Total: ${saldoTotal.toFixed(2)} DYNO\n` +
    `💸 Taxa (5%): ${taxa.toFixed(2)} DYNO\n` +
    `🏦 Você recebe: ${valorFinal.toFixed(2)} DYNO\n\n` +
    `⏳ Prazo: 24 a 72 horas`
  );
}

// ===============================
// 15. PAGAR COMISSÃO DE INDICAÇÃO (10%)
// ===============================
async function pagarComissaoIndicacao(valorCompra, comprador) {
  try {
    const { data: compradorData, error } = await _supabase
      .from("usuarios")
      .select("indicado_por")
      .eq("carteira", comprador)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar indicado_por:", error);
      return;
    }

    const patrocinador = compradorData?.indicado_por;
    if (!patrocinador) return;

    const comissao = valorCompra * 0.10;

    const { data: sponsorData } = await _supabase
      .from("usuarios")
      .select("ref_earnings")
      .eq("carteira", patrocinador)
      .maybeSingle();

    const atual = Number(sponsorData?.ref_earnings || 0);
    const novo = atual + comissao;

    await _supabase
      .from("usuarios")
      .update({ ref_earnings: novo })
      .eq("carteira", patrocinador);

    await _supabase
      .from("ref_comissoes")
      .insert([
        {
          patrocinador: patrocinador,
          indicado: comprador,
          valor_compra: valorCompra,
          comissao: comissao
        }
      ]);

  } catch (err) {
    console.error("Erro pagarComissaoIndicacao:", err);
  }
}

// ===============================
// 16. COMPRAR GPU (SALVA NO SUPABASE + PAGA INDICAÇÃO)
// ===============================
async function buyGPU(i) {
  if (!userAccount) return alert("Conecte a carteira!");

  const carteira = userAccount.toLowerCase();

  if (purchasedDynos[gpus[i].id]) {
    return alert("Você já possui esse Dyno!");
  }

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

    const { error: insertError } = await _supabase
      .from("dynos_comprados")
      .insert([
        {
          carteira: carteira,
          dyno_id: gpus[i].id
        }
      ]);

    if (insertError) {
      console.error(insertError);
      return alert("Erro ao salvar compra no servidor.");
    }

    await pagarComissaoIndicacao(gpus[i].custo, carteira);

    await carregarDynosComprados();
    await atualizarDadosUsuario();

    renderShop();
    updateHashrate();
    await atualizarSaldo();

    alert("✅ Compra concluída!");

  } catch (e) {
    console.error(e);
    alert("❌ Erro na compra. Verifique saldo e se está na rede BSC.");
  }
}

// ===============================
// 17. RENDER SHOP
// ===============================
function renderShop() {
  const grid = document.getElementById("gpu-grid");
  if (!grid) return;

  grid.innerHTML = gpus.map((g, i) => {
    const dono = purchasedDynos[g.id];

    return `
      <div class="gpu-item">
        <span class="badge-profit">FINAL: ${g.final}</span>
        <img src="${g.img}" alt="${g.nome}">
        <h4>${g.nome}</h4>
        <p style="font-size:0.8rem; margin: 5px 0;">CUSTO: ${g.custo} DYNO</p>
        <p style="font-size:0.75rem; opacity:0.7;">RETORNO: ${g.final} DYNO</p>
        <button onclick="buyGPU(${i})" ${dono ? "disabled" : ""}>
          ${dono ? "LOCKED" : "ADQUIRIR"}
        </button>
      </div>
    `;
  }).join("");
}

// ===============================
// 18. MINERAÇÃO OFFLINE REAL
// ===============================
async function activateMining() {
  if (!userAccount) return alert("Conecte a carteira!");

  const carteira = userAccount.toLowerCase();

  await carregarDynosComprados();

  const lucroDia = getLucroTotalPorDia();
  if (lucroDia <= 0) {
    return alert("⚠️ Você precisa comprar um Dyno antes de minerar!");
  }

  const agora = new Date();
  const fim = new Date(Date.now() + 86400000);

  const { error } = await _supabase
    .from("usuarios")
    .update({
      mining_until: fim.toISOString(),
      last_update: agora.toISOString(),
      hash_rate: getTotalHashrate()
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

async function calcularMineracaoOffline() {
  if (!userAccount) return;

  const carteira = userAccount.toLowerCase();

  await carregarDynosComprados();

  const {_toggle = await _supabase
    .from("usuarios")
    .select("*")
    .eq("carteira", carteira)
    .single();

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

  if (agora <= lastUpdate) return;

  const limite = Math.min(agora, miningUntil);
  const segundos = Math.floor((limite - lastUpdate) / 1000);

  if (segundos <= 0) return;

  const lucroPorSegundo = getLucroPorSegundo();
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

function iniciarMineracaoLoop() {
  if (miningLoop) clearInterval(miningLoop);

  miningLoop = setInterval(async () => {
    await calcularMineracaoOffline();
    await atualizarDadosUsuario();

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
// 19. INIT
// ===============================
window.onload = async () => {
  renderShop();
  updateHashrate();
};









