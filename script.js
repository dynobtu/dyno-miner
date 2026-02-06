// --- 1. CONFIGURAÇÕES E CONEXÕES ---
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33ac1823bA2fdc9ED";
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

// --- 2. VARIÁVEIS DE ESTADO ---
let userAccount = null;
let miningInterval = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');
let lastTimestamp = localStorage.getItem('last_timestamp') || Date.now();

// --- 3. LÓGICA DE MINERAÇÃO ---

function calculateHourlyGain() {
    let total = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const gpu = gpus.find(g => g.id == id);
        if (gpu) total += ((parseFloat(gpu.custo) * (1 + gpu.lucro/100)) / 10) / 24;
    });
    return total;
}

function checkOfflineMining() {
    if (!lastActivation || calculateHourlyGain() <= 0) return;
    const agora = Date.now();
    const fimMineracao = parseInt(lastActivation) + 86400000;
    const limiteCalculo = agora > fimMineracao ? fimMineracao : agora;
    const tempoPassadoSms = limiteCalculo - parseInt(lastTimestamp);
    
    if (tempoPassadoSms > 0) {
        const ganhoOffline = (calculateHourlyGain() / 3600) * (tempoPassadoSms / 1000);
        visualBalance += ganhoOffline;
        localStorage.setItem('saved_mining_balance', visualBalance.toString());
    }
    localStorage.setItem('last_timestamp', agora.toString());
}

function startMiningVisuals() {
    if(miningInterval) clearInterval(miningInterval);
    checkOfflineMining();

    const gainSec = calculateHourlyGain() / 3600;
    miningInterval = setInterval(() => {
        if (gainSec > 0) {
            visualBalance += gainSec;
            localStorage.setItem('saved_mining_balance', visualBalance.toString());
            localStorage.setItem('last_timestamp', Date.now().toString());
            const display = document.getElementById('visualGain');
            if(display) display.innerText = visualBalance.toFixed(6);
            const hashDisplay = document.getElementById('hashrate');
            if(hashDisplay) hashDisplay.innerText = (gainSec * 360000).toFixed(0) + " H/s";
        }
        updateTimer();
    }, 1000);
}

// --- 4. AÇÕES E TRAVAS ---

function activateMining() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(calculateHourlyGain() <= 0) return alert("Compre uma máquina primeiro!");
    
    // Trava de segurança: não deixa ativar se já houver um ciclo ativo
    const tempoRestante = (parseInt(lastActivation) + 86400000) - Date.now();
    if (tempoRestante > 0) return alert("A mineração já está em curso!");

    lastActivation = Date.now();
    lastTimestamp = Date.now();
    localStorage.setItem('last_mining_activation', lastActivation);
    localStorage.setItem('last_timestamp', lastTimestamp);
    
    startMiningVisuals();
    alert("Mineração iniciada por 24h!");
}

function updateTimer() {
    if (!lastActivation) return;
    const tempoRestante = (parseInt(lastActivation) + 86400000) - Date.now();
    const display = document.getElementById('activationTimer');
    const btn = document.getElementById('btnActivate'); // Certifique-se que seu botão no HTML tem esse ID

    if (tempoRestante > 0) {
        // Bloqueia o botão e muda o visual
        if(btn) {
            btn.disabled = true;
            btn.innerText = "MINERANDO...";
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        }
        const h = Math.floor(tempoRestante / 3600000), m = Math.floor((tempoRestante % 3600000) / 60000), s = Math.floor((tempoRestante % 60000) / 1000);
        if(display) display.innerText = h.toString().padStart(2,'0') + ":" + m.toString().padStart(2,'0') + ":" + s.toString().padStart(2,'0');
    } else {
        // Libera o botão
        if(btn) {
            btn.disabled = false;
            btn.innerText = "ATIVAR MINERAÇÃO (24H)";
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        }
        if(display) display.innerText = "00:00:00";
        if(miningInterval) clearInterval(miningInterval);
    }
}

async function solicitarSaque() {
    if(!userAccount) return alert("Conecte sua carteira!");
    if(visualBalance < 100) return alert("Saque mínimo de 100 $DYNO!");
    try {
        const { error } = await _supabase.from('saques_pendentes').insert([{ 
            carteira_usuario: userAccount.toLowerCase(), 
            valor_solicitado: visualBalance 
        }]);
        if (!error) {
            visualBalance = 0;
            localStorage.setItem('saved_mining_balance', "0");
            document.getElementById('visualGain').innerText = "0.000000";
            alert("Saque solicitado!");
        }
    } catch (e) { alert("Erro no saque."); }
}

// --- 5. INTERFACE ---

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id];
        return `<div class="gpu-item">
            <div class="badge-profit">+${g.lucro}%</div>
            <img src="${g.img}">
            <h4>${g.nome}</h4>
            <p>${g.custo} $DYNO</p>
            <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>${locked ? 'LOCKED' : 'ADQUIRIR'}</button>
        </div>`;
    }).join('');
}

async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        const display = document.getElementById('walletDisplay');
        if(display) display.innerText = userAccount.substring(0,6) + "...";
        renderShop();
        if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
            startMiningVisuals();
        }
    }
}

window.onload = () => { 
    renderShop(); 
    const balDisplay = document.getElementById('visualGain');
    if(balDisplay) balDisplay.innerText = visualBalance.toFixed(6);
    // Inicia o timer para verificar se o botão deve estar bloqueado logo ao abrir
    setInterval(updateTimer, 1000); 
};
