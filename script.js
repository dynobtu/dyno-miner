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

// --- 3. LÓGICA DE MINERAÇÃO (AGORA COM OFFLINE) ---

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
    checkOfflineMining(); // Calcula o que rendeu enquanto estava fechado

    const gainSec = calculateHourlyGain() / 3600;
    miningInterval = setInterval(() => {
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

// --- 4. AÇÃO DE SAQUE (ADICIONADA) ---

async function solicitarSaque() {
    if(!userAccount) return alert("Conecte sua carteira primeiro!");
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
            alert("Solicitação de saque enviada com sucesso!");
        } else {
            alert("Erro ao enviar para o banco de dados.");
        }
    } catch (e) {
        alert("Erro na conexão com o servidor.");
    }
}

// --- 5. RESTANTE DAS FUNÇÕES (IGUAIS ÀS SUAS) ---

async function atualizarSaldoCarteira() {
    if (!userAccount || !window.ethereum) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);
    } catch (e) { console.error("Erro saldo:", e); }
}

async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        await atualizarSaldoCarteira();
        renderShop();
        if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
            startMiningVisuals();
        }
    }
}

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
        atualizarSaldoCarteira();
        alert("Sucesso!");
    } catch (e) { alert("Erro na transação."); }
}

function activateMining() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(calculateHourlyGain() <= 0) return alert("Compre uma máquina primeiro!");
    lastActivation = Date.now();
    lastTimestamp = Date.now();
    localStorage.setItem('last_mining_activation', lastActivation);
    localStorage.setItem('last_timestamp', lastTimestamp);
    startMiningVisuals();
    alert("Mineração ativada!");
}

function updateTimer() {
    if (!lastActivation) return;
    const tempoRestante = (parseInt(lastActivation) + 86400000) - Date.now();
    const display = document.getElementById('activationTimer');
    if (tempoRestante > 0) {
        const h = Math.floor(tempoRestante / 3600000), m = Math.floor((tempoRestante % 3600000) / 60000), s = Math.floor((tempoRestante % 60000) / 1000);
        display.innerText = h.toString().padStart(2,'0') + ":" + m.toString().padStart(2,'0') + ":" + s.toString().padStart(2,'0');
    } else {
        display.innerText = "00:00:00";
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
};
