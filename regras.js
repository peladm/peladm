// Estado da aplicação
let regrasAtuais = {};

// Elementos DOM
const form = document.getElementById('form-regras');
const btnReset = document.getElementById('btn-reset');

// Valores padrão
const REGRAS_PADRAO = {
    duracao: 10,
    jogadores_por_time: 6,
    limite_jogadores: 30,
    vitorias_consecutivas: 3,
    prioridade_retorno: true
};

// Inicialização
document.addEventListener('DOMContentLoaded', inicializar);

async function inicializar() {
    try {
        await carregarRegras();
        configurarEventListeners();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        mostrarMensagem('❌ Erro ao carregar página de regras', 'error');
    }
}

// Event Listeners
function configurarEventListeners() {
    // Formulário
    form.addEventListener('submit', salvarRegras);
    
    // Botão de reset
    btnReset.addEventListener('click', resetarParaPadrao);
    
    // Seletores de jogadores por time
    document.querySelectorAll('.selector-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.selector-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('jogadores_por_time').value = e.target.dataset.value;
        });
    });
}

// Carregar regras do banco
async function carregarRegras() {
    try {
        const resultado = await Database.buscarRegras();
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }

        const regras = resultado.data && resultado.data.length > 0 ? resultado.data[0] : null;
        
        if (regras) {
            // Carregar regras existentes
            regrasAtuais = regras;
            preencherFormulario(regras);
        } else {
            // Criar regras padrão
            await criarRegrasPadrao();
        }
        
    } catch (error) {
        console.error('Erro ao carregar regras:', error);
        mostrarMensagem('❌ Erro ao carregar regras', 'error');
    }
}

// Criar regras padrão no banco
async function criarRegrasPadrao() {
    try {
        const resultado = await Database.criarRegras(REGRAS_PADRAO);
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        regrasAtuais = { ...REGRAS_PADRAO, ...resultado.data[0] };
        preencherFormulario(regrasAtuais);
        
    } catch (error) {
        console.error('Erro ao criar regras padrão:', error);
        // Em caso de erro, usar regras padrão localmente
        regrasAtuais = REGRAS_PADRAO;
        preencherFormulario(regrasAtuais);
    }
}

// Preencher formulário com dados
function preencherFormulario(regras) {
    document.getElementById('duracao').value = regras.duracao || 10;
    document.getElementById('limite_jogadores').value = regras.limite_jogadores || 30;
    document.getElementById('vitorias_consecutivas').value = regras.vitorias_consecutivas || 3;
    
    // Seletor de jogadores por time
    const jogadoresPorTime = regras.jogadores_por_time || 6;
    document.getElementById('jogadores_por_time').value = jogadoresPorTime;
    document.querySelectorAll('.selector-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value == jogadoresPorTime);
    });
    
    // Radio button prioridade
    const prioridade = regras.prioridade_retorno !== false; // default true
    document.getElementById('prioridade_sim').checked = prioridade;
    document.getElementById('prioridade_nao').checked = !prioridade;
}

// Função removida - não há mais exibição de regras atuais

// Salvar regras
async function salvarRegras(e) {
    e.preventDefault();
    
    try {
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `
            <span class="emoji">⏳</span>
            <span>Salvando...</span>
        `;
        
        // Coletar dados do formulário
        const formData = new FormData(form);
        const novasRegras = {
            duracao: parseInt(formData.get('duracao')),
            jogadores_por_time: parseInt(formData.get('jogadores_por_time')),
            limite_jogadores: parseInt(formData.get('limite_jogadores')),
            vitorias_consecutivas: parseInt(formData.get('vitorias_consecutivas')),
            prioridade_retorno: formData.get('prioridade_retorno') === 'true'
        };
        
        // Validações
        if (novasRegras.duracao < 5 || novasRegras.duracao > 90) {
            throw new Error('Duração deve estar entre 5 e 90 minutos');
        }
        
        if (novasRegras.limite_jogadores < 10 || novasRegras.limite_jogadores > 100) {
            throw new Error('Limite de jogadores deve estar entre 10 e 100');
        }
        
        if (novasRegras.vitorias_consecutivas < 2 || novasRegras.vitorias_consecutivas > 10) {
            throw new Error('Vitórias consecutivas deve estar entre 2 e 10');
        }
        
        // Salvar no banco
        const resultado = await Database.atualizarRegras(regrasAtuais.id, novasRegras);
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        // Atualizar estado local
        regrasAtuais = { ...regrasAtuais, ...novasRegras };
        
        mostrarMensagem('✅ Regras salvas com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao salvar regras:', error);
        mostrarMensagem(`❌ ${error.message}`, 'error');
    } finally {
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `
            <span class="emoji">💾</span>
            <span>Salvar Regras</span>
        `;
    }
}

// Resetar para padrão
async function resetarParaPadrao() {
    try {
        const confirmacao = confirm('Tem certeza que deseja restaurar as configurações padrão?');
        if (!confirmacao) return;
        
        btnReset.disabled = true;
        btnReset.innerHTML = `
            <span class="emoji">⏳</span>
            <span>Resetando...</span>
        `;
        
        // Atualizar no banco
        const resultado = await Database.atualizarRegras(regrasAtuais.id, REGRAS_PADRAO);
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        // Atualizar estado e interface
        regrasAtuais = { ...regrasAtuais, ...REGRAS_PADRAO };
        preencherFormulario(regrasAtuais);
        
        mostrarMensagem('✅ Regras restauradas para o padrão!', 'success');
        
    } catch (error) {
        console.error('Erro ao resetar regras:', error);
        mostrarMensagem(`❌ ${error.message}`, 'error');
    } finally {
        btnReset.disabled = false;
        btnReset.innerHTML = `
            <span class="emoji">🔄</span>
            <span>Padrão</span>
        `;
    }
}

// Mostrar mensagem
function mostrarMensagem(mensagem, tipo = 'info') {
    const cores = {
        success: '#28a745',
        error: '#dc3545',
        info: '#2d8f2d'
    };
    
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${cores[tipo]};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    div.textContent = mensagem;
    
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.remove();
    }, 4000);
}