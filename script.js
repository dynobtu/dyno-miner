// --- CONFIGURAÇÕES ---
const projectWallet = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenContractAddress = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const DB_VERSION = "DYNO_V2_PRO_FINAL";

const supabaseUrl = 'https://tdzwbddisdrikzztqoze.supabase.co';
const supabaseKey = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const tokenABI = [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: 50, poder: 10, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: 150, poder: 35, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: 300, poder: 120, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: 600, poder: 450, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: 1500, poder: 1500, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null, balance = 0.0, isMining = false, miningEndTime = null, purchaseHistory = {};

// --- NOTIFICAÇÕES (AVISOS) ---
function showToast(text, type = 'success') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.innerText = text;
    toast.style.cssText = `background:${type === 'success' ? '#00ff41' : '#ff4141'}; color:#000; padding:15px; margin-top:10px; border-radius:5px; font-weight:bold; font-family:monospace; box-shadow:0 0 10px rgba(0,255,65,0.5);`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- METAMASK & SALDO ---
async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            await loadUserData(userAccount);
            await updateMetaMaskBalance();
            showToast("CONECTADO COM SUCESSO!");
        } catch (e) { showToast("ERRO AO CONECTAR", "error"); }
    } else { showToast("INSTALE A METAMASK!", "error"); }
}

async function updateMetaMaskBalance() {
    if(!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenContractAddress, tokenABI, provider);
        const bal = await contract.balanceOf(userAccount);
        document.getElementById('walletBalance').innerText = ethers.utils.formatUnits(bal, 18);
    } catch (e) { console.error(e); }
}

// --- LOGICA DE COMPRA (10 DIAS) ---
function buyGPU(index) {
    if (!userAccount) return showToast("CONECTE A CARTEIRA!", "error");
    const gpu = gpus[index];
    const agora = Date.now();
    const cooldown = 10 * 24 * 60 * 60 * 1000;

    if (purchaseHistory[gpu.id] && (agora - purchaseHistory[gpu.id] < cooldown)) {
        return showToast("COOLDOWN: 1 COMPRA A CADA 10 DIAS!", "error");
    }

    // Aqui você adicionaria a transação real. Para teste:
    purchaseHistory[gpu.id] = agora;
    showToast(`ADQUIRIDO: ${gpu.nome}!`);
    renderShop();
    saveData();
}

// --- MINERAÇÃO (24H) ---
function activateMining() {
    if (!userAccount) return showToast("CONECTE A CARTEIRA!", "error");
    if (isMining) return showToast("JÁ ESTÁ MINERANDO!", "error");

    isMining = true;
    miningEndTime = Date.now() + (24 * 60 * 60 * 1000);
    showToast("MINERAÇÃO ATIVADA POR 24H!");
    saveData();
}

function updateMining() {
    if (!isMining || !miningEndTime) return;
    const agora = Date.now();
    const rest = miningEndTime - agora;

    if (rest <= 0) {
        isMining = false;
        document.getElementById('activationTimer').innerText = "00:00:00";
        showToast("MINERAÇÃO PAROU! REATIVE AGORA.", "error");
    } else {
        const h = Math.floor(rest/3600000).toString().padStart(2,'0');
        const m = Math.floor((rest%3600000)/60000).toString().padStart(2,'0');
        const s = Math.floor((rest%60000)/1000).toString().padStart(2,'0');
        document.getElementById('activationTimer').innerText = `${h}:${m}:${s}`;
        
        // Simulação de ganho passivo enquanto ativo
        balance += 0.000001; 
        document.getElementById('visualGain').innerText = balance.toFixed(6);
    }
}

// --- UTILITÁRIOS ---
function obterDyno() { window.open("https://pancakeswap.finance", "_blank"); }

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const lock = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `<div class="gpu-item">
            <img src="${g.img}" onerror="this.src='https://via.placeholder.com/150'">
            <h4>${g.nome}</h4>
            <p>${g.custo} $DYNO</p>
            <button onclick="buyGPU(${i})" ${lock ? 'disabled' : ''}>${lock ? 'LOCKED' : 'ADQUIRIR'}</button>
        </div>`;
    }).join('');
}

async function loadUserData(addr) {
    const { data } = await supabase.from('usuarios').select('*').eq('carteira', addr.toLowerCase()).single();
    if (data) balance = data.saldo_minera || 0;
    const local = JSON.parse(localStorage.getItem(DB_VERSION + "_" + addr.toLowerCase())) || {};
    purchaseHistory = local.purchaseHistory || {};
    miningEndTime = local.miningEndTime || null;
    isMining = miningEndTime && (miningEndTime > Date.now());
    renderShop();
}

function saveData() {
    if(!userAccount) return;
    localStorage.setItem(DB_VERSION + "_" + userAccount.toLowerCase(), JSON.stringify({ purchaseHistory, miningEndTime }));
}

// Matrix Effect e Loops
window.onload = () => { 
    renderShop(); 
    setInterval(updateMining, 1000); 
    // ... (incluir sua função initMatrix() aqui)
};
