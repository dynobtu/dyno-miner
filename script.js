// --- CONFIGURAÇÕES ---
const receptorPagamento = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenContract = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const tokenABI = ["function transfer(address to, uint256 amount) public returns (bool)"];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: "50", img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: "150", img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: "300", img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: "600", img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: "1500", img: "SUPER LENDÁRIO.png" }
];

let userAccount = null;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};

function showToast(text, isError = false) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.style.cssText = `background:${isError?'#ff4141':'#00ff41'}; color:#000; padding:15px; margin-top:10px; font-weight:bold; border:1px solid #fff;`;
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            showToast("CARTEIRA CONECTADA!");
            renderShop();
        } catch (e) { showToast("ERRO AO CONECTAR", true); }
    } else { showToast("INSTALE METAMASK", true); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `
            <div class="gpu-item" style="border:1px solid #00ff41; padding:10px; text-align:center; background:#000;">
                <img src="${g.img}" style="width:100%; margin-bottom:10px;" onerror="this.src='https://via.placeholder.com/150?text=DYNO'">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" style="width:100%; background:${locked?'#333':'#00ff41'};" ${locked?'disabled':''}>
                    ${locked ? 'LOCKED' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}

async function buyGPU(index) {
    if(!userAccount) return showToast("CONECTE A CARTEIRA!", true);
    const gpu = gpus[index];
    
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenContract, tokenABI, signer);
        const val = ethers.utils.parseUnits(gpu.custo, 18);

        showToast("AUTORIZE O PAGAMENTO NA METAMASK...");
        const tx = await contract.transfer(receptorPagamento, val);
        await tx.wait();

        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        showToast("COMPRA CONCLUÍDA!");
        renderShop();
    } catch (e) { showToast("FALHA NA TRANSAÇÃO", true); }
}

function obterDyno() {
    window.open("https://pancakeswap.finance/swap?chain=bsc&inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED", "_blank");
}

function activateMining() {
    if(!userAccount) return showToast("CONECTE A CARTEIRA!", true);
    showToast("MINERAÇÃO ATIVADA POR 24H!");
    // Lógica do timer aqui...
}

window.onload = () => { renderShop(); };
