// --- CONFIGURAÇÕES ---
const tokenContractAddress = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const supabaseUrl = 'https://tdzwbddisdrikzztqoze.supabase.co';
const supabaseKey = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: 50, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: 150, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: 300, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: 600, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: 1500, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null;
let balance = 0.0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};

// --- NOTIFICAÇÕES ---
function showToast(text, type = 'success') {
    const container = document.getElementById('notification-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- METAMASK ---
async function connectWallet() {
    if (window.ethereum) {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const accs = await provider.send("eth_requestAccounts", []);
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            await updateBalances();
            showToast("CARTEIRA CONECTADA!");
            renderShop();
        } catch (e) { showToast("ERRO NA CONEXÃO", "error"); }
    } else { showToast("INSTALE A METAMASK!", "error"); }
}

async function updateBalances() {
    if(!userAccount) return;
    // Saldo da MetaMask (Simples)
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const bal = await provider.getBalance(userAccount);
    document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatEther(bal)).toFixed(2);
}

// --- MERCADO ---
function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const cooldownActive = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `
            <div class="gpu-item">
                <img src="${g.img}" onerror="this.src='https://via.placeholder.com/150?text=DYNO'">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${cooldownActive ? 'disabled' : ''}>
                    ${cooldownActive ? 'LOCKED' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}

function buyGPU(index) {
    if(!userAccount) return showToast("CONECTE A CARTEIRA!", "error");
    const gpu = gpus[index];
    
    // Simulação de compra com trava de 10 dias
    purchaseHistory[gpu.id] = Date.now();
    localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
    showToast(`COMPRA DE ${gpu.nome} PROCESSADA!`);
    renderShop();
}

function solicitarSaque() {
    if(balance < 50) return showToast("SAQUE MÍNIMO É 50 $DYNO!", "error");
    showToast("SOLICITAÇÃO ENVIADA!");
}

function obterDyno() {
    window.open("https://pancakeswap.finance", "_blank");
}

// Inicialização
window.onload = () => {
    renderShop();
    // Inicie aqui sua função da Matrix...
};
