// --- 1. CONFIGURAÇÕES E ESTADO DO SISTEMA ---
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

let userAccount = null;
let miningInterval = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');
let lastTimestamp = localStorage.getItem('last_timestamp') || Date.now();

// --- 2. LÓGICA DE MINERAÇÃO E CÁLCULOS ---

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
    const fim = parseInt(lastActivation) + 86400000;
    const limite = agora > fim ? fim : agora;
    const tempoPassado = limite - parseInt(lastTimestamp);
    
    if (tempoPassado > 0) {
        visualBalance += (calculateHourlyGain() / 3600) * (tempoPassado / 1000);
        localStorage.setItem('saved_mining_balance', visualBalance.toString());
    }
    localStorage.setItem('last_timestamp', agora.toString());
}

function startMiningVisuals() {
    if(miningInterval) clearInterval(miningInterval);
    checkOfflineMining();
    miningInterval = setInterval(() => {
        const gainSec = calculateHourlyGain() / 3600;
        if (gainSec > 0) {
            visualBalance += gainSec;
            localStorage.setItem('saved_mining_balance', visualBalance.toString());
            localStorage.setItem('last_timestamp', Date.now().toString());
            document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
            document.getElementById('hashrate').innerText = (gainSec * 360000).toFixed(0) + " H/s";
        }
        updateTimer();
    }, 1000);
}

// --- 3. FUNÇÕES DE CARTEIRA E CONEXÃO ---

async function atualizarDadosInterface() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        
        // Saldo em Carteira (Resolve o 0.00)
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);

        // Link de Afiliado
        const inputRef = document.getElementById('refLink');
        if (inputRef) {
            inputRef.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
        }
    } catch (e) { console.error("Erro interface:", e); }
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            await atualizarDadosInterface();
            renderShop();
            
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
                startMiningVisuals();
            }
        } catch (err) { alert("Falha ao conectar."); }
    } else { alert("Instale a MetaMask!"); }
}

// --- 4. AÇÕES (ATIVAR, COMPRAR, SAQUE) ---

function activateMining() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(calculateHourlyGain() <= 0) return alert("Adquira um Dyno primeiro!");
    
    const agora = Date.now();
    if (lastActivation && (parseInt(lastActivation) + 86400000) > agora) return;

    lastActivation = agora;
    localStorage.setItem('last_mining_activation', lastActivation);
    startMiningVisuals();
}

async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira!");
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpu.custo, 18));
        alert("Transação enviada!");
        await tx.wait();
        
        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        renderShop();
        atualizarDadosInterface();
        alert("Dyno Adquirido!");
    } catch (e) { alert("Erro: Verifique saldo e rede."); }
}

function updateTimer() {
    if (!lastActivation) return;
    const tempo = (parseInt(lastActivation) + 86400000) - Date.now();
    const btn = document.getElementById('btnActivate');
    const timerDisplay = document.getElementById('activationTimer');

    if (tempo > 0) {
        if(btn) { btn.disabled = true; btn.innerText = "MINERANDO..."; btn.style.opacity = "0.5"; }
        const h = Math.floor(tempo / 3600000), m = Math.floor((tempo % 3600000) / 60000), s = Math.floor((tempo % 60000) / 1000);
        if(timerDisplay) timerDisplay.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else {
        if(btn) { btn.disabled = false; btn.innerText = "ATIVAR MINERAÇÃO (24H)"; btn.style.opacity = "1"; }
    }
}

// --- 5. INICIALIZAÇÃO ---

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

window.onload = () => {
    renderShop();
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
    setInterval(updateTimer, 1000);
};
