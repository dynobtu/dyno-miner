// CONFIGURAÇÕES BÁSICAS
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const receptor = '0xe097661503B830ae10e91b01885a4b767A0e9107';
const tokenAddr = '0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED';
const tokenABI = [
    'function transfer(address to, uint256 amount) public returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

const gpus = [
    { id: 1, nome: 'Dyno Normal', custo: '100', lucro: 5, img: 'NORMAL.png' },
    { id: 2, nome: 'Dyno Raro', custo: '200', lucro: 10, img: 'RARO.png' },
    { id: 3, nome: 'Dyno Épico', custo: '400', lucro: 15, img: 'ÉPICO.png' },
    { id: 4, nome: 'Dyno Lendário', custo: '800', lucro: 20, img: 'LENDÁRIO.png' },
    { id: 5, nome: 'Super Lendário', custo: '1600', lucro: 25, img: 'SUPER LENDÁRIO.png' }
];

let userAccount = null;
let miningInterval = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// MOTOR DE MINERAÇÃO
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
            if(document.getElementById('visualGain')) document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
        }
        updateTimer();
    }, 1000);
}

// INTERFACE
async function atualizarDadosInterface() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, 18)).toFixed(2);
        document.getElementById('refLink').value = window.location.origin + window.location.pathname + '?ref=' + userAccount.toLowerCase();
        document.getElementById('hashrate').innerText = (calculateHourlyGain() * 100).toFixed(0) + ' H/s';
    } catch (e) { console.error(e); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    let html = '';
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

// BOTÕES
async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + '...';
        await atualizarDadosInterface();
        renderShop();
        if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) startMiningVisuals();
    }
}

function activateMining() {
    if(!userAccount || calculateHourlyGain() <= 0) return alert('Conecte ou compre um Dyno!');
    lastActivation = Date.now();
    localStorage.setItem('last_mining_activation', lastActivation);
    startMiningVisuals();
    alert('Mineração Ativada!');
}

async function solicitarSaque() {
    if(visualBalance < 100) return alert('Mínimo 100 $DYNO');
    const { error } = await _supabase.from('saques_pendentes').insert([{ carteira_usuario: userAccount.toLowerCase(), valor_solicitado: visualBalance }]);
    if(!error) {
        visualBalance = 0;
        localStorage.setItem('saved_mining_balance', '0');
        document.getElementById('visualGain').innerText = '0.000000';
        alert('Saque solicitado!');
    }
}

async function buyGPU(index) {
    if(!userAccount) return alert('Conecte a carteira!');
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
    } catch (e) { alert('Erro na transação.'); }
}

function updateTimer() {
    if (!lastActivation) return;
    const tempo = (parseInt(lastActivation) + 86400000) - Date.now();
    const display = document.getElementById('activationTimer');
    if (tempo > 0 && display) {
        const h = Math.floor(tempo / 3600000), m = Math.floor((tempo % 3600000) / 60000), s = Math.floor((tempo % 60000) / 1000);
        display.innerText = h.toString().padStart(2,'0') + ':' + m.toString().padStart(2,'0') + ':' + s.toString().padStart(2,'0');
    }
}

window.onload = async () => {
    renderShop();
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            userAccount = accounts[0];
            await atualizarDadosInterface();
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) startMiningVisuals();
        }
    }
};
