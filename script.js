// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CONFIGURAÇÕES DO CONTRATO ---
const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const tokenABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

let userAccount = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 1. FUNÇÕES DE BANCO DE DADOS (SUPABASE) ---

// GARANTE QUE O USUÁRIO EXISTE NA TABELA ASSIM QUE CONECTA
async function verificarOuCriarUsuario() {
    if (!userAccount) return;
    const wallet = userAccount.toLowerCase().trim();
    
    // Tenta inserir o usuário. Se já existir, não faz nada (ON CONFLICT)
    const { error } = await _supabase
        .from('usuarios')
        .upsert({ carteira: wallet }, { onConflict: 'carteira' });
    
    if (error) console.error("Erro ao registrar usuário:", error);
    await carregarDadosBanco();
}

async function carregarDadosBanco() {
    const wallet = userAccount.toLowerCase().trim();
    const { data } = await _supabase
        .from('usuarios')
        .select('ref_count, ref_earnings')
        .eq('carteira', wallet)
        .single();

    if (data) {
        document.getElementById('refCount').innerText = data.ref_count || 0;
        document.getElementById('refEarnings').innerText = (data.ref_earnings || 0).toFixed(2);
    }
}

async function atualizarSaldoCarteira() {
    if (!userAccount || !window.ethereum) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        // Atualiza o campo de saldo em carteira
        const saldoFormatado = ethers.utils.formatUnits(balance, decimals);
        document.getElementById('walletBalance').innerText = parseFloat(saldoFormatado).toFixed(2);
    } catch (e) { console.error("Erro saldo:", e); }
}

// --- 2. LÓGICA DE CONEXÃO E INTERFACE ---

async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        
        await verificarOuCriarUsuario(); // Cria a linha na tabela 'usuarios'
        await atualizarSaldoCarteira();
        updateRefUI();
        renderShop();
    }
}

function updateRefUI() {
    const input = document.getElementById('refLink');
    if (userAccount && input) {
        const cleanWallet = userAccount.toLowerCase().trim();
        // Remove de vez o erro do "{" no link
        input.value = `${window.location.origin}${window.location.pathname}?ref=${cleanWallet}`;
    }
}

// --- 3. COMPRA E BÔNUS ---

async function registrarCompraNoBanco(valorGasto) {
    const urlParams = new URLSearchParams(window.location.search);
    const padrinho = urlParams.get('ref');

    if (padrinho && padrinho.length > 30 && padrinho.toLowerCase() !== userAccount.toLowerCase()) {
        const bonus = parseFloat(valorGasto) * 0.05;
        // Chama a função SQL RPC que você criou
        await _supabase.rpc('incrementar_indicacao', { 
            alvo: padrinho.toLowerCase().trim(), 
            bonus: bonus 
        });
    }
}

// ... (Restante das funções de mineração e renderShop iguais)
