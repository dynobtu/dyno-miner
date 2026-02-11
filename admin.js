// ===============================
// CONFIG SUPABASE
// ===============================
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===============================
// CONFIG TOKEN
// ===============================
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";

const tokenABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function decimals() view returns (uint8)"
];

// ===============================
// CARTEIRA ADMIN (SUA CARTEIRA)
// ===============================
const ADMIN_WALLET = "0xe097661503B830ae10e91b01885a4b767A0e9107".toLowerCase();

// ===============================
// CHAVE SECRETA DO ADMIN (MUDE ISSO)
// ===============================
const ADMIN_KEY = "dyno123";

let adminAccount = null;
let pagandoAgora = false;

// ===============================
// MATRIX NO TOPO
// ===============================
function startMatrixEffect() {
  const canvas = document.getElementById("matrixCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = 160;
  }

  resize();
  window.addEventListener("resize", resize);

  const letters = "$DYNO0123456789";
  const fontSize = 16;
  const columns = Math.floor(canvas.width / fontSize);

  const drops = [];
  for (let i = 0; i < columns; i++) {
    drops[i] = Math.random() * canvas.height;
  }

  function draw() {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
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

  setInterval(draw, 40);
}

// ===============================
// PROTEÇÃO POR URL KEY
// ===============================
function verificarChaveAdmin() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("key");

  if (!key || key !== ADMIN_KEY) {
    document.body.innerHTML = `
      <div style="color:#00ff66; text-align:center; padding:50px; font-family:monospace;">
        <h1>❌ ACESSO NEGADO</h1>
        <p>Chave inválida.</p>
      </div>
    `;
    return false;
  }

  return true;
}

// ===============================
// CONECTAR WALLET ADMIN
// ===============================
async function connectAdminWallet() {
  if (!window.ethereum) {
    return alert("Metamask não detectada!");
  }

  try {
    const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
    adminAccount = accs[0];

    document.getElementById("adminWalletDisplay").innerText =
      adminAccount.substring(0, 6) + "..." + adminAccount.substring(adminAccount.length - 4);

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const network = await provider.getNetwork();

    if (network.chainId !== 56) {
      alert("⚠️ Conecte na Binance Smart Chain (BSC)!");
      return;
    }

    if (adminAccount.toLowerCase() !== ADMIN_WALLET) {
      alert("❌ Essa carteira NÃO é a carteira ADMIN autorizada!");
      return;
    }

    alert("✅ Admin conectado!");
    carregarSaquesPendentes();

  } catch (e) {
    console.error(e);
    alert("Erro ao conectar carteira admin.");
  }
}

// ===============================
// LISTAR SAQUES PENDENTES
// ===============================
async function carregarSaquesPendentes() {
  const list = document.getElementById("saquesList");
  if (!list) return;

  list.innerHTML = "<p style='text-align:center;'>Carregando...</p>";

  const { data, error } = await _supabase
    .from("saques_pendentes")
    .select("*")
    .eq("status", "pendente")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    list.innerHTML = "<p style='color:red; text-align:center;'>Erro ao carregar saques.</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p style='text-align:center;'>Nenhum saque pendente.</p>";
    return;
  }

  list.innerHTML = data.map((s) => `
    <div class="saque-card">
      <p><b>ID:</b> ${s.id}</p>
      <p><b>Carteira:</b> ${s.carteira_usuario}</p>
      <p><b>Status:</b> ${s.status}</p>

      <div class="saque-info">
        <div class="saque-box">
          TOTAL BRUTO
          <span>${Number(s.valor_solicitado).toFixed(6)} DYNO</span>
        </div>

        <div class="saque-box">
          TAXA (5%)
          <span>${Number(s.taxa).toFixed(6)} DYNO</span>
        </div>

        <div class="saque-box">
          VALOR FINAL
          <span>${Number(s.valor_final).toFixed(6)} DYNO</span>
        </div>
      </div>

      <button class="pay-btn"
        onclick="pagarSaque(${s.id}, '${s.carteira_usuario}', ${s.valor_final})">
        PAGAR (ENVIAR VALOR FINAL)
      </button>
    </div>
  `).join("");
}

// ===============================
// PAGAR SAQUE (TRANSFER TOKEN)
// ===============================
async function pagarSaque(id, carteira, valorFinal) {
  if (!adminAccount) return alert("Conecte a carteira admin primeiro!");

  if (adminAccount.toLowerCase() !== ADMIN_WALLET) {
    return alert("❌ Você não é admin!");
  }

  if (pagandoAgora) {
    return alert("⚠️ Aguarde... já existe um pagamento em andamento.");
  }

  pagandoAgora = true;

  if (!confirm(`Deseja pagar ${Number(valorFinal).toFixed(6)} DYNO para:\n${carteira}?`)) {
    pagandoAgora = false;
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(tokenAddr, tokenABI, signer);

    const dec = await contract.decimals();
    const amount = ethers.utils.parseUnits(valorFinal.toString(), dec);

    alert("⚡ Confirme o pagamento na MetaMask...");

    const tx = await contract.transfer(carteira, amount);
    await tx.wait();

    const { error } = await _supabase
      .from("saques_pendentes")
      .update({ status: "pago" })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("⚠️ Pagamento feito na blockchain, mas falhou atualizar Supabase!");
      pagandoAgora = false;
      return;
    }

    alert("✅ Saque pago com sucesso!");
    carregarSaquesPendentes();

  } catch (e) {
    console.error(e);
    alert("❌ Erro ao pagar saque.");
  }

  pagandoAgora = false;
}

// ===============================
// INIT
// ===============================
window.onload = () => {
  if (!verificarChaveAdmin()) return;
  startMatrixEffect();
};
