const receptor = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenAddr = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
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
let referrer = new URLSearchParams(window.location.search).get('ref');

async function updateBalance() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balanceBN = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        document.getElementById('walletBalance').innerText = ethers.utils.formatUnits(balanceBN, decimals);
    } catch (e) { console.error(e); }
}

function updateRefUI() {
    if (!userAccount) return;
    const link = window.location.origin + window.location.pathname + "?ref=" + userAccount;
    document.getElementById('refLink').value = link;
}

function copyRefLink() {
    const input = document.getElementById("refLink");
    if(!input.value) return alert("Conecte a carteira!");
    input.select();
    document.execCommand("copy");
    alert("Link de indicação copiado!");
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            await updateBalance();
            updateRefUI();
            renderShop();
        } catch (e) { alert("Conexão recusada!"); }
    } else { alert("Instale a MetaMask!"); }
}

async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira!");
    const gpu = gpus[index];
    
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        const amount = ethers.utils.parseUnits(gpu.custo, 18);

        const tx = await contract.transfer(receptor, amount);
        alert("Processando compra...");
        await tx.wait();

        // Lógica de Bônus 5%
        if (referrer && referrer.toLowerCase() !== userAccount.toLowerCase()) {
            const bonus = parseFloat(gpu.custo) * 0.05;
            console.log("Bônus registrado para " + referrer + ": " + bonus + " $DYNO");
            // Nota: Amanhã integraremos isso ao Banco de Dados para somar no painel do padrinho
        }

        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        await updateBalance();
        renderShop();
        alert("Sucesso! Hardware adquirido.");
    } catch (e) { alert("Transação falhou."); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `
            <div class="gpu-item">
                <img src="${g.img}" onerror="this.src='https://via.placeholder.com/150?text=DYNO'">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''} 
                        style="background: ${locked ? '#333' : '#00ff41'}">
                    ${locked ? 'LOCKED' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}

function obterDyno() {
    window.open("https://pancakeswap.finance/swap?chain=bsc&inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED", "_blank");
}

function initMatrix() {
    const c = document.getElementById('matrixCanvas');
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
