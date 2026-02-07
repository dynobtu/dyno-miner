// ===============================
// 1. CONFIGURAÇÕES
// ===============================
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
    { id: 1, nome: "Dyno Normal", custo: "100", lucro: 5, img: "NORMAL.png", hash: 50 },
    { id: 2, nome: "Dyno Raro", custo: "200", lucro: 10, img: "RARO.png", hash: 100 },
    { id: 3, nome: "Dyno Épico", custo: "400", lucro: 15, img: "ÉPICO.png", hash: 200 },
    { id: 4, nome: "Dyno Lendário", custo: "800", lucro: 20, img: "LENDÁRIO.png", hash: 400 },
    { id: 5, nome: "Super Lendário", custo: "1600", lucro: 25, img: "SUPER LENDÁRIO.png", hash: 800 }
];

let userAccount = null;

let visualBalance = parseFloat(localStorage.getItem("saved_mining_balance")) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem("dyno_purchases")) || {};
let lastActivation = localStorage.getItem("last_mining_activation");

// ===============================
// 2. FUNÇÕES AUXILIARES
// ===============================
function formatTime(ms) {
    const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function getTotalHashrate() {
    let total = 0;
    for (const gpu of gpus) {
        if (purchaseHistory[gpu.id]) total += gpu.hash;
    }
    return total;
}

function updateHashrate() {
    const totalHash = getTotalHashrate();
    const el = document.getElementById("hashrate");
    if (el) el.innerText = totalHash.toString();
}

// ===============================
// 3. CONECTAR WALLET + REDE
// ===============================
async function connectWallet() {
    if (!window.ethereum) {
        return alert("Metamask não detectada!");
    }

    try {
        const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAccount = accs[0];

        document.getElementById("walletDisplay").innerText =
            userAccount.substring(0, 6) + "..." + userAccount.substring(userAccount.length - 4);

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();

        if (network.chainId !== 56) {
            alert("⚠️ Conecte na rede Binance Smart Chain (BSC)!");
            return;
        }

        // gerar link afiliado
        const inputRef = document.getElementById("refLink");
        if (inputRef) {
            inputRef.value = `${window.location.origin}${window.location.pathname}?ref=${userAccount.toLowerCase()}`;
        }

        await atualizarSaldo();
        renderShop();
        updateHashrate();

        if (lastActivation) iniciarMineracao();

    } catch (e) {
        console.error(e);
        alert("Erro ao conectar carteira.");
    }
}

// Atualiza ao trocar de conta
if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
            userAccount = accounts[0];
            connectWallet();
        }
    });

    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}

// ===============================
// 4. SALDO TOKEN
// ===============================
async function atualizarSaldo() {
    if (!userAccount) return;

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(tokenAddr, tokenABI, provider);

        const balance = await contract.balanceOf(userAccount);
        const dec = await contract.decimals();

        const formatted = ethers.utils.formatUnits(balance, dec);
        document.getElementById("walletBalance").innerText = parseFloat(formatted).toFixed(2);

    } catch (e) {
        console.error("Erro ao atualizar saldo:", e);
    }
}

// ===============================
// 5. LINK AFILIADO
// ===============================
function copyRefLink() {
    const input = document.getElementById("refLink");

    if (!input || !input.value || input.value.includes("Conecte")) {
        return alert("Conecte a carteira para gerar seu link!");
    }

    navigator.clipboard.writeText(input.value);
    alert("✅ Link de Afiliado Copiado!");
}

// ===============================
// 6. SAQUE
// ===============================
async function solicitarSaque() {
    if (!userAccount) return alert("Conecte a carteira!");
    if (visualBalance < 100) return alert("Saque mínimo: 100 $DYNO");

    const { error } = await _supabase.from("saques_pendentes").insert([
        {
            carteira: userAccount.toLowerCase(),
            valor: visualBalance
        }
    ]);

    if (!error) {
        visualBalance = 0;
        localStorage.setItem("saved_mining_balance", "0");
        document.getElementById("visualGain").innerText = "0.000000";
        alert("✅ Saque solicitado com sucesso!");
    } else {
        console.error(error);
        alert("Erro ao processar saque.");
    }
}

// ===============================
// 7. COMPRAR GPU
// ===============================
async function buyGPU(i) {
    if (!userAccount) return alert("Conecte a carteira!");

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);

        const dec = await contract.decimals();

        const tx = await contract.transfer(
            receptor,
            ethers.utils.parseUnits(gpus[i].custo, dec)
        );

        await tx.wait();

        purchaseHistory[gpus[i].id] = Date.now();
        localStorage.setItem("dyno_purchases", JSON.stringify(purchaseHistory));

        renderShop();
        updateHashrate();
        await atualizarSaldo();

        alert("✅ Compra concluída!");

    } catch (e) {
        console.error(e);
        alert("❌ Erro na compra. Verifique saldo e se está na rede BSC.");
    }
}

// ===============================
// 8. RENDER SHOP
// ===============================
function renderShop() {
    const grid = document.getElementById("gpu-grid");
    if (!grid) return;

    grid.innerHTML = gpus.map((g, i) => {
        const dono = purchaseHistory[g.id];

        return `
        <div class="gpu-item">
            <span class="badge-profit">+${g.lucro}%</span>
            <img src="${g.img}" alt="${g.nome}">
            <h4>${g.nome}</h4>
            <p style="font-size:0.8rem; margin: 5px 0;">CUSTO: ${g.custo} DYNO</p>
            <p style="font-size:0.75rem; opacity:0.7;">HASH: ${g.hash} H/s</p>

            <button onclick="buyGPU(${i})" ${dono ? "disabled" : ""}>
                ${dono ? "LOCKED" : "ADQUIRIR"}
            </button>
        </div>`;
    }).join("");
}

// ===============================
// 9. MINERAÇÃO 24H OFFLINE
// ===============================
function activateMining() {
    if (!userAccount) return alert("Conecte a carteira!");

    lastActivation = Date.now().toString();
    localStorage.setItem("last_mining_activation", lastActivation);

    iniciarMineracao();
}

function iniciarMineracao() {
    if (!lastActivation) return;

    const inicio = parseInt(lastActivation);
    const fim = inicio + 86400000; // 24h

    const btn = document.getElementById("btnActivate");
    const timerEl = document.getElementById("activationTimer");

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
    }

    const hashrate = getTotalHashrate();

    // ganho baseado no hashrate total
    const lucroPorSegundo = hashrate > 0 ? (hashrate * 0.0000001) : 0.00001;

    const loop = setInterval(() => {
        const agora = Date.now();

        if (agora >= fim) {
            clearInterval(loop);

            if (btn) {
                btn.disabled = false;
                btn.style.opacity = "1";
            }

            if (timerEl) timerEl.innerText = "00:00:00";
            return;
        }

        const restante = fim - agora;
        if (timerEl) timerEl.innerText = formatTime(restante);

        const tempoPassado = Math.floor((agora - inicio) / 1000);
        const saldoCalculado = tempoPassado * lucroPorSegundo;

        visualBalance = saldoCalculado;
        localStorage.setItem("saved_mining_balance", visualBalance.toString());

        document.getElementById("visualGain").innerText = visualBalance.toFixed(6);

    }, 1000);
}

// ===============================
// 10. INIT
// ===============================
window.onload = () => {
    renderShop();
    updateHashrate();

    document.getElementById("visualGain").innerText = visualBalance.toFixed(6);

    if (lastActivation) {
        iniciarMineracao();
    }
};

