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
let miningInterval = null;
let visualBalance = 0.000000;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let referrer = new URLSearchParams(window.location.search).get('ref');

// --- CORREÇÃO: OBTER DYNO (Link Pancake) ---
function obterDyno() {
    window.open("https://pancakeswap.finance/swap?chain=bsc&inputCurrency=0x55d398326f99059fF775485246999027B3197955&outputCurrency=0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED", "_blank");
}

// --- CORREÇÃO: GERAR LINK DE INDICAÇÃO ---
function updateRefUI() {
    const refInput = document.getElementById('refLink'); // Verifique se o ID no HTML é este
    if (userAccount && refInput) {
        const link = window.location.origin + window.location.pathname + "?ref=" + userAccount;
        refInput.value = link;
        console.log("Link de indicação gerado: " + link);
    }
}

function copyRefLink() {
    const input = document.getElementById("refLink");
    if(!input || !input.value) return alert("Conecte a carteira para gerar seu link!");
    input.select();
    input.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(input.value);
    alert("Link de indicação copiado com sucesso!");
}

async function updateBalance() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        const balanceBN = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        // Formata para 2 casas decimais como no seu print
        const formatted = ethers.utils.formatUnits(balanceBN, decimals);
        document.getElementById('walletBalance').innerText = parseFloat(formatted).toLocaleString('pt-BR', {minimumFractionDigits: 2});
    } catch (e) { console.error("Erro ao atualizar saldo:", e); }
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            await updateBalance();
            updateRefUI(); // Chama a geração do link assim que conecta
            renderShop();
        } catch (e) { alert("Conexão recusada!"); }
    } else { alert("Instale a MetaMask!"); }
}

// Lógica de Mineração (Matemática Real 10 dias)
function calculateHourlyGain() {
    let totalHourly = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const gpu = gpus.find(g => g.id == id);
        if (gpu) {
            let totalComLucro = parseFloat(gpu.custo) * (1 + (gpu.lucro / 100));
            totalHourly += (totalComLucro / 10) / 24;
        }
    });
    return totalHourly;
}

function activateMining() {
    if(!userAccount) return alert("CONECTE A CARTEIRA!");
    const hourlyGain = calculateHourlyGain();
    if(hourlyGain <= 0) return alert("ADQUIRA UM DYNO NO MERCADO!");

    alert("⚡ MINERAÇÃO ATIVADA!");
    if(miningInterval) clearInterval(miningInterval);
    
    miningInterval = setInterval(() => {
        visualBalance += (hourlyGain / 3600);
        document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
        document.getElementById('hashrate').innerText = (hourlyGain * 100).toFixed(0);
    }, 1000);
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
        alert("Aguardando confirmação da rede...");
        await tx.wait();

        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        
        await updateBalance();
        renderShop();
        alert("Hardware adquirido com sucesso!");
    } catch (e) { alert("Erro ou cancelamento da transação."); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `
            <div class="gpu-item">
                <div class="badge-profit">+${g.lucro}%</div>
                <img src="${g.img}" onerror="this.src='https://via.placeholder.com/150?text=DYNO'">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>
                    ${locked ? 'LOCKED' : 'ADQUIRIR'}
                </button>
            </div>`;
    }).join('');
}

function initMatrix() {
    const c = document.getElementById('matrixCanvas');
    if(!c) return;
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
