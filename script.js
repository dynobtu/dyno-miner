const projectWallet = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenContractAddress = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const DB_VERSION = "DYNO_V2_PRO_FINAL"; 

const supabaseUrl = 'https://tdzwbddisdrikzztqoze.supabase.co';
const supabaseKey = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: 50, lucro10d: 5, poder: 10, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: 150, lucro10d: 7, poder: 35, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: 300, lucro10d: 10, poder: 120, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: 600, lucro10d: 15, poder: 450, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: 1500, lucro10d: 25, poder: 1500, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null, balance = 0.0, purchaseHistory = {};

// --- EFEITO MATRIX ---
const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d');
let columns, drops;

function initMatrix() {
    const header = document.querySelector('header');
    if(!header) return;
    canvas.width = header.offsetWidth;
    canvas.height = header.offsetHeight;
    columns = canvas.width / 14;
    drops = Array(Math.floor(columns)).fill(1);
}

function drawMatrix() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff41";
    ctx.font = "14px monospace";
    for (let i = 0; i < drops.length; i++) {
        const text = "01$DYNO".charAt(Math.floor(Math.random() * 7));
        ctx.fillText(text, i * 14, drops[i] * 14);
        if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
}

// --- CONEXÃO ---
async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            renderShop();
            updateUI();
        } catch (e) { console.error(e); }
    }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        return `<div class="gpu-item">
            <img src="${g.img}" style="width:100%;" onerror="this.src='https://via.placeholder.com/150?text=Dyno'">
            <h4>${g.nome}</h4>
            <p>${g.custo} $DYNO</p>
            <button class="btn-buy" onclick="buyGPU(${i})">ADQUIRIR</button>
        </div>`;
    }).join('');
}

function updateUI() {
    if(!userAccount) return;
    document.getElementById('visualGain').innerText = balance.toFixed(6);
}

window.onload = () => {
    initMatrix();
    setInterval(drawMatrix, 50);
    renderShop();
};
