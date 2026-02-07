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

const gpus = [
  { id: 1, nome: "Dyno Normal", custo: "100", lucro: 5, img: "NORMAL.png", hash: 50 },
  { id: 2, nome: "Dyno Raro", custo: "200", lucro: 10, img: "RARO.png", hash: 100 },
  { id: 3, nome: "Dyno Épico", custo: "400", lucro: 15, img: "ÉPICO.png", hash: 200 },
  { id: 4, nome: "Dyno Lendário", custo: "800", lucro: 20, img: "LENDÁRIO.png", hash: 400 },
  { id: 5, nome: "Super Lendário", custo: "1600", lucro: 25, img: "SUPER LENDÁRIO.png", hash: 800 }
];

let userAccount = null;
let purchaseHistory = JSON.parse(localStorage.getItem("dyno_purchases")) || {};

// ===============================
// 2. FUNÇÕES AUXILIARES
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
    if (purchaseHistory[gpu.id]) total += gpu.hash;
  }
  return total;
}

function updateHashrate() {
  const totalHash = getTotalHashrate();
  const el = document.getElementById("hashrate");
  if (el) el.innerText = totalHash.toString();
}

async function criarUsuarioSeNaoExistir() {
  if (!userAccount) return;

  const carteira = userAccount.toLowerCase();

  const { data } = await _supabase
    .from("usuarios")
    .select("carteira")
    .eq("carteira", carteira)
    .single();

  if (!data) {
    await _supabase.from("usuarios").insert([
      {
        carteira: carteira,
        saldo_minerado: 0,
        ref_count: 0,
        ref_earnings: 0,
        hash_rate: 50
      }
    ]);
  }
}

// ===============================
// 3. CONECTAR WALLET + REDE
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

    await criarUsuarioSeNaoExistir();

    // link afiliado
    const inputRef = document.getElementById("refLink");
    if (inputRef) {
      inputRef.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
    }

    await atualizarSaldo();
    await atualizarSaldoMineradoSupabase();
    await atualizarAfiliados();

    renderShop();
    updateHashrate();

    iniciarMineracao();

  } catch (e) {
    console.error(e);
    alert("Erro ao conectar carteira.");
  }
}

// Atualiza ao trocar conta
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
// 4. SALDO TOKEN (CARTEIRA)
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
// 5. LINK AFILIADO
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
// 6. ATUALIZAR SALDO MINERADO DO SUPABASE
// ===============================
async function atualizarSaldoMineradoSupabase() {
  if (!userAccount) return;

  const { data, error } = await _supabase
    .from("usuarios")
    .select("saldo_minerado")
    .eq("carteira", userAccount.toLowerCase())
    .single();

  if (!error && data) {
    document.getElementById("visualGain").innerText =
      (parseFloat(data.saldo_minerado) || 0).toFixed(6);
  }
}

// ===============================
// 7. AFILIADOS
// ===============================
async function atualizarAfiliados() {
  if (!userAccount) return;

  const { data, error } = await _supabase
    .from("usuarios")
    .select("ref_count, ref_earnings")
    .eq("carteira", userAccount.toLowerCase())
    .single();

  if (!error && data) {
    document.getElementById("refCount").innerText = data.ref_count || 0;
    document.getElementById("refEarnings").innerText = (data.ref_earnings || 0).toFixed(2);
  }
}

// ===============================
// 8. SAQUE
// ===============================
async function solicitarSaque() {
  if (!userAccount) return alert("Conecte a carteira!");

  const { data, error } = await _supabase
    .from("usuarios")
    .select("saldo_minerado")
    .eq("carteira", userAccount.toLowerCase())
    .single();

  if (error || !data) {
    return alert("Erro ao buscar saldo.");
  }

  const saldoAtual = parseFloat(data.saldo_minerado) || 0;

  if (saldoAtual < 100) return alert("Saque mínimo: 100 $DYNO");

  const { error: err2 } = await _supabase.from("saques_pendentes").insert([
    {
      carteira: userAccount.toLowerCase(),
      valor: saldoAtual
    }
  ]);

  if (!err2) {
    await _supabase
      .from("usuarios")
      .update({ saldo_minerado: 0 })
      .eq("carteira", userAccount.toLowerCase());

    document.getElementById("visualGain").innerText = "0.000000";
    alert("✅ Saque solicitado com sucesso!");
  } else {
    console.error(err2);
    alert("Erro ao processar saque.");
  }
}

// ===============================
// 9. COMPRAR GPU
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
      ethers.utils.parseUnits(gpus[i].custo, dec)
    );

    await tx.wait();

    purchaseHistory[gpus[i].id] = Date.now();
    localStorage.setItem("dyno_purchases", JSON.stringify(purchaseHistory));

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
// 10. RENDER SHOP
// ===============================
function renderShop() {
  const grid = document.getElementById("gpu-grid");
  if (!grid) return;

  grid.innerHTML = gpus.map((g, i) => {
    const dono = purchaseHistory[g.id];

    return `
      <div class="gpu-item">
        <span class="badge-profit">+${g.lucro}%</span>
        <img src="${g.img}" alt="${g.nome}">
        <h4>${g.nome}</h4>
        <p style="font-size:0.8rem; margin: 5px 0;">CUSTO: ${g.custo} DYNO</p>
        <p style="font-size:0.75rem; opacity:0.7;">HASH: ${g.hash} H/s</p>

        <button onclick="buyGPU(${i})" ${dono ? "disabled" : ""}>
          ${dono ? "LOCKED" : "ADQUIRIR"}
        </button>
      </div>
    `;
  }).join("");
}

// ===============================
// 11. MINERAÇÃO 24H OFFLINE REAL (SUPABASE)
// ===============================
async function activateMining() {
  if (!userAccount) return alert("Conecte a carteira!");

  const hashrate = getTotalHashrate();
  if (hashrate <= 0) return alert("Você precisa comprar pelo menos 1 minerador!");

  const agora = new Date();
  const miningUntil = new Date(Date.now() + 86400000);

  const { error } = await _supabase
    .from("usuarios")
    .update({
      mining_until: miningUntil.toISOString(),
      last_update: agora.toISOString(),
      hash_rate: hashrate
    })
    .eq("carteira", userAccount.toLowerCase());

  if (error) {
    console.error(error);
    return alert("Erro ao ativar mineração.");
  }

  alert("✅ Mineração ativada por 24 horas!");
  iniciarMineracao();
}

async function iniciarMineracao() {
  if (!userAccount) return;

  const btn = document.getElementById("btnActivate");
  const timerEl = document.getElementById("activationTimer");

  const { data, error } = await _supabase
    .from("usuarios")
    .select("saldo_minerado, mining_until, last_update, hash_rate")
    .eq("carteira", userAccount.toLowerCase())
    .single();

  if (error || !data) {
    console.error(error);
    return;
  }

  if (!data.mining_until || !data.last_update) {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
    if (timerEl) timerEl.innerText = "00:00:00";
    return;
  }

  let saldoMinerado = parseFloat(data.saldo_minerado) || 0;
  let lastUpdate = new Date(data.last_update).getTime();
  const miningUntil = new Date(data.mining_until).getTime();
  const hashrate = parseFloat(data.hash_rate) || getTotalHashrate();

  const lucroPorSegundo = hashrate > 0 ? (hashrate * 0.0000001) : 0.00001;

  if (btn) {
    btn.disabled = true;
    btn.style.opacity = "0.5";
  }

  async function loop() {
    const agora = Date.now();

    if (agora >= miningUntil) {
      const tempoFinal = Math.floor((miningUntil - lastUpdate) / 1000);
      if (tempoFinal > 0) {
        saldoMinerado += tempoFinal * lucroPorSegundo;
      }

      await _supabase
        .from("usuarios")
        .update({
          saldo_minerado: saldoMinerado,
          last_update: new Date(miningUntil).toISOString()
        })
        .eq("carteira", userAccount.toLowerCase());

      document.getElementById("visualGain").innerText = saldoMinerado.toFixed(6);

      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
      }

      if (timerEl) timerEl.innerText = "00:00:00";
      return;
    }

    const tempoPassado = Math.floor((agora - lastUpdate) / 1000);

    if (tempoPassado > 0) {
      saldoMinerado += tempoPassado * lucroPorSegundo;
      lastUpdate = agora;

      await _supabase
        .from("usuarios")
        .update({
          saldo_minerado: saldoMinerado,
          last_update: new Date(agora).toISOString()
        })
        .eq("carteira", userAccount.toLowerCase());
    }

    const restante = miningUntil - agora;
    if (timerEl) timerEl.innerText = formatTime(restante);

    document.getElementById("visualGain").innerText = saldoMinerado.toFixed(6);

    setTimeout(loop, 10000);
  }

  loop();
}

// ===============================
// 12. INIT
// ===============================
window.onload = () => {
  renderShop();
  updateHashrate();
};
