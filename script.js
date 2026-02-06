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

// --- 2. ESTADO ---
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

function checkOfflineMining() {
    if (!lastActivation || calculateHourlyGain() <= 0) return;
    const agora = Date.now();
    const fim = parseInt(lastActivation) + 86400000;
    const limite = agora > fim ? fim : agora;
    const tempoPassado = limite - parseInt(lastTimestamp);
    
    if (tempoPassado > 0) {
        visualBalance += (calculateHourlyGain() / 3600) * (tempoPassado / 1000);
        localStorage.setItem('saved_mining_balance', visualBalance.toString());
    }
    localStorage.setItem('last_timestamp', agora.toString());
}

function startMiningVisuals() {
    if(miningInterval) clearInterval(miningInterval);
    checkOfflineMining();
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

// --- 4. COMPRA E INDICAÇÃO ---

async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira primeiro!");
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        
        // Enviar transação
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpu.custo, 18));
        alert("Aguardando confirmação da rede...");
        await tx.wait();
        
        // Registrar compra localmente
        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        
        // Tentar registrar indicação no Supabase se houver ref na URL
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref');
        if (ref && ref.toLowerCase() !== userAccount.toLowerCase()) {
            await _supabase.from('indicacoes').insert([{ padrinho: ref.toLowerCase(), filho: userAccount.toLowerCase(), valor: gpu.custo }]);
        }

        renderShop();
        alert("Dyno adquirido com sucesso!");
    } catch (e) { 
        console.error(e);
        alert("Erro na transação. Verifique seu saldo de $DYNO."); 
    }
}

function updateRefLink() {
    const input = document.getElementById('refLink');
    if (userAccount && input) {
        const link = window.location.origin + window.location.pathname + "?ref=" + userAccount.toLowerCase();
        input.value = link;
    }
}

// --- 5. INTERFACE ---

async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        
        // Atualiza tudo após conectar
        updateRefLink(); 
        renderShop();
        
        if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
            startMiningVisuals();
        }
    }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const isBought = purchaseHistory[g.id];
        return `
            <div class="gpu-item">
                <div class="badge-profit">+${g.lucro}%</div>
                <img src="${g.img}">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${isBought ? 'disabled' : ''}>
                    ${isBought ? 'LOCKED' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}

function updateTimer() {
    if (!lastActivation) return;
    const tempo = (parseInt(lastActivation) + 86400000) - Date.now();
    const display = document.getElementById('activationTimer');
    const btn = document.getElementById('btnActivate');
    if (tempo > 0) {
        if(btn) { btn.disabled = true; btn.innerText = "MINERANDO..."; }
        const h = Math.floor(tempo / 3600000), m = Math.floor((tempo % 3600000) / 60000), s = Math.floor((tempo % 60000) / 1000);
        if(display) display.innerText = h.toString().padStart(2,'0') + ":" + m.toString().padStart(2,'0') + ":" + s.toString().padStart(2,'0');
    } else {
        if(btn) { btn.disabled = false; btn.innerText = "ATIVAR MINERAÇÃO"; }
    }
}

window.onload = () => { 
    renderShop(); 
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
    setInterval(updateTimer, 1000);
};
