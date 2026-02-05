const receptorPagamento = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenContract = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const tokenABI = ["function transfer(address to, uint256 amount) public returns (bool)", "function balanceOf(address account) view returns (uint256)"];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: "50", img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: "150", img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: "300", img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: "600", img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: "1500", img: "SUPER LENDÁRIO.png" }
];

let userAccount = null;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};

function showToast(text) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// CONECTAR REAL
async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            showToast("CONECTADO!");
            renderShop();
            updateBalance();
        } catch (e) { showToast("ERRO AO CONECTAR"); }
    } else { showToast("INSTALE A METAMASK"); }
}

// COMPRA COM POPUP DA METAMASK
async function buyGPU(index) {
    if(!userAccount) return showToast("CONECTE A CARTEIRA!");
    const gpu = gpus[index];
    
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenContract, tokenABI, signer);
        const amount = ethers.utils.parseUnits(gpu.custo, 18);

        showToast("AUTORIZE O PAGAMENTO NA METAMASK...");
        const tx = await contract.transfer(receptorPagamento, amount);
        await tx.wait(); // Espera confirmar na rede

        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        showToast("COMPRA CONCLUÍDA!");
        renderShop();
    } catch (e) { showToast("TRANSAÇÃO CANCELADA OU FALHOU"); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `
            <div class="gpu-item">
                <img src="${g.img}" onerror="this.src='https://via.placeholder.com/150?text=DYNO'">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>
                    ${locked ? 'LOCKED (10D)' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}

// LINK PANCAKE CORRETO
function obterDyno() {
    window.open("https://pancakeswap.finance/swap?chain=bsc&inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED", "_blank");
}

function activateMining() {
    if(!userAccount) return showToast("CONECTE A CARTEIRA!");
    showToast("MINERAÇÃO ATIVADA (24H)!");
    // Aqui inicia o contador visual
    let sec = 86400;
    const timer = setInterval(() => {
        sec--;
        const h = Math.floor(sec/3600);
        const m = Math.floor((sec%3600)/60);
        const s = sec%60;
        document.getElementById('activationTimer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        if(sec <= 0) clearInterval(timer);
    }, 1000);
}

// Efeito Matrix
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

window.onload = () => { renderShop(); initMatrix(); };
