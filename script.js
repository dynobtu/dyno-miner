// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CONFIGURAÇÕES DO CONTRATO ---
const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const tokenABI = ["function transfer(address to, uint256 amount) public returns (bool)", "function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)"];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: "100", lucro: 5 },
    { id: 2, nome: "Dyno Raro", custo: "200", lucro: 10 },
    { id: 3, nome: "Dyno Épico", custo: "400", lucro: 15 },
    { id: 4, nome: "Dyno Lendário", custo: "800", lucro: 20 },
    { id: 5, nome: "Super Lendário", custo: "1600", lucro: 25 }
];

let userAccount = null;
let miningInterval = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');
let lastTimeSaved = localStorage.getItem('last_time_saved') || Date.now();

// --- 1. CÁLCULO DE GANHOS ---

function calculateHourlyGain() {
    let total = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const gpu = gpus.find(g => g.id == id);
        if (gpu) total += ((parseFloat(gpu.custo) * (1 + gpu.lucro/100)) / 10) / 24;
    });
    return total;
}

// NOVIDADE: Calcula quanto você ganhou enquanto o site estava fechado
function applyOfflineEarnings() {
    if (!lastActivation) return;
    
    const now = Date.now();
    const endMining = parseInt(lastActivation) + 86400000;
    const lastValidTime = Math.min(now, endMining);
    const timePassedSec = (lastValidTime - parseInt(lastTimeSaved)) / 1000;

    if (timePassedSec > 0) {
        const gainSec = calculateHourlyGain() / 3600;
        visualBalance += (gainSec * timePassedSec);
        saveState();
    }
}

function saveState() {
    localStorage.setItem('saved_mining_balance', visualBalance.toString());
    localStorage.setItem('last_time_saved', Date.now().toString());
}

// --- 2. MOTOR DE ATUALIZAÇÃO ---

function startMiningVisuals() {
    if(miningInterval) clearInterval(miningInterval);
    applyOfflineEarnings(); // Soma o que ganhou offline antes de começar o relógio

    miningInterval = setInterval(() => {
        const gainSec = calculateHourlyGain() / 3600;
        if (gainSec > 0) {
            visualBalance += gainSec;
            saveState();
            document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
            document.getElementById('hashrate').innerText = (gainSec * 360000).toFixed(0);
        }
        updateTimer();
    }, 1000);
}

// --- 3. CONEXÃO E INTERFACE ---

async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        
        // Verifica se ainda está no tempo de mineração
        if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
            startMiningVisuals();
        }
        
        atualizarSaldoCarteira();
        updateRefUI();
        renderShop();
    }
}

function updateTimer() {
    if (!lastActivation) return;
    const tempoRestante = (parseInt(lastActivation) + 86400000) - Date.now();
    const btn = document.getElementById('btnActivate');
    const display = document.getElementById('activationTimer');

    if (tempoRestante > 0) {
        btn.disabled = true;
        const h = Math.floor(tempoRestante / 3600000);
        const m = Math.floor((tempoRestante % 3600000) / 60000);
        const s = Math.floor((tempoRestante % 60000) / 1000);
        display.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else {
        btn.disabled = false;
        display.innerText = "00:00:00";
        if(miningInterval) clearInterval(miningInterval);
    }
}

// Mantém as outras funções (buyGPU, renderShop, etc.) iguais às anteriores
