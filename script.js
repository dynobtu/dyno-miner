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
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 3. CONEXÃO E CHECAGEM DE SALDO (O QUE FALTA) ---

async function atualizarDadosInterface() {
    if (!userAccount || !window.ethereum) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Verifica se está na rede correta (BSC ID: 56 ou 0x38)
        const { chainId } = await provider.getNetwork();
        if (chainId !== 56) {
            alert("Por favor, mude sua MetaMask para a rede Binance Smart Chain!");
        }

        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        
        // Busca saldo real do token no contrato
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        const saldoFormatado = ethers.utils.formatUnits(balance, decimals);
        
        // Atualiza o visor de saldo em carteira
        const display = document.getElementById('walletBalance');
        if(display) display.innerText = parseFloat(saldoFormatado).toFixed(2);
        
        // Gera o link de indicação
        const inputRef = document.getElementById('refLink');
        if (inputRef) {
            inputRef.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
        }
    } catch (e) {
        console.error("Erro ao ler saldo:", e);
    }
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            await atualizarDadosInterface();
            renderShop();
            
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
                startMiningVisuals();
            }
        } catch (err) { alert("Falha ao conectar."); }
    } else { alert("Instale a MetaMask!"); }
}

// --- 4. COMPRA E MINERAÇÃO ---

async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira primeiro!");
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        
        // Tenta enviar a transação
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpu.custo, 18));
        alert("Aguardando confirmação...");
        await tx.wait();
        
        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        renderShop();
        await atualizarDadosInterface();
        alert("Compra realizada!");
    } catch (e) {
        alert("Erro na transação. Verifique se você tem saldo de $DYNO suficiente na rede BSC.");
    }
}

// --- 5. RENDERIZAÇÃO E TIMER ---

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const dono = purchaseHistory[g.id];
        return `<div class="gpu-item">
            <div class="badge-profit">+${g.lucro}%</div>
            <img src="${g.img}">
            <h4>${g.nome}</h4>
            <p>${g.custo} $DYNO</p>
            <button onclick="buyGPU(${i})" ${dono ? 'disabled' : ''}>${dono ? 'ADQUIRIDO' : 'COMPRAR'}</button>
        </div>`;
    }).join('');
}

function updateTimer() {
    if (!lastActivation) return;
    const tempo = (parseInt(lastActivation) + 86400000) - Date.now();
    const btn = document.getElementById('btnActivate');
    if (tempo > 0 && btn) {
        btn.disabled = true;
        const h = Math.floor(tempo / 3600000), m = Math.floor((tempo % 3600000) / 60000), s = Math.floor((tempo % 60000) / 1000);
        document.getElementById('activationTimer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else if (btn) {
        btn.disabled = false;
    }
}

window.onload = () => { 
    renderShop(); 
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
    setInterval(updateTimer, 1000);
};
