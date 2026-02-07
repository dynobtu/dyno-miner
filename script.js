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

function startMiningVisuals() {
    if(miningInterval) clearInterval(miningInterval);
    
    // Bloqueia o botão de ativar imediatamente se estiver no prazo de 24h
    const btn = document.getElementById('btnActivate');
    if(btn) { btn.disabled = true; btn.innerText = "MINERANDO..."; btn.style.opacity = "0.5"; }

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

// --- 4. CONEXÃO E INTERFACE (Onde estavam os erros) ---

async function atualizarSaldoCarteira() {
    if (!userAccount || !window.ethereum) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        // Atualiza o saldo real na tela
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);
    } catch (e) { console.error("Erro saldo:", e); }
}

function gerarLinkAfiliado() {
    if (!userAccount) return;
    const inputRef = document.getElementById('refLink');
    if (inputRef) {
        // Gera o link usando a URL atual + o endereço da carteira
        inputRef.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
    }
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            // Ativa as funções que dependem da carteira
            gerarLinkAfiliado();
            await atualizarSaldoCarteira();
            renderShop();
            
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
                startMiningVisuals();
            }
        } catch (e) { alert("Falha ao conectar."); }
    }
}

// --- 5. AÇÕES (COMPRA E ATIVAÇÃO) ---

async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira!");
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpu.custo, 18));
        await tx.wait();
        
        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        renderShop();
        await atualizarSaldoCarteira();
        alert("Sucesso!");
    } catch (e) { alert("Erro na transação. Verifique seu saldo de $DYNO."); }
}

function activateMining() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(calculateHourlyGain() <= 0) return alert("Compre uma máquina primeiro!");
    
    lastActivation = Date.now();
    localStorage.setItem('last_mining_activation', lastActivation);
    startMiningVisuals();
    alert("Mineração ativada por 24 horas!");
}

function updateTimer() {
    if (!lastActivation) return;
    const tempoRestante = (parseInt(lastActivation) + 86400000) - Date.now();
    const display = document.getElementById('activationTimer');
    const btn = document.getElementById('btnActivate');

    if (tempoRestante > 0) {
        const h = Math.floor(tempoRestante / 3600000), m = Math.floor((tempoRestante % 3600000) / 60000), s = Math.floor((tempoRestante % 60000) / 1000);
        if(display) display.innerText = h.toString().padStart(2,'0') + ":" + m.toString().padStart(2,'0') + ":" + s.toString().padStart(2,'0');
        if(btn) { btn.disabled = true; btn.style.opacity = "0.5"; }
    } else {
        if(display) display.innerText = "00:00:00";
        if(btn) { btn.disabled = false; btn.innerText = "ATIVAR MINERAÇÃO (24H)"; btn.style.opacity = "1"; }
        if(miningInterval) clearInterval(miningInterval);
    }
}

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
    if(lastActivation) updateTimer();
};
