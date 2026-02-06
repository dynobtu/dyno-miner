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

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: "100", lucro: 5, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: "200", lucro: 10, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: "400", lucro: 15, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: "800", lucro: 20, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: "1600", lucro: 25, img: "SUPER LENDÁRIO.png" }
];

// --- ESTADO INICIAL ---
let userAccount = null;
let miningInterval = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 1. FUNÇÕES DE BANCO E BLOCKCHAIN ---

async function atualizarSaldoCarteira() {
    if (!userAccount || !window.ethereum) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        // Atualiza o visor que estava em 0.00
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);
    } catch (e) { console.error("Erro saldo:", e); }
}

async function verificarOuCriarUsuario() {
    if (!userAccount) return;
    const wallet = userAccount.toLowerCase().trim();
    try {
        await _supabase.from('usuarios').upsert({ carteira: wallet }, { onConflict: 'carteira' });
        const { data } = await _supabase.from('usuarios').select('ref_count, ref_earnings').eq('carteira', wallet).single();
        if (data) {
            document.getElementById('refCount').innerText = data.ref_count || 0;
            document.getElementById('refEarnings').innerText = (data.ref_earnings || 0).toFixed(2);
        }
    } catch (e) { console.error("Erro banco:", e); }
}

// --- 2. MOTOR DE MINERAÇÃO ---

function calculateHourlyGain() {
    let total = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const gpu = gpus.find(g => g.id == id);
        if (gpu) total += ((parseFloat(gpu.custo) * (1 + gpu.lucro/100)) / 10) / 24;
    });
    return total;
}

function startMiningVisuals() {
    if(miningInterval) clearInterval(miningInterval);
    const gainSec = calculateHourlyGain() / 3600;
    
    miningInterval = setInterval(() => {
        if (gainSec > 0) {
            visualBalance += gainSec;
            localStorage.setItem('saved_mining_balance', visualBalance.toString());
            document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
            document.getElementById('hashrate').innerText = (calculateHourlyGain() * 100).toFixed(0);
        }
        updateTimer();
    }, 1000);
}

// --- 3. INTERFACE ---

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            await verificarOuCriarUsuario();
            await atualizarSaldoCarteira();
            updateRefUI();
            renderShop();
            
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
                startMiningVisuals();
            }
        } catch (e) { console.error(e); }
    }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id];
        return `
            <div class="gpu-item">
                <div class="badge-profit">+${g.lucro}%</div>
                <img src="${g.img || 'NORMAL.png'}">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>${locked ? 'LOCKED' : 'ADQUIRIR'}</button>
            </div>`;
    }).join('');
}

function updateTimer() {
    if (!lastActivation) return;
    const tempoRestante = (parseInt(lastActivation) + 86400000) - Date.now();
    const display = document.getElementById('activationTimer');
    const btn = document.getElementById('btnActivate');

    if (tempoRestante > 0) {
        if(btn) btn.disabled = true;
        const h = Math.floor(tempoRestante / 3600000);
        const m = Math.floor((tempoRestante % 3600000) / 60000);
        const s = Math.floor((tempoRestante % 60000) / 1000);
        if(display) display.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else {
        if(btn) btn.disabled = false;
        if(display) display.innerText = "00:00:00";
    }
}

function updateRefUI() {
    const input = document.getElementById('refLink');
    if (userAccount && input) {
        input.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
    }
}

window.onload = () => { 
    renderShop(); // Carrega as máquinas imediatamente
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
};
