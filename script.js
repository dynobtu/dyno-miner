const supabaseUrl = 'https://tdzwbddisdrikzztqoze.supabase.co';
const supabaseKey = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const gpus = [
    { id: 1, nome: "Dyno Normal", custo: 50, img: "NORMAL.png" },
    { id: 2, nome: "Dyno Raro", custo: 150, img: "RARO.png" },
    { id: 3, nome: "Dyno Épico", custo: 300, img: "ÉPICO.png" },
    { id: 4, nome: "Dyno Lendário", custo: 600, img: "LENDÁRIO.png" },
    { id: 5, nome: "Super Lendário", custo: 1500, img: "SUPER LENDÁRIO.png" }
];

let userAccount = null, balance = 0.0, isMining = false;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_history')) || {};

function showToast(text, type = 'success') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.innerText = text;
    toast.style.cssText = `background:${type==='success'?'#00ff41':'#ff4141'}; color:#000; padding:15px; margin-top:10px; font-weight:bold; border-radius:4px;`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function connectWallet() {
    if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accs = await provider.send("eth_requestAccounts", []);
        userAccount = accs[0];
        document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
        const bal = await provider.getBalance(userAccount);
        document.getElementById('walletBalance').innerText = parseFloat(ethers.utils.formatEther(bal)).toFixed(2);
        showToast("CONECTADO!");
        renderShop();
    } else { showToast("INSTALE METAMASK", "error"); }
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    grid.innerHTML = gpus.map((g, i) => {
        const cooldown = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 10*24*60*60*1000);
        return `
            <div class="gpu-item" style="border:1px solid #00ff41; padding:15px; text-align:center;">
                <img src="${g.img}" style="width:100%;" onerror="this.src='https://via.placeholder.com/150'">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${cooldown?'disabled':''}>${cooldown?'LOCKED':'ADQUIRIR'}</button>
            </div>`;
    }).join('');
}

function buyGPU(index) {
    if(!userAccount) return showToast("CONECTE A CARTEIRA!", "error");
    purchaseHistory[gpus[index].id] = Date.now();
    localStorage.setItem('dyno_history', JSON.stringify(purchaseHistory));
    showToast("COMPRA REALIZADA!");
    renderShop();
}

function activateMining() {
    if(!userAccount) return showToast("CONECTE A CARTEIRA!", "error");
    isMining = true;
    showToast("MINERAÇÃO ATIVADA POR 24H!");
}

window.onload = () => { renderShop(); initMatrix(); setInterval(drawMatrix, 50); };

// --- EFEITO MATRIX (RESTORE) ---
let canvas, ctx, columns, drops;
function initMatrix() {
    canvas = document.getElementById('matrixCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = 160;
    columns = canvas.width / 14;
    drops = Array(Math.floor(columns)).fill(1);
}
function drawMatrix() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff41";
    for(let i=0; i<drops.length; i++) {
        ctx.fillText("01".charAt(Math.floor(Math.random()*2)), i*14, drops[i]*14);
        if(drops[i]*14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
}
