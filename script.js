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

// --- SISTEMA DE SAQUE SEGURO ---
function solicitarSaque() {
    const minimo = 100;
    if (visualBalance < minimo) return alert(`Mínimo de ${minimo} $DYNO para saque!`);

    const taxa = visualBalance * 0.05;
    const liquido = visualBalance - taxa;

    if (confirm(`Deseja sacar ${visualBalance.toFixed(2)} $DYNO?\nTaxa (5%): ${taxa.toFixed(2)}\nVocê receberá: ${liquido.toFixed(2)}`)) {
        alert("SOLICITAÇÃO ENVIADA! O valor será processado manualmente em até 24h.");
        visualBalance = 0;
        localStorage.setItem('saved_mining_balance', 0);
        document.getElementById('visualGain').innerText = "0.000000";
    }
}

// --- MINERAÇÃO E CRONÔMETRO ---
function calculateHourlyGain() {
    let total = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const gpu = gpus.find(g => g.id == id);
        if (gpu) total += ((parseFloat(gpu.custo) * (1 + gpu.lucro/100)) / 10) / 24;
    });
    return total;
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
    }
}

function activateMining() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(calculateHourlyGain() <= 0) return alert("Compre um Dyno primeiro!");
    lastActivation = Date.now();
    localStorage.setItem('last_mining_activation', lastActivation);
    startMiningVisuals();
}

function startMiningVisuals() {
    const gainSec = calculateHourlyGain() / 3600;
    if(miningInterval) clearInterval(miningInterval);
    miningInterval = setInterval(() => {
        visualBalance += gainSec;
        localStorage.setItem('saved_mining_balance', visualBalance);
        document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
        document.getElementById('hashrate').innerText = (gainSec * 360000).toFixed(0);
        updateTimer();
    }, 1000);
}

// --- FUNÇÕES DE CARTEIRA ---
async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        await updateBalance();
        updateRefUI();
        renderShop();
        if(lastActivation) startMiningVisuals();
    }
}

async function updateBalance() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
    const balance = await contract.balanceOf(userAccount);
    const dec = await contract.decimals();
    document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, dec)).toLocaleString('pt-BR', {minimumFractionDigits: 2});
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
        alert("Sucesso!");
    } catch (e) { alert("Erro na compra."); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 864000000);
        return `
            <div class="gpu-item">
                <div class="badge-profit">+${g.lucro}%</div>
                <img src="${g.img}">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>${locked ? 'LOCKED' : 'ADQUIRIR'}</button>
            </div>`;
    }).join('');
}

function updateRefUI() {
    const input = document.getElementById('refLink');
    if (userAccount && input) input.value = window.location.origin + window.location.pathname + "?ref=" + userAccount;
}

function copyRefLink() {
    const input = document.getElementById("refLink");
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Copiado!");
}

function obterDyno() {
    window.open("https://pancakeswap.finance/swap?chain=bsc&inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED", "_blank");
}

function initMatrix() {
    const c = document.getElementById('matrixCanvas');
    const ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = 160;
    const drops = Array(Math.floor(c.width/14)).fill(1);
    setInterval(() => {
        ctx.fillStyle = "rgba(0,0,0,0.05)"; ctx.fillRect(0,0,c.width,c.height);
        ctx.fillStyle = "#00ff41";
        drops.forEach((y, i) => {
            ctx.fillText("01"[Math.floor(Math.random()*2)], i*14, y*14);
            if(y*14 > c.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        });
    }, 50);
}

window.onload = () => { renderShop(); initMatrix(); document.getElementById('visualGain').innerText = visualBalance.toFixed(6); };
