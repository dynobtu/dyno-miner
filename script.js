// CONFIGURAÇÕES GERAIS
const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";

// ABI LEGÍVEL (Suficiente para saldo e transferência)
const tokenABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: "50", img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: "150", img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: "300", img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: "600", img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: "1500", img: "SUPER LENDÁRIO.png" }
];

let userAccount = null;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};

// FUNÇÃO PARA ATUALIZAR O SALDO NA TELA
async function updateBalance() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        
        const balanceBN = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        const formattedBalance = ethers.utils.formatUnits(balanceBN, decimals);

        // Atualiza o card "SALDO EM CARTEIRA"
        const balanceElement = document.getElementById('walletBalance');
        if (balanceElement) {
            balanceElement.innerText = parseFloat(formattedBalance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
    } catch (e) {
        console.error("Erro ao buscar saldo:", e);
    }
}

// CONECTAR CARTEIRA (FORÇA POPUP)
async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            await updateBalance(); // Busca o saldo logo após conectar
            renderShop();
            alert("CONECTADO E SALDO ATUALIZADO!");
        } catch (e) { alert("CONEXÃO RECUSADA!"); }
    } else { alert("INSTALE A METAMASK!"); }
}

// COMPRAR COM AUTORIZAÇÃO REAL
async function buyGPU(index) {
    if(!userAccount) return alert("CONECTE A CARTEIRA PRIMEIRO!");
    const gpu = gpus[index];
    
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        const amount = ethers.utils.parseUnits(gpu.custo, 18);

        alert("SOLICITANDO PAGAMENTO DE " + gpu.custo + " $DYNO...");
        const tx = await contract.transfer(receptor, amount);
        await tx.wait(); 

        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        
        await updateBalance(); // Atualiza saldo após a compra
        alert("COMPRA REALIZADA COM SUCESSO!");
        renderShop();
    } catch (e) { alert("FALHA NA TRANSAÇÃO!"); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if (!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `
            <div class="gpu-item">
                <img src="${g.img}" onerror="this.src='https://via.placeholder.com/150?text=DYNO'">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>
                    ${locked ? 'LOCKED' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}

// MATRIX EFFECT E LINKS
function obterDyno() {
    window.open("https://pancakeswap.finance/swap?chain=bsc&inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED", "_blank");
}

function initMatrix() {
    const c = document.getElementById('matrixCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = 160;
    const drops = Array(Math.floor(c.width/14)).fill(1);
    setInterval(() => {
        ctx.fillStyle = "rgba(0,0,0,0.05)"; ctx.fillRect(0,0,c.width,c.height);
        ctx.fillStyle = "#00ff41";
        drops.forEach((y, i) => {
            ctx.fillText("01"[Math.floor(Math.random()*2)], i*14, y*14);
            if(y*14 > c.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        });
    }, 50);
}

window.onload = () => { renderShop(); initMatrix(); };
