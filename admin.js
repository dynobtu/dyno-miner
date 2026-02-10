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
const ADMIN_KEY = "dyno123"; // MUDE PARA UMA SENHA MAIS FORTE!

let adminAccount = null;

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
    <div style="
      border:1px solid #00ff66;
      padding:15px;
      margin-bottom:15px;
      border-radius:10px;
      background:#000;
      box-shadow:0 0 10px rgba(0,255,102,0.2);
      font-family:monospace;
    ">
      <p><b>ID:</b> ${s.id}</p>
      <p><b>Carteira:</b> ${s.carteira_usuario}</p>
      <p><b>Valor:</b> ${Number(s.valor_solicitado).toFixed(6)} DYNO</p>
      <p><b>Status:</b> ${s.status}</p>

      <button onclick="pagarSaque(${s.id}, '${s.carteira_usuario}', ${s.valor_solicitado})"
        style="
          padding:10px 15px;
          margin-top:10px;
          background:#00ff66;
          border:none;
          cursor:pointer;
          border-radius:8px;
          font-weight:bold;
        ">
        PAGAR
      </button>
    </div>
  `).join("");
}

// ===============================
// PAGAR SAQUE (TRANSFER TOKEN)
// ===============================
async function pagarSaque(id, carteira, valor) {
  if (!adminAccount) return alert("Conecte a carteira admin primeiro!");

  if (adminAccount.toLowerCase() !== ADMIN_WALLET) {
    return alert("❌ Você não é admin!");
  }

  if (!confirm(`Deseja pagar ${Number(valor).toFixed(6)} DYNO para:\n${carteira}?`)) {
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(tokenAddr, tokenABI, signer);

    const dec = await contract.decimals();
    const amount = ethers.utils.parseUnits(valor.toString(), dec);

    alert("⚡ Confirme o pagamento na MetaMask...");

    const tx = await contract.transfer(carteira, amount);
    await tx.wait();

    // Atualiza Supabase status para pago
    const { error } = await _supabase
      .from("saques_pendentes")
      .update({ status: "pago" })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("⚠️ Pagamento feito na blockchain, mas falhou atualizar Supabase!");
      return;
    }

    alert("✅ Saque pago com sucesso!");
    carregarSaquesPendentes();

  } catch (e) {
    console.error(e);
    alert("❌ Erro ao pagar saque.");
  }
}

// ===============================
// INIT
// ===============================
window.onload = () => {
  verificarChaveAdmin();
};
