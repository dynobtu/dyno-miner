// --- 1. CONFIGURAÇÕES E ESTADO ---
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
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

// --- 2. FUNÇÃO DE COMPRA (ABRE METAMASK) ---

async function buyGPU(index) {
    if(!userAccount) return alert("Por favor, conecte sua carteira primeiro!");
    
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        
        // Isso fará a MetaMask abrir para confirmar o pagamento
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpu.custo, 18));
        alert("Transação enviada! Aguarde a confirmação na rede.");
        
        await tx.wait(); // Espera a rede confirmar
        
        // Registra a compra localmente e libera a mineração
        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        
        renderShop();
        await atualizarSaldoCarteira();
        alert("Parabéns! Dyno adquirido com sucesso.");
    } catch (e) {
        console.error(e);
        alert("Erro na transação. Verifique se você tem saldo de $DYNO suficiente.");
    }
}

// --- 3. FUNÇÕES DE SAQUE E LINK ---

async function solicitarSaque() {
    if (visualBalance < 100) return alert("O saque mínimo é de 100 $DYNO!");
    
    const confirmar = confirm(`Deseja sacar ${visualBalance.toFixed(2)} $DYNO?\n(Taxa de 5% será aplicada)`);
    if (confirmar) {
        // Envia para sua tabela de saques no Supabase
        const { error } = await _supabase.from('saques_pendentes').insert([{ 
            carteira_usuario: userAccount.toLowerCase(), 
            valor_solicitado: visualBalance 
        }]);
        
        if (!error) {
            visualBalance = 0;
            localStorage.setItem('saved_mining_balance', "0");
            document.getElementById('visualGain').innerText = "0.000000";
            alert("Solicitação enviada! O prazo de pagamento é de até 24h.");
        }
    }
}

function copyRefLink() {
    const input = document.getElementById("refLink");
    if (!input || !input.value) return alert("Conecte a carteira para gerar seu link!");
    
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Link de indicação copiado!");
}

// --- 4. FUNÇÕES DE INICIALIZAÇÃO (NECESSÁRIAS PARA OS BOTÕES FUNCIONAREM) ---

async function connectWallet() {
    if (window.ethereum) {
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        
        await atualizarSaldoCarteira();
        updateRefUI();
        renderShop();
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
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>${locked ? 'LOCKED' : 'ADQUIRIR'}</button>
            </div>`;
    }).join('');
}

function updateRefUI() {
    const input = document.getElementById('refLink');
    if (userAccount && input) {
        input.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
    }
}

// Inicializa a loja ao carregar
window.onload = () => { 
    renderShop();
};
