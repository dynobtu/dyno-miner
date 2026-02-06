// 1. CONFIGURAÇÕES
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

let userAccount = null;
let miningInterval = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// 2. LÓGICA
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
            const display = document.getElementById('visualGain');
            if(display) display.innerText = visualBalance.toFixed(6);
        }
        updateTimer();
    }, 1000);
}

// 3. INTERFACE
function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    let html = "";
    gpus.forEach((g, i) => {
        const locked = purchaseHistory[g.id];
        html += '<div class="gpu-item">';
        html += '<div class="badge-profit">+' + g.lucro + '%</div>';
        html += '<img src="' + g.img + '">';
        html += '<h4>' + g.nome + '</h4>';
        html += '<p>' + g.custo + ' $DYNO</p>';
        html += '<button onclick="buyGPU(' + i + ')" ' + (locked ? 'disabled' : '') + '>';
        html += (locked ? 'LOCKED' : 'ADQUIRIR') + '</button></div>';
    });
    grid.innerHTML = html;
}

async function atualizarDadosInterface() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);
        document.getElementById('refLink').value = window.location.origin + window.location.pathname + "?ref=" + userAccount.toLowerCase();
        const hash = calculateHourlyGain() * 100;
        document.getElementById('hashrate').innerText = hash.toFixed(0) + " H/s";
    } catch (e) { console.error(e); }
}

// 4. AÇÕES
async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        const display = document.getElementById('walletDisplay');
        if(display) display.innerText = userAccount.substring(0,6) + "...";
        await atualizarDadosInterface();
        renderShop();
        if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) startMiningVisuals();
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
        atualizarDadosInterface();
        alert("Sucesso!");
    } catch (e) { alert("Erro!"); }
}

function updateTimer() {
    if (!lastActivation) return;
    const tempo = (parseInt(lastActivation) + 86400000) - Date.now();
    const display = document.getElementById('activationTimer');
    if (tempo > 0 && display) {
        const h = Math.floor(tempo / 3600000), m = Math.floor((tempo % 3600000) / 60000), s = Math.floor((tempo % 60000) / 1000);
        display.innerText = h.toString().padStart(2,'0') + ":" + m.toString().padStart(2,'0') + ":" + s.toString().padStart(2,'0');
    }
}

window.onload = async () => {
    renderShop();
    const displayGain = document.getElementById('visualGain');
    if(displayGain) displayGain.innerText = visualBalance.toFixed(6);
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            userAccount = accounts[0];
            await atualizarDadosInterface();
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) startMiningVisuals();
        }
    }
};
