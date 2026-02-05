// --- CONFIGURAÇÕES DO TOKEN ---
const tokenContractAddress = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const receptorPagamento = "0xe097661503B830ae10e91b01885a4b767A0e9107"; // Sua carteira que recebe
const tokenABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: 50, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: 150, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: 300, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: 600, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: 1500, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_history')) || {};

// --- FUNÇÃO CONECTAR (PEDE PERMISSÃO) ---
async function connectWallet() {
    if (window.ethereum) {
        try {
            // Isso força o popup da MetaMask abrir para autorizar
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accounts[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            await updateBalances();
            showToast("CARTEIRA AUTORIZADA!");
            renderShop();
        } catch (e) { showToast("CONEXÃO RECUSADA!", "error"); }
    } else { showToast("INSTALE A METAMASK!", "error"); }
}

// --- FUNÇÃO COMPRAR (PEDE AUTORIZAÇÃO DE PAGAMENTO) ---
async function buyGPU(index) {
    if (!userAccount) return showToast("CONECTE A CARTEIRA PRIMEIRO!", "error");

    const gpu = gpus[index];
    
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenContractAddress, tokenABI, signer);

        showToast(`AGUARDANDO AUTORIZAÇÃO DE ${gpu.custo} $DYNO...`);

        // Converte o valor para o formato do contrato (18 decimais)
        const amount = ethers.utils.parseUnits(gpu.custo.toString(), 18);

        // ABRE O POPUP DA METAMASK PARA O USUÁRIO PAGAR
        const tx = await contract.transfer(receptorPagamento, amount);
        
        showToast("PROCESSANDO NA BLOCKCHAIN...");
        await tx.wait(); // Espera a confirmação

        // Só salva a compra se o pagamento foi feito
        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_history', JSON.stringify(purchaseHistory));
        
        showToast("COMPRA CONCLUÍDA COM SUCESSO!");
        renderShop();
    } catch (e) {
        console.error(e);
        showToast("FALHA NA TRANSAÇÃO OU SALDO INSUFICIENTE!", "error");
    }
}

// --- LINK CORRETO PANCAKESWAP ---
function obterDyno() {
    window.open("https://pancakeswap.finance/swap?chain=bsc&inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED", "_blank");
}

// --- LÓGICA DE ATIVAÇÃO (24H) ---
let timerInterval;
function activateMining() {
    if (!userAccount) return showToast("CONECTE A CARTEIRA!", "error");
    
    const startTime = Date.now();
    const endTime = startTime + (24 * 60 * 60 * 1000);
    localStorage.setItem('mining_end_' + userAccount, endTime);
    
    showToast("MINERAÇÃO INICIADA POR 24 HORAS!");
    startTimer(endTime);
}

function startTimer(endTime) {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const distance = endTime - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            document.getElementById('activationTimer').innerText = "00:00:00";
            return;
        }

        const h = Math.floor(distance / 3600000);
        const m = Math.floor((distance % 3600000) / 60000);
        const s = Math.floor((distance % 60000) / 1000);
        
        document.getElementById('activationTimer').innerText = 
            `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }, 1000);
}

// --- RENDERIZAR LOJA ---
function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if (!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const cooldown = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `
            <div class="gpu-item">
                <img src="${g.img}" onerror="this.src='https://via.placeholder.com/150'">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${cooldown ? 'disabled' : ''}>
                    ${cooldown ? 'AGUARDE 10 DIAS' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}
