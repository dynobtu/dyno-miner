// --- 1. CONFIGURAÇÕES ---
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

// --- 3. FUNÇÕES DE CARTEIRA E SALDO ---

async function atualizarSaldoCarteira() {
    if (!userAccount || !window.ethereum) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        const saldoFormatado = ethers.utils.formatUnits(balance, decimals);
        
        const display = document.getElementById('walletBalance');
        if(display) display.innerText = parseFloat(saldoFormatado).toFixed(2);
    } catch (e) {
        console.error("Erro ao carregar saldo:", e);
    }
}

function updateRefLink() {
    const input = document.getElementById('refLink');
    if (userAccount && input) {
        const link = window.location.origin + window.location.pathname + "?ref=" + userAccount.toLowerCase();
        input.value = link;
    }
}

// --- 4. COMPRA E MINERAÇÃO ---

async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira primeiro!");
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpu.custo, 18));
        alert("Aguardando confirmação da rede...");
        await tx.wait();
        
        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        
        renderShop();
        await atualizarSaldoCarteira();
        alert("Dyno Adquirido com sucesso!");
    } catch (e) {
        alert("Erro na transação. Verifique seu saldo de $DYNO e a rede conectada.");
    }
}

// --- 5. INICIALIZAÇÃO ---

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            updateRefLink(); 
            await atualizarSaldoCarteira();
            renderShop();
            
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
                startMiningVisuals();
            }
        } catch (err) { alert("Falha ao conectar carteira."); }
    } else {
        alert("MetaMask não encontrada!");
    }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id];
        return `
            <div class="gpu-item">
                <div class="badge-profit">+${g.lucro}%</div>
                <img src="${g.img}">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>
                    ${locked ? 'LOCKED' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}

window.onload = () => { 
    renderShop(); 
    if(document.getElementById('visualGain')) {
        document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
    }
};
