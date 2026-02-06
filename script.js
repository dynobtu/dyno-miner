// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; // Sua chave do print
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CONFIGURAÇÕES DO CONTRATO ---
const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const tokenABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: "100", lucro: 5, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: "200", lucro: 10, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: "400", lucro: 15, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: "800", lucro: 20, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: "1600", lucro: 25, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 1. FUNÇÃO PARA BUSCAR SALDO REAL NA CARTEIRA ---
async function atualizarSaldoCarteira() {
    if (!userAccount || !window.ethereum) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        // Formata o saldo para exibir no painel
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);
    } catch (e) {
        console.error("Erro ao buscar saldo:", e);
    }
}

// --- 2. FUNÇÕES DO BANCO DE DADOS (SUPABASE) ---
async function carregarDadosBanco() {
    if (!userAccount) return;
    const wallet = userAccount.toLowerCase().trim();
    // Busca na tabela 'usuarios' que você criou
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

async function registrarCompraNoBanco(valorGasto) {
    const urlParams = new URLSearchParams(window.location.search);
    const padrinho = urlParams.get('ref');

    if (padrinho && padrinho.length > 30 && padrinho.toLowerCase() !== userAccount.toLowerCase()) {
        const bonus = parseFloat(valorGasto) * 0.05;
        // Ativa sua função SQL de bônus
        await _supabase.rpc('incrementar_indicacao', { 
            alvo: padrinho.toLowerCase().trim(), 
            bonus: bonus 
        });
    }
}

// --- 3. LÓGICA DE INTERFACE ---
async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        
        await carregarDadosBanco();
        await atualizarSaldoCarteira(); // Mostra o saldo de $DYNO
        updateRefUI();
        renderShop();
        if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) startMiningVisuals();
    }
}

function updateRefUI() {
    const input = document.getElementById('refLink');
    if (userAccount && input) {
        // CORREÇÃO DEFINITIVA DO LINK
        const cleanWallet = userAccount.toLowerCase().trim();
        input.value = window.location.origin + window.location.pathname + "?ref=" + cleanWallet;
    }
}

// ... (Mantenha as funções buyGPU, solicitarSaque e as de mineração iguais)
// Adicione apenas a chamada de saldo dentro de buyGPU após o tx.wait()
