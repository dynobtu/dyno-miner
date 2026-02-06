const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const receptor = '0xe097661503B830ae10e91b01885a4b767A0e9107';
const tokenAddr = '0xDa9756415A5D92027d994Fd33aC1823bA2fdc9ED';
const tokenABI = [
    'function transfer(address to, uint256 amount) public returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

const gpus = [
    { id: 1, nome: 'Dyno Normal', custo: '100', lucro: 5, img: 'NORMAL.png' },
    { id: 2, nome: 'Dyno Raro', custo: '200', lucro: 10, img: 'RARO.png' },
    { id: 3, nome: 'Dyno Épico', custo: '400', lucro: 15, img: 'ÉPICO.png' },
    { id: 4, nome: 'Dyno Lendário', custo: '800', lucro: 20, img: 'LENDÁRIO.png' },
    { id: 5, nome: 'Super Lendário', custo: '1600', lucro: 25, img: 'SUPER LENDÁRIO.png' }
];

let userAccount = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    let html = '';
    gpus.forEach(function(g, i) {
        const locked = purchaseHistory[g.id];
        html += '<div class="gpu-item">';
        html += '<div class="badge-profit">+' + g.lucro + '%</div>';
        html += '<img src="' + g.img + '">';
        html += '<h4>' + g.nome + '</h4>';
        html += '<p>' + g.custo + ' $DYNO</p>';
        html += '<button onclick="buyGPU(' + i + ')" ' + (locked ? 'disabled' : '') + '>';
        html += (locked ? 'LOCKED' : 'ADQUIRIR') + '</button></div>';
    });
    grid.innerHTML = html;
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + '...';
            renderShop();
        } catch (e) { alert('Erro ao conectar MetaMask'); }
    } else { alert('Instale a MetaMask!'); }
}

window.onload = function() {
    renderShop();
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
};
