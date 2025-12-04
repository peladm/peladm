// Estado da aplicação
let users = [];

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verificar se é admin
        const currentUser = requireAuth();
        if (currentUser && !hasPermission('admin')) {
            alert('❌ Apenas administradores podem gerenciar usuários.');
            window.location.href = 'index.html';
            return;
        }
        
        setupEventListeners();
        await carregarUsuarios();
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        mostrarErro('Erro ao inicializar página de usuários.');
    }
});

// Configurar event listeners
function setupEventListeners() {
    // Formulário adicionar usuário
    document.getElementById('form-adicionar').addEventListener('submit', handleAdicionarUsuario);
}

// Carregar usuários do banco
async function carregarUsuarios() {
    try {
        // Tentar usar a classe Database primeiro
        if (typeof Database !== 'undefined') {
            const resultado = await Database.buscarTodos('usuarios', { 
                orderBy: 'id', 
                orderDirection: 'desc' 
            });
            
            if (resultado.success) {
                users = resultado.data || [];
                renderizarUsuarios();
                return;
            } else {
                console.error('Erro na classe Database:', resultado.error);
            }
        }
        
        // Fallback: usar Supabase diretamente
        console.log('Usando Supabase diretamente como fallback...');
        
        // Inicializar Supabase se necessário
        if (typeof supabase === 'undefined') {
            window.supabase = createClient(
                'https://hsimtctqslplhcxrvbvt.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzaW10Y3Rxc2xwbGhjeHJ2YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1NzUwMzUsImV4cCI6MjA0NjE1MTAzNX0.7NqKAGhLGcpqWl-Gf2KowdAB4Ml0G9rXFDXGXxwYJR8'
            );
        }
        
        const { data: usuarios, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('id', { ascending: false });
            
        if (error) {
            console.error('Erro do Supabase:', error);
            throw error;
        }
        
        users = usuarios || [];
        renderizarUsuarios();
        
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        mostrarErro('Erro ao carregar usuários. Verifique sua conexão e tente novamente.');
    }
}

// Renderizar lista de usuários
function renderizarUsuarios() {
    const container = document.getElementById('lista-usuarios');
    
    if (!users || users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">👤</span>
                <p>Nenhum usuário cadastrado ainda</p>
            </div>
        `;
        return;
    }
    
    const htmlContent = users.map(user => {
        // Verificar se os dados do usuário estão completos
        const nome = user.nome || user.username || 'Usuário';
        const username = user.username || 'user';
        const role = user.role || 'player';
        
        return `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-name">${nome}</div>
                    <div class="user-username">@${username}</div>
                    <div class="user-role role-${role}">${getRoleDisplayName(role)}</div>
                </div>
                <div class="user-actions">
                    <button class="user-btn btn-edit" onclick="editarUsuario('${user.id}')">
                        ✏️
                    </button>
                    <button class="user-btn btn-delete" onclick="excluirUsuario('${user.id}')">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = htmlContent;
}

// Obter nome amigável do role
function getRoleDisplayName(role) {
    const roles = {
        'admin': '🔧 Admin',
        'organizer': '📋 Organizador',
        'player': '👀 Visitante' // Para casos legados ou visitantes temporários
    };
    return roles[role] || role;
}

// Handle adicionar usuário
async function handleAdicionarUsuario(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const senha = document.getElementById('senha').value.trim();
    const role = document.getElementById('role').value;
    
    // Validações
    if (!username || !senha || !role) {
        mostrarErro('Por favor, preencha todos os campos.');
        return;
    }
    
    if (username.length < 3) {
        mostrarErro('Nome de usuário deve ter pelo menos 3 caracteres.');
        return;
    }
    
    if (senha.length < 4) {
        mostrarErro('Senha deve ter pelo menos 4 caracteres.');
        return;
    }
    
    // Verificar se username já existe
    const usernameExists = users.some(user => user.username.toLowerCase() === username.toLowerCase());
    if (usernameExists) {
        mostrarErro('Nome de usuário já existe. Escolha outro.');
        return;
    }
    
    // Desabilitar botão durante submissão
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="emoji">⏳</span><span>Adicionando...</span>';
    
    try {
        const novoUsuario = {
            nome: username, // Usar username como nome também
            username: username,
            senha: senha,
            role: role,
            ativo: true
        };
        
        const resultado = await Database.inserir('usuarios', novoUsuario);
        
        if (!resultado.success) {
            if (resultado.error && resultado.error.includes('23505')) {
                mostrarErro('Nome de usuário já existe. Escolha outro.');
                return;
            }
            throw new Error(resultado.error);
        }
        
        mostrarSucesso('✅ Usuário adicionado com sucesso!');
        
        // Limpar formulário
        document.getElementById('form-adicionar').reset();
        
        // Recarregar lista
        await carregarUsuarios();
        
    } catch (error) {
        console.error('Erro ao adicionar usuário:', error);
        mostrarErro('Erro ao adicionar usuário. Tente novamente.');
    } finally {
        // Reabilitar botão
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Editar usuário (simplificado - apenas prompt)
async function editarUsuario(id) {
    const user = users.find(u => u.id === id);
    if (!user) {
        mostrarErro('Usuário não encontrado.');
        return;
    }
    
    // Criar modal de edição
    const modal = document.createElement('div');
    modal.id = 'modalEdicaoUsuario';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; width: 90%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            <h3 style="margin: 0 0 20px 0; text-align: center; color: #333;">✏️ Editar Usuário</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Nome:</label>
                <input type="text" id="editNome" value="${user.nome || user.username}" 
                       style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box;" />
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Nova Senha:</label>
                <input type="password" id="editSenha" placeholder="Digite nova senha (deixe vazio para manter atual)" 
                       style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box;" />
                <small style="color: #666; font-size: 12px;">Deixe em branco para não alterar a senha</small>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="salvarEdicaoUsuario('${user.id}')" 
                        style="background: #48bb78; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">
                    ✅ Salvar
                </button>
                <button onclick="fecharModalEdicao()" 
                        style="background: #e53e3e; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">
                    ❌ Cancelar
                </button>
            </div>
        </div>
    `;
    
    // Fechar modal ao clicar fora
    modal.onclick = function(e) {
        if (e.target === modal) {
            fecharModalEdicao();
        }
    };
    
    document.body.appendChild(modal);
    document.getElementById('editNome').focus();
}

// Salvar edição do usuário
async function salvarEdicaoUsuario(id) {
    const novoNome = document.getElementById('editNome').value.trim();
    const novaSenha = document.getElementById('editSenha').value.trim();
    
    if (!novoNome || novoNome.length < 2) {
        mostrarErro('Nome deve ter pelo menos 2 caracteres.');
        return;
    }
    
    try {
        const dadosAtualizacao = {
            nome: novoNome,
            updated_at: new Date().toISOString()
        };
        
        // Se senha foi informada, incluir na atualização
        if (novaSenha) {
            if (novaSenha.length < 3) {
                mostrarErro('Senha deve ter pelo menos 3 caracteres.');
                return;
            }
            dadosAtualizacao.senha = novaSenha;
        }
        
        const resultado = await Database.atualizar('usuarios', id, dadosAtualizacao);
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        const user = users.find(u => u.id === id);
        const mensagem = novaSenha ? 
            `✅ Nome e senha de "${user.nome || user.username}" atualizados!` : 
            `✅ Nome de "${user.nome || user.username}" atualizado!`;
            
        mostrarSucesso(mensagem);
        fecharModalEdicao();
        await carregarUsuarios();
        
    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        mostrarErro('Erro ao editar usuário.');
    }
}

// Fechar modal de edição
function fecharModalEdicao() {
    const modal = document.getElementById('modalEdicaoUsuario');
    if (modal) {
        modal.remove();
    }
}

// Excluir usuário definitivamente
async function excluirUsuario(id) {
    const user = users.find(u => u.id === id);
    if (!user) {
        mostrarErro('Usuário não encontrado.');
        return;
    }
    
    // Prevenir auto-exclusão do próprio admin
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    if (user.id === currentUser.id) {
        mostrarErro('Você não pode excluir sua própria conta.');
        return;
    }
    
    const confirmacao = confirm(`⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR DEFINITIVAMENTE o usuário "${user.nome || user.username}"?\n\nEsta ação NÃO PODE ser desfeita!`);
    if (!confirmacao) return;
    
    // Segunda confirmação para segurança
    const segundaConfirmacao = confirm(`🚨 ÚLTIMA CONFIRMAÇÃO:\n\nExcluir usuário "${user.nome || user.username}" PERMANENTEMENTE?\n\nDigite OK para confirmar ou Cancelar para desistir.`);
    if (!segundaConfirmacao) return;
    
    try {
        const resultado = await Database.excluir('usuarios', id);
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }
        
        mostrarSucesso(`✅ Usuário "${user.nome || user.username}" excluído definitivamente!`);
        await carregarUsuarios();
        
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        mostrarErro('Erro ao excluir usuário. Verifique as permissões.');
    }
}

// Funções de utilidade
function mostrarSucesso(mensagem) {
    // Criar toast de sucesso
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = mensagem;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 15px 20px;
        border-radius: 8px;
        border: 1px solid #c3e6cb;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Remover após 3 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function mostrarErro(mensagem) {
    // Criar toast de erro
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.textContent = mensagem;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        padding: 15px 20px;
        border-radius: 8px;
        border: 1px solid #f5c6cb;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Remover após 4 segundos (erro fica mais tempo)
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
}