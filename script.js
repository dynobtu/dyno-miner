/* ===============================
   CONFIG SUPABASE
================================ */
const SUPABASE_URL = "COLOQUE_AQUI_SUA_URL";
const SUPABASE_KEY = "COLOQUE_AQUI_SUA_ANON_KEY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ===============================
   VARIÁVEIS GERAIS
================================ */
let walletAddress = null;
let miningInterval = null;
let usuarioAtual = null;

/* ===============================
   MATRIX EFFECT
================================ */
function startMatrixEffect() {
  const canvas = document.getElementById("matrixCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = 160;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$DYNO";
  const fontSize = 14;
  let columns = Math.floor(canvas.width / fontSize);
  let drops = Array(columns).fill(1);

  function draw() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#00ff66";
    ctx.font = fontSize + "px Courier New";

    for (let i = 0; i < drops.length; i++) {
      const text = letters.charAt(Math.floor(Math.random() * letters.length));
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);

      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }

      drops[i]++;
    }
  }

  setInterval(draw, 35);
}

/* ===============================
   FUNÇÃO: CONECTAR WALLET
================================ */
async function connectWallet() {
  try {
    if (!window.ethereum) {
      alert("MetaMask não encontrada!");
      return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    walletAddress = accounts[0];

    document.getElementById("walletDisplay").innerText =
      walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);

    // atualizar link de indicação
    const refLink = `${window.location.origin}?ref=${walletAddress}`;
    document.getElementById("refLink").value = refLink;

    // carregar dados supabase
    await carregarUsuario(walletAddress);

    // atualizar saldo da carteira
    await atualizarSaldoCarteira();

  } catch (err) {
    console.error(err);
    alert("Erro ao conectar carteira.");
  }
}

/* ===============================
   CARREGAR / CRIAR USUÁRIO
================================ */
async function carregarUsuario(wallet) {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("wallet", wallet)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error(error);
      return;
    }

    if (!data) {
      const ref = new URLSearchParams(window.location.search).get("ref");

      const novo = {
        wallet: wallet,
        saldo: 0,
        hash_rate: 50,
        mining_until: null,
        last_update: new Date().toISOString(),
        ref_by: ref ? ref : null,
        ref_count: 0,
        ref_earnings: 0
      };

      const { data: inserted, error: insertError } = await supabase
        .from("usuarios")
        .insert([novo])
        .select()
        .single();

      if (insertError) {
        console.error(insertError);
        return;
      }

      usuarioAtual = inserted;

      // se veio ref, incrementa contador do referenciador
      if (ref) {
        await supabase.rpc("increment_ref_count", { ref_wallet: ref });
      }

    } else {
      usuarioAtual = data;
    }

    atualizarInterface();

  } catch (err) {
    console.error(err);
  }
}

/* ===============================
   ATUALIZAR INTERFACE
================================ */
function atualizarInterface() {
  if (!usuarioAtual) return;

  document.getElementById("visualGain").innerText = Number(usuarioAtual.saldo).toFixed(6);
  document.getElementById("hashrate").innerText = Number(usuarioAtual.hash_rate || 0).toFixed(0);

  document.getElementById("refCount").innerText = usuarioAtual.ref_count || 0;
  document.getElementById("refEarnings").innerText = Number(usuarioAtual.ref_earnings || 0).toFixed(2);

  atualizarTimer();
}

/* ===============================
   TIMER DE REATIVAÇÃO
================================ */
function atualizarTimer() {
  const timerEl = document.getElementById("activationTimer");
  const btnActivate = document.getElementById("btnActivate");

  if (!usuarioAtual || !usuarioAtual.mining_until) {
    timerEl.innerText = "00:00:00";
    btnActivate.disabled = false;
    return;
  }

  const miningUntil = new Date(usuarioAtual.mining_until).getTime();
  const agora = Date.now();

  if (agora >= miningUntil) {
    timerEl.innerText = "00:00:00";
    btnActivate.disabled = false;
    return;
  }

  btnActivate.disabled = true;

  const diff = miningUntil - agora;

  const horas = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
  const minutos = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, "0");
  const segundos = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");

  timerEl.innerText = `${horas}:${minutos}:${segundos}`;
}

/* ===============================
   ATIVAR MINERAÇÃO (24H)
================================ */
async function activateMining() {
  if (!usuarioAtual) {
    alert("Conecte a carteira primeiro!");
    return;
  }

  const agora = new Date();
  const miningUntil = new Date(agora.getTime() + 24 * 60 * 60 * 1000);

  // atualizar no banco
  const { error } = await supabase
    .from("usuarios")
    .update({
      mining_until: miningUntil.toISOString(),
      last_update: agora.toISOString()
    })
    .eq("wallet", walletAddress);

  if (error) {
    console.error(error);
    alert("Erro ao ativar mineração.");
    return;
  }

  usuarioAtual.mining_until = miningUntil.toISOString();
  usuarioAtual.last_update = agora.toISOString();

  atualizarInterface();

  alert("Mineração ativada por 24H!");
}

/* ===============================
   MINERAÇÃO OFFLINE / ONLINE
================================ */
async function processarMineracaoOffline() {
  if (!usuarioAtual) return;
  if (!usuarioAtual.mining_until) return;

  const agora = Date.now();
  const miningUntil = new Date(usuarioAtual.mining_until).getTime();

  if (agora > miningUntil) {
    // mineração expirou
    return;
  }

  const lastUpdate = usuarioAtual.last_update
    ? new Date(usuarioAtual.last_update).getTime()
    : Date.now();

  let diffSegundos = Math.floor((agora - lastUpdate) / 1000);

  if (diffSegundos <= 0) return;

  // mineração por segundo baseada no hash_rate
  // (mantendo lógica que vocês já usaram antes)
  const ganhoPorSegundo = (usuarioAtual.hash_rate || 50) / 100000;

  const ganho = diffSegundos * ganhoPorSegundo;

  usuarioAtual.saldo = Number(usuarioAtual.saldo) + ganho;
  usuarioAtual.last_update = new Date().toISOString();

  // atualizar supabase
  await supabase
    .from("usuarios")
    .update({
      saldo: usuarioAtual.saldo,
      last_update: usuarioAtual.last_update
    })
    .eq("wallet", walletAddress);

  atualizarInterface();
}

/* ===============================
   LOOP VISUAL AO VIVO
================================ */
function startMiningLoop() {
  if (miningInterval) clearInterval(miningInterval);

  miningInterval = setInterval(async () => {
    if (!usuarioAtual) return;
    await processarMineracaoOffline();
    atualizarTimer();
  }, 5000);
}

/* ===============================
   SALDO EM CARTEIRA (TOKEN DYNO)
================================ */
async function atualizarSaldoCarteira() {
  try {
    if (!walletAddress) return;
    if (!window.ethereum) return;

    const provider = new ethers.providers.Web3Provider(window.ethereum);

    const DYNO_CONTRACT = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";

    const abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];

    const contract = new ethers.Contract(DYNO_CONTRACT, abi, provider);

    const balanceRaw = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();

    const balance = ethers.utils.formatUnits(balanceRaw, decimals);

    document.getElementById("walletBalance").innerText = Number(balance).toFixed(2);

  } catch (err) {
    console.error(err);
    document.getElementById("walletBalance").innerText = "0.00";
  }
}

/* ===============================
   COPIAR LINK INDICAÇÃO
================================ */
function copyRefLink() {
  const input = document.getElementById("refLink");
  input.select();
  input.setSelectionRange(0, 99999);

  document.execCommand("copy");

  alert("Link de indicação copiado!");
}

/* ===============================
   SOLICITAR SAQUE
================================ */
async function solicitarSaque() {
  if (!usuarioAtual) {
    alert("Conecte a carteira primeiro!");
    return;
  }

  if (usuarioAtual.saldo < 100) {
    alert("Saque mínimo: 100 DYNO");
    return;
  }

  alert("Solicitação enviada! (implementar backend/contrato)");
}

/* ===============================
   INICIAR AO ABRIR O SITE
================================ */
window.addEventListener("load", () => {
  startMatrixEffect();
  setInterval(atualizarTimer, 1000);
  startMiningLoop();
});
