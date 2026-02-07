// --- 1. CONFIGURAÇÕES ---
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

// --- 2. ESTADO E MEMÓRIA ---
let userAccount = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 3. CONEXÃO E SALDO (CORREÇÃO 0.00) ---

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            // Gera link e busca saldo
            const inputRef = document.getElementById('refLink');
            if(inputRef) inputRef.value = window.location.origin + window.location.pathname + "?ref=" + userAccount.toLowerCase();
            
            await atualizarSaldo();
            renderShop();
            if(lastActivation) checkMiningStatus();
        } catch (e) { alert("Falha ao conectar."); }
    } else { alert("MetaMask não encontrada!"); }
}

async function atualizarSaldo() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const dec = await contract.decimals();
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, dec)).toFixed(2);
    } catch (e) { console.error(e); }
}

// --- 4. MINERAÇÃO E CRONÔMETRO (TRAVA 24H) ---

function calculateGain() {
    let total = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const g = gpus.find(x => x.id == id);
        if(g) total += (parseFloat(g.custo) * (g.lucro/100)) / 24;
    });
    return total;
}

function activateMining() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(calculateGain() <= 0) return alert("Compre um Dyno primeiro!");
    
    lastActivation = Date.now();
    localStorage.setItem('last_mining_activation', lastActivation);
    checkMiningStatus();
}

function checkMiningStatus() {
    const agora = Date.now();
    const expira = parseInt(lastActivation) + 86400000;
    
    if (agora < expira) {
        const btn = document.getElementById('btnActivate');
        if(btn) { btn.disabled = true; btn.style.opacity = "0.5"; }
        
        // Inicia loop de mineração e cronômetro
        const timer = setInterval(() => {
            const rest = expira - Date.now();
            if (rest <= 0) {
                clearInterval(timer);
                if(btn) { btn.disabled = false; btn.style.opacity = "1"; }
                return;
            }
            // Atualiza saldo visual
            visualBalance += (calculateGain() / 3600);
            localStorage.setItem('saved_mining_balance', visualBalance.toString());
            document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
            
            // Atualiza Cronômetro
            const h = Math.floor(rest/3600000), m = Math.floor((rest%3600000)/60000), s = Math.floor((rest%60000)/1000);
            document.getElementById('activationTimer').innerText = `${h}:${m}:${s}`;
        }, 1000);
    }
}

// --- 5. COMPRA E LOJA ---

async function buyGPU(i) {
    if(!userAccount) return alert("Conecte a carteira!");
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpus[i].custo, 18));
        await tx.wait();
        purchaseHistory[gpus[i].id] = true;
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        renderShop();
        atualizarSaldo();
        alert("Sucesso!");
    } catch (e) { alert("Verifique seu saldo de $DYNO."); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const dono = purchaseHistory[g.id];
        return `<div class="gpu-item">
            <div class="badge-profit">+${g.lucro}%</div>
            <img src="${g.img}">
            <h4>${g.nome}</h4>
            <button onclick="buyGPU(${i})" ${dono ? 'disabled' : ''}>${dono ? 'ADQUIRIDO' : 'COMPRAR'}</button>
        </div>`;
    }).join('');
}

window.onload = () => { 
    renderShop(); 
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
};
