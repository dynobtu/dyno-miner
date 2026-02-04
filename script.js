// --- CONFIGURAÇÕES DO PROJETO ---
const projectWallet = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenContractAddress = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const DB_VERSION = "DYNO_V2_PRO_FINAL"; 

// --- CONFIGURAÇÃO SUPABASE ---
const supabaseUrl = 'https://tdzwbddisdrikzztqoze.supabase.co';
const supabaseKey = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const tokenABI = [
    {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: 50, lucro10d: 5, poder: 10: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: 150, lucro10d: 7, poder: 35: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: 300, lucro10d: 10, poder: 120: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: 600, lucro10d: 15, poder: 450: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: 1500, lucro10d: 25, poder: 1500: "SUPER LENDÁRIO.png" }
];

let userAccount = null, balance = 0.0, isMining = false, miningEndTime = null, purchaseHistory = {};
let refEarnings = 0.0, refCount = 0;

// --- MATRIX EFFECT ---
const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d');
let columns, drops;

function initMatrix() {
    const header = document.querySelector('header');
    if(!header || !canvas) return;
    canvas.width = header.offsetWidth;
    canvas.height = header.offsetHeight;
    columns = canvas.width / 14;
    drops = Array(Math.floor(columns)).fill(1);
}

function drawMatrix() {
    if(!ctx || !canvas) return;
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff41";
    ctx.font = "14px monospace";
    for (let i = 0; i < drops.length; i++) {
        const chars = "01$01$DYNO$";
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(text, i * 14, drops[i] * 14);
        if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
}

// --- INTEGRAÇÃO BANCO DE DADOS (SUPABASE) ---
async function loadUserData(address) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('carteira', address.toLowerCase())
            .single();

        if (data) {
            balance = data.saldo_minera || 0;
            refEarnings = data.ref_earnings || 0;
            refCount = data.ref_count || 0;
            
            const local = JSON.parse(localStorage.getItem(DB_VERSION + "_local_" + address.toLowerCase())) || {};
            isMining = local.isMining || false;
            miningEndTime = local.miningEndTime || null;
            purchaseHistory = local.purchaseHistory || {};
            
            updateUI();
        } else {
            await supabase.from('usuarios').insert([{ carteira: address.toLowerCase() }]);
        }
    } catch (e) { console.error("Erro Supabase:", e); }
}

async function syncToDatabase() {
    if (!userAccount) return;
    await supabase
        .from('usuarios')
        .update({ 
            saldo_minera: balance,
            ref_earnings: refEarnings,
            ref_count: refCount
        })
        .eq('carteira', userAccount.toLowerCase());

    localStorage.setItem(DB_VERSION + "_local_" + userAccount.toLowerCase(), JSON.stringify({ 
        isMining, miningEndTime, purchaseHistory 
    }));
}

// --- LOGICA CORE ---
async function connectWallet() {
    console.log("Tentando conectar...");
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            await loadUserData(userAccount);
            syncData();
        } catch (e) { console.error("Erro na conexão:", e); }
    } else {
        alert("Instale a MetaMask!");
    }
}

async function getWalletBalance() {
    if (!userAccount || !window.ethers) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenContractAddress, tokenABI, provider);
        const raw = await contract.balanceOf(userAccount);
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(raw, 18)).toFixed(2);
    } catch (e) { console.error(e); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const last = purchaseHistory[g.id];
        const isLocked = last && (Date.now() - last < 10*24*60*60*1000);
        return `<div class="gpu-item">
            <img src="${g.img}" onerror="this.src='https://via.placeholder.com/150?text=Dyno'">
            <h4>${g.nome}</h4>
            <p>${g.custo} $DYNO</p>
            <button class="btn-buy" ${isLocked ? 'disabled' : `onclick="buyGPU(${i})"`}>
                ${isLocked ? 'ATIVO' : 'ADQUIRIR'}
            </button>
        </div>`;
    }).join('');
}

function syncData() {
    if (!userAccount) return;
    document.getElementById('walletDisplay').innerText = userAccount.substring(0,10) + "...";
    document.getElementById('refLink').value = window.location.origin + window.location.pathname + "?ref=" + userAccount;
    renderShop();
    updateUI();
    getWalletBalance();
}

function updateUI() {
    if(!userAccount) return;
    document.getElementById('visualGain').innerText = balance.toFixed(6);
    document.getElementById('refEarnings').innerText = refEarnings.toFixed(2);
    document.getElementById('refCount').innerText = refCount;
    
    let pwr = 0;
    const inv = document.getElementById('inventoryList');
    if(inv) {
        inv.innerHTML = "";
        Object.keys(purchaseHistory).forEach(id => {
            if (Date.now() - purchaseHistory[id] < 10*24*60*60*1000) {
                const item = gpus.find(g => g.id == id);
                pwr += item.poder;
                inv.innerHTML += `<div style="color:#00ff41; font-size:0.7rem; margin-bottom:4px;">>> ${item.nome} [ONLINE]</div>`;
            }
        });
        if(inv.innerHTML === "") inv.innerHTML = "Nenhum ativo.";
    }
    
    document.getElementById('hashrate').innerText = pwr;
    const timer = document.getElementById('activationTimer');
    const btn = document.getElementById('btnActivate');

    if (isMining && miningEndTime > Date.now()) {
        const d = miningEndTime - Date.now();
        const h = Math.floor(d/3600000), m = Math.floor((d%3600000)/60000), s = Math.floor((d%60000)/1000);
        if(timer) timer.innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if(btn) { btn.disabled = true; btn.innerText = "SISTEMA EM OPERAÇÃO"; }
    } else {
        if(timer) timer.innerText = "00:00:00";
        if(btn) { btn.disabled = false; btn.innerText = "⚡ ATIVAR MINERAÇÃO (24H)"; }
    }
}

// Funções de suporte
function copyRef() {
    const c = document.getElementById("refLink");
    c.select();
    navigator.clipboard.writeText(c.value);
    alert("Link de indicação copiado!");
}

// Inicialização
window.onload = () => {
    initMatrix();
    setInterval(drawMatrix, 50);
    renderShop();
    if (window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' }).then(async accs => {
            if (accs.length > 0) { 
                userAccount = accs[0]; 
                await loadUserData(userAccount);
                syncData(); 
            }
        });
    }
};
window.onresize = initMatrix;

