// Sistema de autenticação
let authState = {
    currentUser: null,
    isLoggedIn: false
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se Supabase está carregado
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase não carregado');
        showError('Erro ao carregar sistema. Verifique a conexão.');
        return;
    }
    
    // Verificar se client está disponível
    if (typeof client === 'undefined') {
        console.error('❌ Cliente do banco não disponível');
        showError('Erro de configuração do banco.');
        return;
    }
    
    console.log('✅ Sistema de login inicializado');
    setupLoginForm();
    checkExistingSession();
});

// Configurar formulário de login
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', handleLogin);
}

// Verificar sessão existente
function checkExistingSession() {
    const savedUser = localStorage.getItem('pelada3_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            if (user && user.id) {
                // Verificar se ainda é válido
                validateUser(user).then(isValid => {
                    if (isValid) {
                        redirectToHome();
                    } else {
                        localStorage.removeItem('pelada3_user');
                    }
                });
            }
        } catch (error) {
            localStorage.removeItem('pelada3_user');
        }
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('Preencha todos os campos');
        return;
    }
    
    setLoading(true);
    
    try {
        // Login temporário enquanto não criou a tabela
        if (username === 'admin' && password === '4231') {
            // Usuário admin padrão
            const adminUser = {
                id: 'admin-temp-id',
                nome: 'Administrador',
                username: 'admin',
                role: 'admin',
                ativo: true
            };
            
            authState.currentUser = adminUser;
            authState.isLoggedIn = true;
            
            // Salvar na sessão
            localStorage.setItem('pelada3_user', JSON.stringify(adminUser));
            
            // Redirecionar
            redirectToHome();
            return;
        }
        
        // Tentar verificar no banco (se a tabela existir)
        const { data: users, error } = await client
            .from('usuarios')
            .select('*')
            .eq('username', username)
            .eq('senha', password)
            .single();
            
        if (error && error.code !== 'PGRST116') {
            // Se erro for diferente de "não encontrado", pode ser que a tabela não existe
            console.log('Erro na consulta:', error);
            showError('Erro ao verificar credenciais. A tabela de usuários pode não existir ainda.');
            setLoading(false);
            return;
        }
        
        if (!users) {
            showError('Usuário ou senha incorretos');
            setLoading(false);
            return;
        }
        
        // Login bem-sucedido
        authState.currentUser = users;
        authState.isLoggedIn = true;
        
        // Salvar na sessão
        localStorage.setItem('pelada3_user', JSON.stringify(users));
        
        // Atualizar último login
        await client
            .from('usuarios')
            .update({ ultimo_login: new Date().toISOString() })
            .eq('id', users.id);
        
        // Redirecionar
        redirectToHome();
        
    } catch (error) {
        console.error('Erro no login:', error);
        showError('Erro ao fazer login. Tente novamente.');
        setLoading(false);
    }
}

// Validar usuário no banco
async function validateUser(user) {
    try {
        const { data, error } = await client
            .from('usuarios')
            .select('id, ativo')
            .eq('id', user.id)
            .eq('ativo', true)
            .single();
            
        return !error && data;
    } catch (error) {
        return false;
    }
}

// Redirecionar para home baseado no role
function redirectToHome() {
    const user = authState.currentUser || JSON.parse(localStorage.getItem('pelada3_user'));
    
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    // Redirecionar baseado no tipo de usuário
    switch (user.role) {
        case 'admin':
            window.location.href = 'index.html'; // Admin pode acessar tudo
            break;
        case 'organizer':
            window.location.href = 'index.html'; // Organizador vai para home
            break;
        case 'player':
            window.location.href = 'fila.html'; // Jogador vai para fila
            break;
        default:
            window.location.href = 'index.html';
    }
}

// Estados de loading
function setLoading(loading) {
    const form = document.getElementById('login-form');
    const btn = form.querySelector('.login-btn');
    
    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// Mensagens
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.background = '#e8f5e8';
    errorDiv.style.color = '#2d8f2d';
    errorDiv.style.borderLeftColor = '#2d8f2d';
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
        // Reset styles
        errorDiv.style.background = '#ffebee';
        errorDiv.style.color = '#c62828';
        errorDiv.style.borderLeftColor = '#c62828';
    }, 3000);
}

// Função para logout (usar nas outras páginas)
function logout() {
    localStorage.removeItem('pelada3_user');
    authState.currentUser = null;
    authState.isLoggedIn = false;
    window.location.href = 'login.html';
}

// Função para verificar autenticação (usar nas outras páginas)
function requireAuth() {
    const savedUser = localStorage.getItem('pelada3_user');
    if (!savedUser) {
        window.location.href = 'login.html';
        return null;
    }
    
    try {
        const user = JSON.parse(savedUser);
        return user;
    } catch (error) {
        localStorage.removeItem('pelada3_user');
        window.location.href = 'login.html';
        return null;
    }
}

// Função para verificar permissões
function hasPermission(requiredRole) {
    const user = JSON.parse(localStorage.getItem('pelada3_user') || '{}');
    
    const roleHierarchy = {
        'player': 1,
        'organizer': 2, 
        'admin': 3
    };
    
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 999;
    
    return userLevel >= requiredLevel;
}

// Função para entrar como visitante
function entrarComoVisitante() {
    try {
        // Criar usuário visitante temporário
        const visitanteUser = {
            id: 'guest_' + Date.now(),
            username: 'visitante',
            nome: 'Visitante',
            role: 'player',
            isGuest: true,
            loginTime: new Date().toISOString()
        };
        
        // Salvar no localStorage
        localStorage.setItem('pelada3_user', JSON.stringify(visitanteUser));
        
        // Atualizar estado de autenticação
        authState.currentUser = visitanteUser;
        authState.isLoggedIn = true;
        
        // Redirecionar visitante para a página de resultados (home do visitante)
        window.location.href = 'resultados.html';
        
    } catch (error) {
        console.error('Erro ao entrar como visitante:', error);
        showError('Erro interno. Tente novamente.');
    }
}