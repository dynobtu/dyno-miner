// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; // Chave verificada
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

// --- VARIÁVEIS DE ESTADO ---
let userAccount = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 1. FUNÇÕES DE BANCO DE DADOS ---

async function verificarOuCriarUsuario() {
    if (!userAccount) return;
    const wallet = userAccount.toLowerCase().trim();
    
    // Força a entrada da carteira na tabela 'usuarios'
    try {
        await _supabase.from('usuarios').upsert({ carteira: wallet }, { onConflict: 'carteira' });
        await carregarDadosBanco();
    } catch (e) { console.error("Erro banco:", e); }
}

async function carregarDadosBanco() {
    const wallet = userAccount.toLowerCase().trim();
    const { data } = await _supabase.from('usuarios').select('ref_count, ref_earnings').eq('carteira', wallet).single();
    if (data) {
        document.getElementById('refCount').innerText = data.ref_count || 0;
        document.getElementById('refEarnings').innerText = (data.ref_earnings || 0).toFixed(2);
    }
}

// --- 2. CONEXÃO E INTERFACE ---

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            await verificarOuCriarUsuario();
            updateRefUI();
            renderShop();
            // Inicia mineração se houver ativação recente
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
                startMiningVisuals();
            }
        } catch (e) { console.error(e); }
    }
}

function updateRefUI() {
    const input = document.getElementById('refLink');
    if (userAccount && input) {
        const wallet = userAccount.toLowerCase().trim();
        // Limpa o erro do link que aparecia com "{"
        input.value = `${window.location.origin}${window.location.pathname}?ref=${wallet}`;
    }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 864000000);
        return `
            <div class="gpu-item">
                <div class="badge-profit">+${g.lucro}%</div>
                <img src="${g.img}">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>${locked ? 'LOCKED' : 'ADQUIRIR'}</button>
            </div>`;
    }).join('');
}

// --- 3. LOGICA DE MINERAÇÃO (Para as máquinas aparecerem) ---

function calculateHourlyGain() {
    let total = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const gpu = gpus.find(g => g.id == id);
        if (gpu) total += ((parseFloat(gpu.custo) * (1 + gpu.lucro/100)) / 10) / 24;
    });
    return total;
}

function startMiningVisuals() {
    const gainSec = calculateHourlyGain() / 3600;
    setInterval(() => {
        visualBalance += gainSec;
        document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
    }, 1000);
}

// Inicializa a loja ao abrir o site
window.onload = () => { 
    renderShop(); 
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
};
