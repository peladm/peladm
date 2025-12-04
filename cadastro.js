// JavaScript para a página de Cadastro

// Variável para controle de permissão
let isAdmin = false;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    verificarPermissaoAdmin();
    await carregarJogadores();
    configurarFormulario();
    configurarSlider();
});

// Verificar se usuário é administrador
function verificarPermissaoAdmin() {
    // Verifica se existe uma senha de admin salva ou se o usuário já foi autenticado
    const adminAuth = localStorage.getItem('adminAuth');
    const adminExpiry = localStorage.getItem('adminExpiry');
    const now = new Date().getTime();
    
    if (adminAuth === 'true' && adminExpiry && now < parseInt(adminExpiry)) {
        isAdmin = true;
    } else {
        // Limpar autenticação expirada
        localStorage.removeItem('adminAuth');
        localStorage.removeItem('adminExpiry');
        isAdmin = false;
    }
}

// Função para solicitar senha de admin
async function solicitarSenhaAdmin() {
    const username = prompt('🔐 Digite o nome de usuário do administrador:');
    if (!username) return false;
    
    const senha = prompt('🔐 Digite a senha:');
    if (!senha) return false;
    
    try {
        // Buscar usuário admin no banco
        const resultado = await Database.buscarUsuarioPorUsername(username);
        
        if (!resultado.success) {
            mostrarMensagem('❌ Erro ao verificar credenciais!', 'error');
            return false;
        }
        
        const usuario = resultado.data;
        
        // Verificar se usuário existe e se a senha está correta
        if (!usuario) {
            mostrarMensagem('❌ Usuário não encontrado!', 'error');
            return false;
        }
        
        // Verificar senha (assumindo que está salva em texto plano - em produção seria hash)
        if (usuario.senha !== senha) {
            mostrarMensagem('❌ Senha incorreta!', 'error');
            return false;
        }
        
        // Verificar se é admin (assumindo campo 'tipo' ou 'role')
        if (usuario.tipo !== 'admin' && usuario.role !== 'admin') {
            mostrarMensagem('❌ Usuário não tem privilégios de administrador!', 'error');
            return false;
        }
        
        // Sucesso - conceder acesso admin
        isAdmin = true;
        // Salvar autenticação por 1 hora
        const expiry = new Date().getTime() + (60 * 60 * 1000);
        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('adminExpiry', expiry.toString());
        localStorage.setItem('adminUser', username);
        
        mostrarMensagem(`✅ Bem-vindo, ${usuario.nome || username}!`, 'success');
        carregarJogadores(); // Recarregar para mostrar botões de delete
        return true;
        
    } catch (error) {
        console.error('Erro na autenticação:', error);
        mostrarMensagem('❌ Erro no sistema de autenticação!', 'error');
        return false;
    }
}

// Configurar formulário
function configurarFormulario() {
    const form = document.getElementById('form-cadastro');
    form.addEventListener('submit', cadastrarJogador);
}

// Configurar sistema de estrelas
function configurarSlider() {
    const stars = document.querySelectorAll('.star');
    const hiddenInput = document.getElementById('nivel');
    
    stars.forEach((star, index) => {
        // Click para selecionar
        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            hiddenInput.value = value;
            atualizarEstrelas(value);
        });
        
        // Hover effect
        star.addEventListener('mouseenter', () => {
            const value = parseInt(star.dataset.value);
            mostrarPreviewEstrelas(value);
        });
        
        star.addEventListener('mouseleave', () => {
            const currentValue = parseInt(hiddenInput.value);
            atualizarEstrelas(currentValue);
        });
    });
}

// Atualizar estrelas ativas
function atualizarEstrelas(value) {
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        const starValue = parseInt(star.dataset.value);
        if (starValue <= value) {
            star.classList.add('active');
            star.classList.remove('hover');
        } else {
            star.classList.remove('active');
            star.classList.remove('hover');
        }
    });
}

// Mostrar preview no hover
function mostrarPreviewEstrelas(value) {
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        const starValue = parseInt(star.dataset.value);
        star.classList.remove('active');
        if (starValue <= value) {
            star.classList.add('hover');
        } else {
            star.classList.remove('hover');
        }
    });
}

// Cadastrar novo jogador
async function cadastrarJogador(e) {
    e.preventDefault();
    
    const btnSubmit = document.querySelector('.btn-submit');
    const originalText = btnSubmit.innerHTML;
    
    try {
        // Mostrar loading
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `
            <span class="emoji">⏳</span>
            <span>Cadastrando...</span>
        `;
        
        // Coletar dados do formulário
        const formData = new FormData(e.target);
        const dadosJogador = {
            nome: formData.get('nome').trim(),
            nivel_habilidade: parseInt(formData.get('nivel'))
        };
        
        // Validações
        if (!dadosJogador.nome) {
            throw new Error('Nome é obrigatório');
        }
        
        if (dadosJogador.nome.length < 2) {
            throw new Error('Nome deve ter pelo menos 2 caracteres');
        }
        
        // Verificar se já existe jogador com mesmo nome
        const { data: jogadoresExistentes } = await Database.buscarJogadores();
        const nomeExiste = jogadoresExistentes?.some(j => 
            j.nome.toLowerCase() === dadosJogador.nome.toLowerCase()
        );
        
        if (nomeExiste) {
            throw new Error('Já existe um jogador com este nome');
        }
        
        // Cadastrar no banco
        const resultado = await Database.cadastrarJogador(dadosJogador);
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        // Sucesso
        mostrarMensagem('✅ Jogador cadastrado com sucesso!', 'success');
        
        // Limpar formulário
        e.target.reset();
        document.getElementById('nivel').value = '3';
        atualizarEstrelas(3);
        
        // Recarregar lista
        await carregarJogadores();
        
    } catch (error) {
        console.error('Erro ao cadastrar:', error);
        mostrarMensagem(`❌ ${error.message}`, 'error');
    } finally {
        // Restaurar botão
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

// Carregar lista de jogadores
async function carregarJogadores() {
    try {
        const { data: jogadores } = await Database.buscarJogadores();
        const lista = document.getElementById('lista-jogadores');
        
        if (!jogadores || jogadores.length === 0) {
            lista.innerHTML = `
                <div class="empty-state">
                    <span class="emoji">😴</span>
                    <p>Nenhum jogador cadastrado ainda</p>
                </div>
            `;
            return;
        }
        
        // Ordenar jogadores: ativos primeiro, depois inativos
        const jogadoresOrdenados = jogadores.sort((a, b) => {
            const statusA = a.status || 'ativo';
            const statusB = b.status || 'ativo';
            
            if (statusA === statusB) {
                return a.nome.localeCompare(b.nome); // Ordem alfabética dentro do mesmo status
            }
            
            return statusA === 'ativo' ? -1 : 1; // Ativos primeiro
        });
        
        lista.innerHTML = jogadoresOrdenados.map(jogador => {
            const nivel = jogador.nivel_habilidade || 3;
            const estrelas = '⭐'.repeat(nivel) + '☆'.repeat(5 - nivel);
            const status = jogador.status || 'ativo';
            const statusEmoji = status === 'ativo' ? '🟢' : '🔴';
            const isInativo = status === 'inativo';
            
            return `
                <div class="player-item ${isInativo ? 'player-inactive' : ''}" data-id="${jogador.id}">
                    <div class="player-info">
                        <div class="player-name">${jogador.nome}</div>
                        <div class="player-stars">${estrelas}</div>
                    </div>
                    <div class="player-actions">
                        <button class="btn-action btn-edit" onclick="editarJogador('${jogador.id}')">
                            <span class="emoji">✏️</span>
                        </button>
                        <button class="btn-action btn-status" onclick="alternarStatus('${jogador.id}', '${status}')" title="${status === 'ativo' ? 'Desativar jogador' : 'Ativar jogador'}">
                            <span class="emoji">${statusEmoji}</span>
                        </button>
                        ${isAdmin ? `
                        <button class="btn-action btn-delete" onclick="excluirJogador('${jogador.id}', '${jogador.nome}')" title="Excluir jogador (apenas ADM)">
                            <span class="emoji">🗑️</span>
                        </button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar jogadores:', error);
        mostrarMensagem('❌ Erro ao carregar jogadores', 'error');
    }
}

// Editar jogador
async function editarJogador(id) {
    try {
        // Buscar dados do jogador
        const { data: jogadores } = await Database.buscarJogadores();
        const jogador = jogadores.find(j => j.id === id);
        
        if (!jogador) {
            throw new Error('Jogador não encontrado');
        }
        
        // Preencher formulário
        document.getElementById('nome').value = jogador.nome;
        document.getElementById('nivel').value = jogador.nivel_habilidade || 3;
        atualizarEstrelas(jogador.nivel_habilidade || 3);
        
        // Alterar botão para modo edição
        const btnSubmit = document.querySelector('.btn-submit');
        btnSubmit.innerHTML = `
            <span class="emoji">💾</span>
            <span>Atualizar</span>
        `;
        
        // Alterar comportamento do formulário
        const form = document.getElementById('form-cadastro');
        form.onsubmit = (e) => atualizarJogador(e, id);
        
        // Scroll para o formulário
        document.querySelector('.form-card').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        
        mostrarMensagem('✏️ Modo edição ativado', 'info');
        
    } catch (error) {
        console.error('Erro ao editar jogador:', error);
        mostrarMensagem(`❌ ${error.message}`, 'error');
    }
}

// Atualizar jogador
async function atualizarJogador(e, id) {
    e.preventDefault();
    
    const btnSubmit = document.querySelector('.btn-submit');
    const originalText = btnSubmit.innerHTML;
    
    try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `
            <span class="emoji">⏳</span>
            <span>Atualizando...</span>
        `;
        
        const formData = new FormData(e.target);
        const dadosAtualizados = {
            nome: formData.get('nome').trim(),
            nivel_habilidade: parseInt(formData.get('nivel'))
        };
        
        if (!dadosAtualizados.nome || dadosAtualizados.nome.length < 2) {
            throw new Error('Nome deve ter pelo menos 2 caracteres');
        }
        
        const resultado = await Database.atualizarJogador(id, dadosAtualizados);
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        mostrarMensagem('✅ Jogador atualizado com sucesso!', 'success');
        cancelarEdicao();
        await carregarJogadores();
        
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        mostrarMensagem(`❌ ${error.message}`, 'error');
    } finally {
        btnSubmit.disabled = false;
    }
}

// Cancelar edição
function cancelarEdicao() {
    const form = document.getElementById('form-cadastro');
    const btnSubmit = document.querySelector('.btn-submit');
    
    // Limpar formulário
    form.reset();
    document.getElementById('nivel').value = '3';
    atualizarEstrelas(3);
    
    // Restaurar botão
    btnSubmit.innerHTML = `
        <span class="emoji">✅</span>
        <span>Cadastrar</span>
    `;
    
    // Restaurar comportamento
    form.onsubmit = cadastrarJogador;
}

// Excluir jogador (apenas para administradores)
async function excluirJogador(id, nome) {
    // Verificar se é admin
    if (!isAdmin) {
        const senhaCorreta = await solicitarSenhaAdmin();
        if (!senhaCorreta) {
            return;
        }
    }
    
    if (!confirm(`🗑️ Tem certeza que deseja EXCLUIR PERMANENTEMENTE "${nome}"?\n\n⚠️ Esta ação não pode ser desfeita!`)) {
        return;
    }
    
    try {
        const resultado = await Database.deletarJogador(id);
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        mostrarMensagem('✅ Jogador excluído permanentemente!', 'success');
        await carregarJogadores();
        
    } catch (error) {
        console.error('Erro ao excluir:', error);
        mostrarMensagem(`❌ ${error.message}`, 'error');
    }
}

// Alternar status do jogador (ativo/inativo)
async function alternarStatus(id, statusAtual) {
    try {
        const novoStatus = statusAtual === 'ativo' ? 'inativo' : 'ativo';
        const emoji = novoStatus === 'ativo' ? '🟢' : '🔴';
        const acao = novoStatus === 'ativo' ? 'ativado' : 'desativado';
        
        // Buscar dados do jogador para pegar o nome
        const { data: jogadores } = await Database.buscarJogadores();
        const jogador = jogadores.find(j => j.id === id);
        
        if (!jogador) {
            throw new Error('Jogador não encontrado');
        }
        
        // Confirmar alteração
        const confirmacao = confirm(`${emoji} Deseja ${novoStatus === 'ativo' ? 'ativar' : 'desativar'} "${jogador.nome}"?`);
        if (!confirmacao) {
            return;
        }
        
        // Atualizar status no banco
        const resultado = await Database.atualizarJogador(id, { status: novoStatus });
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        mostrarMensagem(`${emoji} Jogador ${acao} com sucesso!`, 'success');
        await carregarJogadores();
        
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        mostrarMensagem(`❌ ${error.message}`, 'error');
    }
}

// Navegação
function irParaFila() {
    const sessaoAtiva = localStorage.getItem('sessaoAtiva');
    if (!sessaoAtiva) {
        mostrarMensagem('❌ Nenhuma sessão ativa! Faça um sorteio primeiro.', 'error');
        return;
    }
    window.location.href = 'fila.html';
}

function irParaJogo() {
    const jogoAtivo = localStorage.getItem('jogoAtivo');
    if (!jogoAtivo) {
        mostrarMensagem('❌ Nenhum jogo ativo! Inicie um jogo primeiro.', 'error');
        return;
    }
    window.location.href = 'partida.html';
}

// Função para alternar modo admin (pode ser chamada via console ou botão)
async function toggleAdminMode() {
    if (isAdmin) {
        // Desativar modo admin
        isAdmin = false;
        localStorage.removeItem('adminAuth');
        localStorage.removeItem('adminExpiry');
        localStorage.removeItem('adminUser');
        mostrarMensagem('🔐 Modo administrador desativado', 'info');
    } else {
        // Ativar modo admin
        await solicitarSenhaAdmin();
    }
    
    carregarJogadores(); // Recarregar para atualizar botões
}

// Mostrar mensagens
function mostrarMensagem(texto, tipo = 'info') {
    // Remover mensagem anterior se existir
    const mensagemExistente = document.querySelector('.toast-message');
    if (mensagemExistente) {
        mensagemExistente.remove();
    }
    
    // Criar nova mensagem
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${tipo}`;
    toast.textContent = texto;
    
    // Estilos inline para o toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${tipo === 'success' ? '#2d8f2d' : tipo === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 0.9rem;
        z-index: 10000;
        max-width: 350px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(toast);
    
    // Remover após 3 segundos
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}