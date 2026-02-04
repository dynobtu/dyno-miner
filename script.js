// --- CONFIGURAÇÕES DO PROJETO ---
const projectWallet = "0xe097661503B830ae10e91b01885a4b767A0e9107";
const tokenContractAddress = "0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED";
const DB_VERSION = "DYNO_V2_PRO_FINAL"; 

// --- CONFIGURAÇÃO SUPABASE ---
const supabaseUrl = 'https://tdzwbddisdrikzztqoze.supabase.co';
const supabaseKey = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: 50, poder: 10, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: 150, poder: 35, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: 300, poder: 120, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: 600, poder: 450, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: 1500, poder: 1500, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null, balance = 0.0, purchaseHistory = {};

// --- EFEITO MATRIX ---
let canvas, ctx, columns, drops;
function initMatrix() {
    canvas = document.getElementById('matrixCanvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    const header = document.querySelector('header') || { offsetWidth: window.innerWidth, offsetHeight: 150 };
    canvas.width = header.offsetWidth;
    canvas.height = header.offsetHeight;
    columns = canvas.width / 14;
    drops = Array(Math.floor(columns)).fill(1);
}

function drawMatrix() {
    if(!ctx) return;
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff41";
    ctx.font = "14px monospace";
    for (let i = 0; i < drops.length; i++) {
        const text = "01$".charAt(Math.floor(Math.random() * 3));
        ctx.fillText(text, i * 14, drops[i] * 14);
        if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
}

// --- LOGICA PRINCIPAL ---
async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            await loadUserData(userAccount);
            renderShop();
        } catch (e) { console.error("Erro ao conectar", e); }
    } else { alert("Instale a MetaMask!"); }
}

async function loadUserData(address) {
    const { data, error } = await supabaseClient.from('usuarios').select('*').eq('carteira', address.toLowerCase()).single();
    if (data) {
        balance = data.saldo_minera || 0;
        updateUI();
    } else {
        await supabaseClient.from('usuarios').insert([{ carteira: address.toLowerCase(), saldo_minera: 0 }]);
    }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => `
        <div class="gpu-item">
            <img src="${g.img}" style="width:100%" onerror="this.src='https://via.placeholder.com/150?text=Error'">
            <h4>${g.nome}</h4>
            <p>${g.custo} $DYNO</p>
            <button class="btn-buy" onclick="buyGPU(${i})">ADQUIRIR</button>
        </div>
    `).join('');
}

function updateUI() {
    const visualGain = document.getElementById('visualGain');
    if(visualGain) visualGain.innerText = balance.toFixed(6);
}

window.onload = () => {
    initMatrix();
    setInterval(drawMatrix, 50);
    renderShop();
};
window.onresize = initMatrix;
