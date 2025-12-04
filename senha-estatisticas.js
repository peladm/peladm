// Função para obter senha do usuário logado
async function obterSenhaUsuarioLogado() {
    // Obter dados do usuário logado
    const userData = localStorage.getItem('pelada3_user');
    if (!userData) {
        console.error('Usuário não logado');
        return null;
    }
    
    let currentUser;
    try {
        currentUser = JSON.parse(userData);
    } catch (error) {
        console.error('Erro ao ler dados do usuário:', error);
        return null;
    }
    
    const username = currentUser.username;
    if (!username) {
        console.error('Nome de usuário não encontrado');
        return null;
    }
    
    // Para admin, retornar senha fixa
    if (username === 'admin') {
        return '4231';
    }

    try {
        // Buscar dados do usuário no Supabase
        const { data, error } = await supabase
            .from('usuarios')
            .select('senha')
            .eq('username', username)
            .single();

        if (error) {
            console.error('Erro ao buscar senha do usuário:', error);
            return null;
        }

        return data?.senha || null;
    } catch (error) {
        console.error('Erro ao conectar com banco:', error);
        return null;
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Focar no input ao carregar
    passwordInput.focus();
    
    // Configurar formulário
    passwordForm.addEventListener('submit', handleSubmit);
    
    // Ocultar erro ao digitar
    passwordInput.addEventListener('input', () => {
        if (errorMessage.style.display !== 'none') {
            errorMessage.style.display = 'none';
        }
    });
});

// Elementos DOM
const passwordForm = document.getElementById('password-form');
const passwordInput = document.getElementById('password-input');
const errorMessage = document.getElementById('error-message');

// Processar envio do formulário
async function handleSubmit(e) {
    e.preventDefault();
    
    const senhaDigitada = passwordInput.value.trim();
    const senhaCorreta = await obterSenhaUsuarioLogado();
    
    if (!senhaCorreta) {
        mostrarErro('Erro ao verificar credenciais. Faça login novamente.');
        return;
    }
    
    if (senhaDigitada === senhaCorreta) {
        // Senha correta - redirecionar
        mostrarSucesso();
        setTimeout(() => {
            window.location.href = 'estatisticas.html';
        }, 1000);
    } else {
        // Senha incorreta - mostrar erro
        mostrarErro('Senha incorreta. Digite sua senha de usuário.');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Mostrar mensagem de sucesso
function mostrarSucesso() {
    errorMessage.style.display = 'block';
    errorMessage.style.background = '#d1f2eb';
    errorMessage.style.color = '#0f6848';
    errorMessage.style.borderColor = '#a7e7d4';
    errorMessage.innerHTML = '✅ Senha correta! Redirecionando...';
}

// Mostrar mensagem de erro
function mostrarErro(mensagem = '❌ Senha incorreta. Tente novamente.') {
    errorMessage.style.display = 'block';
    errorMessage.style.background = '#ffe6e6';
    errorMessage.style.color = '#d63384';
    errorMessage.style.borderColor = '#f5c2c7';
    errorMessage.innerHTML = mensagem;
    
    // Adicionar efeito de shake
    errorMessage.style.animation = 'none';
    setTimeout(() => {
        errorMessage.style.animation = 'shake 0.5s ease-in-out';
    }, 10);
}

// Permitir Enter para submeter
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSubmit(e);
    }
});