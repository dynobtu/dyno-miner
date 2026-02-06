// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://tdzwbddisdrikzztqoze.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_BcNbL1tcyFRTpBRqAxgaEw_4Wq7o-tY'; // Sua chave publishable
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CONFIGURAÇÕES DO CONTRATO ---
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

// --- VARIÁVEIS DE ESTADO ---
let userAccount = null;
let miningInterval = null;
let visualBalance = parseFloat(localStorage.getItem('saved_mining_balance')) || 0;
let purchaseHistory = JSON.parse(localStorage.getItem('dyno_purchases')) || {};
let lastActivation = localStorage.getItem('last_mining_activation');

// --- 1. FUNÇÕES DO SUPABASE (BANCO DE DADOS) ---

// Busca o saldo de indicação e quantidade de indicados
async function carregarDadosIndicacao() {
    if (!userAccount) return;
    try {
        const { data, error } = await _supabase
            .from('usuarios')
            .select('ref_count, ref_earnings')
            .eq('carteira', userAccount.toLowerCase())
            .single();

        if (data) {
            document.getElementById('refCount').innerText = data.ref_count || 0;
            document.getElementById('refEarnings').innerText = (data.ref_earnings || 0).toFixed(2);
        }
    } catch (e) { console.error("Erro ao carregar dados do banco:", e); }
}

// Registra o bônus de 5% para o padrinho
async function registrarCompraNoBanco(valorGasto) {
    const urlParams = new URLSearchParams(window.location.search);
    const padrinho = urlParams.get('ref');

    if (padrinho && padrinho.toLowerCase() !== userAccount.toLowerCase()) {
        const bonus = valorGasto * 0.05;
        // Chama a função RPC que você criou no SQL Editor
        await _supabase.rpc('incrementar_indicacao', { 
            alvo: padrinho.toLowerCase(), 
            bonus: bonus 
        });
    }
}

// Grava a solicitação de saque na tabela 'saques_pendentes'
async function registrarSaqueNoBanco(valor) {
    const { error } = await _supabase
        .from('saques_pendentes')
        .insert([{ 
            carteira_usuario: userAccount, 
            valor_solicitado: valor, 
            status: 'pendente' 
        }]);
    return error;
}

// --- 2. LÓGICA DE MINERAÇÃO ---

function calculateHourlyGain() {
    let total = 0;
    Object.keys(purchaseHistory).forEach(id => {
        const gpu = gpus.find(g => g.id == id);
        if (gpu) total += ((parseFloat(gpu.custo) * (1 + gpu.lucro/100)) / 10) / 24;
    });
    return total;
}

function startMiningVisuals() {
    const gainSec = calculateHourlyGain() / 3600;
    if(miningInterval) clearInterval(miningInterval);
    
    miningInterval = setInterval(() => {
        visualBalance += gainSec;
        localStorage.setItem('saved_mining_balance', visualBalance.toString());
        document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
        document.getElementById('hashrate').innerText = (gainSec * 360000).toFixed(0);
        updateTimer();
    }, 1000);
}

// --- 3. AÇÕES DO USUÁRIO ---

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accs[0];
            document.getElementById('walletDisplay').innerText = userAccount.substring(0,6) + "...";
            
            await carregarDadosIndicacao(); // Carrega indicações ao conectar
            updateRefUI();
            renderShop();
            
            if(lastActivation && (parseInt(lastActivation) + 86400000) > Date.now()) {
                startMiningVisuals();
            }
        } catch (e) { console.error(e); }
    }
}

async function buyGPU(index) {
    if(!userAccount) return alert("Conecte a carteira!");
    const gpu = gpus[index];
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddr, tokenABI, signer);
        const tx = await contract.transfer(receptor, ethers.utils.parseUnits(gpu.custo, 18));
        
        alert("Aguardando confirmação da rede...");
        await tx.wait();
        
        await registrarCompraNoBanco(parseFloat(gpu.custo)); // Envia bônus para o Supabase

        purchaseHistory[gpu.id] = Date.now();
        localStorage.setItem('dyno_purchases', JSON.stringify(purchaseHistory));
        renderShop();
        alert("Compra realizada e bônus de indicação processado!");
    } catch (e) { alert("Erro na transação."); }
}

async function solicitarSaque() {
    if (visualBalance < 100) return alert("Saque mínimo: 100 $DYNO!");
    const liquido = visualBalance * 0.95;

    if (confirm(`Confirmar saque de ${visualBalance.toFixed(2)} $DYNO?\nLíquido (taxa 5%): ${liquido.toFixed(2)}`)) {
        const error = await registrarSaqueNoBanco(liquido); // Salva na tabela do print
        
        if (error) {
            alert("Erro ao salvar pedido no banco.");
        } else {
            alert("SOLICITAÇÃO REGISTRADA COM SUCESSO!");
            visualBalance = 0;
            localStorage.setItem('saved_mining_balance', 0);
            document.getElementById('visualGain').innerText = "0.000000";
        }
    }
}

// --- 4. UTILITÁRIOS ---

function updateTimer() {
    if (!lastActivation) return;
    const tempoRestante = (parseInt(lastActivation) + 86400000) - Date.now();
    const btn = document.getElementById('btnActivate');
    const display = document.getElementById('activationTimer');

    if (tempoRestante > 0) {
        btn.disabled = true;
        const h = Math.floor(tempoRestante / 3600000);
        const m = Math.floor((tempoRestante % 3600000) / 60000);
        const s = Math.floor((tempoRestante % 60000) / 1000);
        display.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else {
        btn.disabled = false;
        display.innerText = "00:00:00";
    }
}

function activateMining() {
    if(!userAccount) return alert("Conecte a carteira!");
    if(calculateHourlyGain() <= 0) return alert("Você precisa de um Dyno para minerar!");
    lastActivation = Date.now();
    localStorage.setItem('last_mining_activation', lastActivation);
    startMiningVisuals();
}

function renderShop() {
    const grid = document.getElementById('gpu-grid');
    if(!grid) return;
    grid.innerHTML = gpus.map((g, i) => {
        const locked = purchaseHistory[g.id] && (Date.now() - purchaseHistory[g.id] < 864000000);
        return `
            <div class="gpu-item">
                <div class="badge-profit">+${g.lucro}%</div>
                <img src="${g.img}">
                <h4>${g.nome}</h4>
                <p>${g.custo} $DYNO</p>
                <button onclick="buyGPU(${i})" ${locked ? 'disabled' : ''}>${locked ? 'LOCKED' : 'ADQUIRIR'}</button>
            </div>`;
    }).join('');
}

function updateRefUI() {
    const input = document.getElementById('refLink');
    if (userAccount && input) input.value = window.location.origin + window.location.pathname + "?ref=" + userAccount;
}

function copyRefLink() {
    const input = document.getElementById("refLink");
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Copiado!");
}

window.onload = () => { 
    renderShop(); 
    document.getElementById('visualGain').innerText = visualBalance.toFixed(6);
};
