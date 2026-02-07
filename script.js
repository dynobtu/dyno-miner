// --- 1. CONFIGURAÇÕES INICIAIS ---
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

let userAccount = null;
let miningInterval = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');
let lastTimestamp = localStorage.getItem('last_timestamp') || Date.now();

// --- 2. CONEXÃO E INTERFACE (RESOLVE LINK E SALDO) ---

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length > 0) {
                userAccount = accounts[0];
                
                // Atualiza Botão
                document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";

                // GERA LINK DE AFILIADO
                const inputRef = document.getElementById('refLink');
                if (inputRef) {
                    inputRef.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
                }

                await atualizarDadosInterface();
                renderShop();
                
                if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
                    startMiningVisuals();
                }
            }
        } catch (err) { 
            console.error(err);
            alert("Erro ao conectar. Verifique se a MetaMask está aberta."); 
        }
    } else { alert("Instale a MetaMask!"); }
}

async function atualizarDadosInterface() {
    if (!userAccount || !window.ethereum) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        
        // SALDO REAL (RESOLVE 0.00)
        const [balance, decimals] = await Promise.all([
            contract.balanceOf(userAccount),
            contract.decimals()
        ]);
        
        const formatado = ethers.utils.formatUnits(balance, decimals);
        document.getElementById('walletBalance').innerText = parseFloat(formatado).toFixed(2);
    } catch (e) { console.error("Erro ao carregar saldo:", e); }
}

// --- 3. MINERAÇÃO E CÁLCULOS ---

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
    miningInterval = setInterval(() => {
        const gainSec = calculateHourlyGain() / 3600;
        if (gainSec > 0) {
            visualBalance += gainSec;
            localStorage.setItem('saved_mining_balance', visualBalance.toString());
            document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
            document.getElementById('hashrate').innerText = (gainSec * 360000).toFixed(0) + " H/s";
        }
        updateTimer();
    }, 1000);
}

// --- 4. AÇÕES DE COMPRA E ATIVAÇÃO ---

async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira primeiro!");
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        
        // Transação para a carteira receptora
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpu.custo, 18));
        await tx.wait();
        
        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        renderShop();
        atualizarDadosInterface();
        alert("Sucesso! Hardware adquirido.");
    } catch (e) { alert("Erro na transação. Verifique seu saldo de $DYNO."); }
}

function activateMining() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(calculateHourlyGain() <= 0) return alert("Compre um Dyno para começar!");
    
    lastActivation = Date.now();
    localStorage.setItem('last_mining_activation', lastActivation);
    startMiningVisuals();
}

function updateTimer() {
    if (!lastActivation) return;
    const tempo = (parseInt(lastActivation) + 86400000) - Date.now();
    const btn = document.getElementById('btnActivate');
    const timerDisplay = document.getElementById('activationTimer');

    if (tempo > 0) {
        if(btn) { btn.disabled = true; btn.style.opacity = "0.5"; }
        const h = Math.floor(tempo / 3600000), m = Math.floor((tempo % 3600000) / 60000), s = Math.floor((tempo % 60000) / 1000);
        if(timerDisplay) timerDisplay.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else if (btn) {
        btn.disabled = false; btn.style.opacity = "1";
    }
}

// --- 5. RENDERIZAÇÃO ---

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const comprado = purchaseHistory[g.id];
        return `<div class="gpu-item">
            <div class="badge-profit">+${g.lucro}%</div>
            <img src="${g.img}">
            <h4>${g.nome}</h4>
            <p>${g.custo} $DYNO</p>
            <button onclick="buyGPU(${i})" ${comprado ? 'disabled' : ''}>${comprado ? 'ADQUIRIDO' : 'COMPRAR'}</button>
        </div>`;
    }).join('');
}

window.onload = () => {
    renderShop();
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
    setInterval(updateTimer, 1000);
};
