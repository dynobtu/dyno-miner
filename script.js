// --- 1. CONFIGURAÇÕES ---
const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33ac1823bA2fdc9ED";
const tokenABI = ["function transfer(address to, uint256 amount) public returns (bool)", "function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)"];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: "100", lucro: 5 },
    { id: 2, nome: "Dyno Raro", custo: "200", lucro: 10 },
    { id: 3, nome: "Dyno Épico", custo: "400", lucro: 15 },
    { id: 4, nome: "Dyno Lendário", custo: "800", lucro: 20 },
    { id: 5, nome: "Super Lendário", custo: "1600", lucro: 25 }
];

// --- 2. ESTADO (RECUPERAÇÃO DE DADOS) ---
let userAccount = null;
// Recupera o saldo salvo ou começa em 0
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 3. LÓGICA DE MINERAÇÃO (SALVAMENTO CONSTANTE) ---

function getLucroPorSegundo() {
    let lucroTotalHora = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const g = gpus.find(x => x.id == id);
        if(g) lucroTotalHora += (parseFloat(g.custo) * (g.lucro/100)) / 24;
    });
    return lucroTotalHora / 3600;
}

function iniciarMineracao() {
    const expira = parseInt(lastActivation) + 86400000;
    const btn = document.getElementById('btnActivate');
    
    // Bloqueia botão se estiver ativo
    if (Date.now() < expira && btn) { 
        btn.disabled = true; 
        btn.style.opacity = "0.5"; 
    }

    const timer = setInterval(() => {
        const agora = Date.now();
        const rest = expira - agora;

        if (rest <= 0) {
            clearInterval(timer);
            if(btn) btn.disabled = false;
            return;
        }

        // Soma o lucro e SALVA no localStorage para não sumir ao atualizar
        const lucroSec = getLucroPorSegundo();
        if (lucroSec > 0) {
            visualBalance += lucroSec;
            localStorage.setItem('saved_mining_balance', visualBalance.toString());
            document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
            document.getElementById('hashrate').innerText = (lucroSec * 1000000).toFixed(0) + " H/s";
        }

        // Atualiza Timer
        const h = Math.floor(rest/3600000), m = Math.floor((rest%3600000)/60000), s = Math.floor((rest%60000)/1000);
        document.getElementById('activationTimer').innerText = `${h}:${m}:${s}`;
    }, 1000);
}

// --- 4. INTERFACE E BOTÕES ---

async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        
        // Gera link de afiliado
        const inputRef = document.getElementById('refLink');
        if(inputRef) inputRef.value = window.location.origin + window.location.pathname + "?ref=" + userAccount.toLowerCase();
        
        await atualizarSaldoCarteira();
        if(lastActivation) iniciarMineracao();
    }
}

function copiarLink() {
    const copyText = document.getElementById("refLink");
    if (!copyText || !copyText.value || copyText.value.includes("Conecte")) return alert("Conecte a carteira!");
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    alert("Link copiado!");
}

async function atualizarSaldoCarteira() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const dec = await contract.decimals();
        // Atualiza saldo em carteira
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, dec)).toFixed(2);
    } catch (e) { console.error(e); }
}

// --- 5. INICIALIZAÇÃO ---
window.onload = () => {
    // Mostra o saldo que estava salvo antes de fechar a página
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
    
    // Verifica se houve lucro enquanto estava offline
    if (lastActivation) {
        const agora = Date.now();
        const expira = parseInt(lastActivation) + 86400000;
        const ultimaVez = parseInt(localStorage.getItem('last_timestamp')) || agora;
        
        if (agora > ultimaVez) {
            const tempoPassado = (agora > expira ? expira : agora) - ultimaVez;
            const ganhoOffline = (getLucroPorSegundo() * (tempoPassado / 1000));
            visualBalance += ganhoOffline;
            localStorage.setItem('saved_mining_balance', visualBalance.toString());
        }
    }
    localStorage.setItem('last_timestamp', Date.now().toString());
};
