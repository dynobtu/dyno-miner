// 1. CONFIGURAÇÕES FIXAS
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
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};

// 2. CONEXÃO COM A CARTEIRA (Resolve "Falha ao conectar")
async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accounts[0];
            
            // Atualiza o texto do botão para o endereço da carteira
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            // SÓ GERA O LINK E BUSCA SALDO SE CONECTAR
            gerarLinkAfiliado();
            await atualizarSaldo();
            renderShop();
            
        } catch (error) {
            console.error(error);
            alert("Erro: Você precisa autorizar a conexão na MetaMask.");
        }
    } else {
        alert("Instale a MetaMask para jogar!");
    }
}

// 3. BUSCA SALDO REAL (Resolve o 0.00)
async function atualizarSaldo() {
    if (!userAccount) return;
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);
        
        const balance = await contract.balanceOf(userAccount);
        const decimals = await contract.decimals();
        const saldoFormatado = ethers.utils.formatUnits(balance, decimals);
        
        document.getElementById('walletBalance').innerText = parseFloat(saldoFormatado).toFixed(2);
    } catch (e) {
        console.error("Erro ao ler saldo:", e);
    }
}

// 4. GERA LINK DE AFILIADO
function gerarLinkAfiliado() {
    const input = document.getElementById('refLink');
    if (userAccount && input) {
        input.value = window.location.origin + window.location.pathname + "?ref=" + userAccount.toLowerCase();
    }
}

// 5. COMPRA DE HARDWARE (Resolve erro de transação)
async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira primeiro!");
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        
        // Verifica saldo antes de gastar taxa de gás
        const balance = await contract.balanceOf(userAccount);
        const custoWei = ethers.utils.parseUnits(gpu.custo, 18);
        
        if (balance.lt(custoWei)) {
            return alert("Saldo insuficiente de $DYNO!");
        }

        const tx = await contract.transfer(receptor, custoWei);
        alert("Transação enviada! Aguarde...");
        await tx.wait();
        
        purchaseHistory[gpu.id] = true;
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        renderShop();
        await atualizarSaldo();
        alert("Dyno adquirido com sucesso!");
    } catch (e) {
        alert("Erro na transação. Verifique se está na rede BSC.");
    }
}

// 6. RENDERIZAR LOJA
function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const isBought = purchaseHistory[g.id];
        return `
            <div class="gpu-item">
                <div class="badge-profit">+${g.lucro}%</div>
                <img src="${g.img}">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${isBought ? 'disabled' : ''}>
                    ${isBought ? 'ADQUIRIDO' : 'COMPRAR'}
                </button>
            </div>`;
    }).join('');
}

window.onload = renderShop;
