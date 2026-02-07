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

let userAccount = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 2. CONEXÃO E SALDO (CORREÇÃO DO 0.00) ---
async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            // Gera link imediatamente após conectar
            const inputRef = document.getElementById('refLink');
            if(inputRef) inputRef.value = window.location.origin + window.location.pathname + "?ref=" + userAccount.toLowerCase();
            
            await atualizarSaldo();
            renderShop();
            if(lastActivation) iniciarMineracao();
        } catch (e) { alert("Erro ao conectar."); }
    }
}

async function atualizarSaldo() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balance = await contract.balanceOf(userAccount);
        const dec = await contract.decimals();
        // Força o saldo a aparecer na tela
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatUnits(balance, dec)).toFixed(2);
    } catch (e) { console.error(e); }
}

// --- 3. FUNÇÃO COPIAR LINK (O QUE NÃO FUNCIONAVA) ---
function copiarLink() {
    const copyText = document.getElementById("refLink");
    if (!copyText || !copyText.value || copyText.value.includes("Conecte")) {
        return alert("Conecte a carteira para gerar seu link!");
    }
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    alert("Link de Afiliado Copiado!");
}

// --- 4. SAQUE E COMPRA ---
async function solicitarSaque() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(visualBalance < 100) return alert("Saque mínimo: 100 $DYNO");

    const { error } = await _supabase.from('saques_pendentes').insert([
        { carteira: userAccount.toLowerCase(), valor: visualBalance }
    ]);

    if(!error) {
        visualBalance = 0;
        localStorage.setItem('saved_mining_balance', "0");
        document.getElementById('visualGain').innerText = "0.000000";
        alert("Saque solicitado!");
    } else { alert("Erro ao processar saque."); }
}

async function buyGPU(i) {
    if(!userAccount) return alert("Conecte a carteira!");
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpus[i].custo, 18));
        await tx.wait();
        
        purchaseHistory[gpus[i].id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        renderShop();
        await atualizarSaldo();
        alert("Compra concluída!");
    } catch (e) { alert("Verifique seu saldo e rede BSC."); }
}

// --- 5. MINERAÇÃO E TIMER (TRAVA 24H) ---
function iniciarMineracao() {
    const expira = parseInt(lastActivation) + 86400000;
    const btn = document.getElementById('btnActivate');
    
    if (Date.now() < expira) {
        if(btn) { btn.disabled = true; btn.style.opacity = "0.5"; }
        
        const timer = setInterval(() => {
            const rest = expira - Date.now();
            if (rest <= 0) {
                clearInterval(timer);
                if(btn) btn.disabled = false;
                return;
            }
            // Atualiza cronômetro e ganhos visuais
            const h = Math.floor(rest/3600000), m = Math.floor((rest%3600000)/60000), s = Math.floor((rest%60000)/1000);
            document.getElementById('activationTimer').innerText = `${h}:${m}:${s}`;
            
            visualBalance += 0.00001; 
            document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
        }, 1000);
    }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const dono = purchaseHistory[g.id];
        return `<div class="gpu-item">
            <img src="${g.img}">
            <h4>${g.nome}</h4>
            <button onclick="buyGPU(${i})" ${dono ? 'disabled' : ''}>${dono ? 'LOCKED' : 'ADQUIRIR'}</button>
        </div>`;
    }).join('');
}

window.onload = () => { renderShop(); document.getElementById('visualGain').innerText = visualBalance.toFixed(6); };
