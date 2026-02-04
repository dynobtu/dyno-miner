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
    { id: 1, nome: "Dyno Normal", custo: 50, lucro10d: 5, poder: 10, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: 150, lucro10d: 7, poder: 35, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: 300, lucro10d: 10, poder: 120, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: 600, lucro10d: 15, poder: 450, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: 1500, lucro10d: 25, poder: 1500, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null, balance = 0.0, isMining = false, miningEndTime = null, purchaseHistory = {};
let refEarnings = 0.0, refCount = 0;

// --- MATRIX EFFECT ---
const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d');
let columns, drops;

function initMatrix() {
    const header = document.querySelector('header');
    if(!header) return;
    canvas.width = header.offsetWidth;
    canvas.height = header.offsetHeight;
    columns = canvas.width / 14;
    drops = Array(Math.floor(columns)).fill(1);
}

function drawMatrix() {
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
    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('carteira', address.toLowerCase())
        .single();

    if (data) {
        // Carrega dados do Banco Global
        balance = data.saldo_minera || 0;
        refEarnings = data.ref_earnings || 0;
        refCount = data.ref_count || 0;
        
        // Carrega timers e inventário do LocalStorage (mais rápido para interface)
        const local = JSON.parse(localStorage.getItem(DB_VERSION + "_local_" + address.toLowerCase())) || {};
        isMining = local.isMining || false;
        miningEndTime = local.miningEndTime || null;
        purchaseHistory = local.purchaseHistory || {};
        
        updateUI();
    } else {
        // Se for novo, regista no banco
        await supabase.from('usuarios').insert([{ carteira: address.toLowerCase() }]);
    }
}

async function syncToDatabase() {
    if (!userAccount) return;
    // Salva Saldo e Indicações na Nuvem
    await supabase
        .from('usuarios')
        .update({ 
            saldo_minera: balance,
            ref_earnings: refEarnings,
            ref_count: refCount
        })
        .eq('carteira', userAccount.toLowerCase());

    // Salva Timers localmente
    localStorage.setItem(DB_VERSION + "_local_" + userAccount.toLowerCase(), JSON.stringify({ 
        isMining, miningEndTime, purchaseHistory 
    }));
}

async function processReferral(referrer, itemCost) {
    const bonus = itemCost * 0.05;
    // Chama a função SQL 'incrementar_indicacao' que criamos no Supabase
    const { error } = await supabase.rpc('incrementar_indicacao', { 
        alvo: referrer.toLowerCase(), 
        bonus: bonus 
    });
    if (error) console.error("Erro ao processar indicação global:", error);
}

// --- LOGICA CORE ---
async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        await loadUserData(userAccount);
        syncData();
    }
}

async function getWalletBalance() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenContractAddress, tokenABI, provider);
        const raw = await contract.balanceOf(userAccount);
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(raw, 18)).toFixed(2);
    } catch (e) { console.error(e); }
}

function activateMining() {
    if (Object.keys(purchaseHistory).length === 0) return alert("Sem Dynos ativos.");
    if (isMining && miningEndTime > Date.now()) return alert("Ciclo ativo.");

    isMining = true;
    miningEndTime = Date.now() + (24 * 60 * 60 * 1000);
    syncToDatabase();
    updateUI();
}

async function buyGPU(index) {
    if (!userAccount) return connectWallet();
    const item = gpus[index];
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = urlParams.get('ref');

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenContractAddress, tokenABI, signer);
        const tx = await contract.transfer(projectWallet, ethers.utils.parseUnits(item.custo.toString(), 18));
        
        await tx.wait();
        
        // Regista indicação no Supabase
        if (referrer && referrer.toLowerCase() !== userAccount.toLowerCase()) {
            await processReferral(referrer, item.custo);
        }

        purchaseHistory[item.id] = Date.now();
        await syncToDatabase();
        syncData();
        alert("AQUISIÇÃO CONFIRMADA!");
    } catch (e) { alert("Falha na transação."); }
}

function syncData() {
    if (!userAccount) return;
    document.getElementById('walletDisplay').innerText = userAccount.substring(0,10) + "...";
    document.getElementById('refLink').value = window.location.origin + window.location.pathname + "?ref=" + userAccount;
    renderShop();
    updateUI();
    getWalletBalance();
}

setInterval(() => {
    if (isMining && miningEndTime > Date.now()) {
        let gain = 0;
        Object.keys(purchaseHistory).forEach(id => {
            if (Date.now() - purchaseHistory[id] < 10*24*60*60*1000) {
                const item = gpus.find(g => g.id == id);
                gain += ((item.custo * (1 + item.lucro10d/100)) / 10) / 86400;
            }
        });
        balance += gain;
        // Sincroniza com a nuvem a cada 15 segundos
        if (Math.floor(Date.now() / 1000) % 15 === 0) syncToDatabase();
    } else {
        isMining = false;
    }
    updateUI();
}, 1000);

function updateUI() {
    if(!userAccount) return;
    document.getElementById('visualGain').innerText = balance.toFixed(6);
    document.getElementById('refEarnings').innerText = refEarnings.toFixed(2);
    document.getElementById('refCount').innerText = refCount;
    
    let pwr = 0;
    const inv = document.getElementById('inventoryList');
    inv.innerHTML = "";
    Object.keys(purchaseHistory).forEach(id => {
        if (Date.now() - purchaseHistory[id] < 10*24*60*60*1000) {
            const item = gpus.find(g => g.id == id);
            pwr += item.poder;
            inv.innerHTML += `<div style="color:#00ff41; font-size:0.7rem; margin-bottom:4px;">>> ${item.nome} [ONLINE]</div>`;
        }
    });
    if(inv.innerHTML === "") inv.innerHTML = "Nenhum ativo.";
    
    document.getElementById('hashrate').innerText = pwr;
    const timer = document.getElementById('activationTimer');
    const btn = document.getElementById('btnActivate');

    if (isMining && miningEndTime > Date.now()) {
        const d = miningEndTime - Date.now();
        const h = Math.floor(d/3600000), m = Math.floor((d%3600000)/60000), s = Math.floor((d%60000)/1000);
        timer.innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        btn.disabled = true;
        btn.innerText = "SISTEMA EM OPERAÇÃO";
    } else {
        timer.innerText = "00:00:00";
        btn.disabled = false;
        btn.innerText = "⚡ ATIVAR MINERAÇÃO (24H)";
    }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    grid.innerHTML = gpus.map((g, i) => {
        const last = purchaseHistory[g.id];
        const isLocked = last && (Date.now() - last < 10*24*60*60*1000);
        return `<div class="gpu-item">
            <img src="img/${g.img}">
            <h4>${g.nome}</h4>
            <p>${g.custo} $DYNO</p>
            <button class="btn-buy" ${isLocked ? 'disabled' : `onclick="buyGPU(${i})"`}>
                ${isLocked ? 'LOCKED' : 'ADQUIRIR'}
            </button>
        </div>`;
    }).join('');
}

function copyRef() {
    const c = document.getElementById("refLink");
    c.select();
    navigator.clipboard.writeText(c.value);
    alert("Copiado!");
}

window.onload = () => {
    initMatrix();
    setInterval(drawMatrix, 50);
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