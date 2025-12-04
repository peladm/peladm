// Script de proteção para adicionar no início de cada página
// Adicione este script em todas as páginas que precisam de autenticação

// Verificar autenticação na carga da página
document.addEventListener('DOMContentLoaded', () => {
    const currentUser = requireAuth();
    if (currentUser) {
        console.log('✅ Usuário autenticado:', currentUser.nome, `(${currentUser.role})`);
        setupUserInterface(currentUser);
    }
});

// Verificar se usuário está logado
function requireAuth() {
    const savedUser = localStorage.getItem('pelada3_user');
    if (!savedUser) {
        redirectToLogin();
        return null;
    }
    
    try {
        const user = JSON.parse(savedUser);
        if (!user || !user.id) {
            redirectToLogin();
            return null;
        }
        return user;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('pelada3_user');
        redirectToLogin();
        return null;
    }
}

// Redirecionar para login
function redirectToLogin() {
    console.log('❌ Usuário não autenticado, redirecionando...');
    window.location.href = 'login.html';
}

// Configurar interface baseada no usuário
function setupUserInterface(user) {
    // Aplicar restrições baseadas no role
    applyRoleRestrictions(user.role, user.isGuest);
    
    // Adicionar indicador de visitante se necessário
    if (user.isGuest) {
        addGuestIndicator();
    }
    
    // Remover qualquer informação de usuário que possa aparecer (exceto na tela de usuários)
    conditionalRemoveUserInfo();
}

// Função para remover qualquer informação de usuário que possa ter sido inserida
function removeUserInfoFromPage() {
    // Pular a tela de usuários completamente
    if (window.location.pathname.includes('usuarios.html')) {
        return;
    }
    
    // Remover apenas elementos de informação do usuário logado (não da lista)
    const elementsToRemove = [
        '.current-user',
        '.user-info:not(.user-item .user-info)', // Não remover user-info dentro de user-item
        '[class*="current-user"]'
    ];
    
    elementsToRemove.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            // Verificar se não está dentro de um user-item
            if (!el.closest('.user-item')) {
                el.remove();
            }
        });
    });
}

// Executar remoção apenas se não estiver na tela de usuários
function conditionalRemoveUserInfo() {
    if (!window.location.pathname.includes('usuarios.html')) {
        removeUserInfoFromPage();
    }
}

// Executar remoção periodicamente para garantir que não apareça (exceto na tela de usuários)
setInterval(conditionalRemoveUserInfo, 1000);

function addUserInfoToPage(user) {
    // Função desabilitada - não adicionar informações do usuário em nenhuma tela
    return;
}

// Verificar se o usuário pode acessar a página atual
function checkPageAccess(role, isGuest = false) {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Definir quais páginas cada role pode acessar
    const pageAccess = {
        'guest': [
            'index.html',
            'fila.html', 
            'estatisticas.html',
            'resultados.html',
            'partida.html'
            // Visitantes: podem visualizar resultados também
        ],
        'player': [
            'fila.html',
            'estatisticas.html',
            'resultados.html',
            'partida.html'
            // Jogadores cadastrados: NÃO podem acessar home, só visualizar dados
        ],
        'organizer': [
            'index.html',
            'cadastro.html',
            'fila.html',
            'partida.html',
            'sorteio.html',
            'regras.html',
            'estatisticas.html',
            'resultados.html',
            'sumula.html'
            // Organizadores NÃO podem acessar: usuarios
        ],
        'admin': [
            // Admin pode acessar todas as páginas
            'index.html',
            'cadastro.html',
            'fila.html',
            'partida.html',
            'sorteio.html',
            'regras.html',
            'estatisticas.html',
            'resultados.html',
            'sumula.html',
            'usuarios.html'
        ]
    };
    
    // Determinar qual conjunto de páginas usar
    let allowedPages;
    if (isGuest) {
        allowedPages = pageAccess['guest'];
    } else {
        allowedPages = pageAccess[role] || pageAccess['player'];
    }
    
    // Verificação especial: jogadores não podem acessar home (index.html)
    if (!isGuest && role === 'player' && currentPage === 'index.html') {
        console.log('🔄 Redirecionando jogador da home para resultados...');
        window.location.href = 'resultados.html';
        return false;
    }
    
    // Se a página atual não está na lista permitida, redirecionar
    if (!allowedPages.includes(currentPage)) {
        const userType = isGuest ? '👀 Visitante' : getRoleDisplayName(role);
        alert(`❌ Você não tem permissão para acessar esta página.\nSeu nível: ${userType}`);
        
        // Redirecionar visitantes para resultados, outros conforme perfil
        if (isGuest || role === 'player') {
            window.location.href = 'resultados.html';
        } else {
            window.location.href = 'index.html';
        }
        return false;
    }
    
    return true;
}

// Aplicar restrições baseadas no role
function applyRoleRestrictions(role, isGuest = false) {
    // Primeiro, verificar se o usuário pode acessar esta página
    checkPageAccess(role, isGuest);
    
    const restrictions = {
        'guest': {
            hidden: ['.admin-only', '.organizer-only', '.player-only', '.guest-hidden'],
            readonly: ['.admin-controls', '.organizer-controls', '.player-controls']
        },
        'player': {
            hidden: ['.admin-only', '.organizer-only'],
            readonly: ['.admin-controls', '.organizer-controls']
        },
        'organizer': {
            hidden: ['.admin-only'],
            readonly: ['.admin-controls']
        },
        'admin': {
            hidden: [],
            readonly: [],
            shown: ['.admin-only'] // Mostrar elementos apenas para admin
        }
    };
    
    // Determinar qual tipo de restrição usar
    let userRestrictions;
    if (isGuest) {
        userRestrictions = restrictions['guest'];
    } else {
        userRestrictions = restrictions[role] || restrictions['player'];
    }
    
    // Esconder elementos
    userRestrictions.hidden.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.display = 'none';
        });
    });
    
    // Mostrar elementos apenas para admin
    if (userRestrictions.shown) {
        userRestrictions.shown.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'block';
            });
        });
    }
    
    // Tornar elementos somente leitura
    userRestrictions.readonly.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                el.readOnly = true;
                el.disabled = true;
            }
        });
    });
    
    // Configurar navegação específica para visitantes
    if (isGuest) {
        setupGuestNavigation();
    }
}

// Configurar navegação específica para visitantes
function setupGuestNavigation() {
    // Ajustar navegação mobile
    const navMobile = document.querySelector('.nav-mobile');
    if (navMobile) {
        // Remover links não permitidos para visitantes
        const guestAllowedPages = ['resultados.html', 'fila.html', 'estatisticas.html'];
        
        // Esconder navegação para páginas não permitidas
        navMobile.querySelectorAll('a.nav-item').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !guestAllowedPages.some(page => href.includes(page))) {
                // Em vez de esconder, desabilitar o link
                link.style.opacity = '0.3';
                link.style.pointerEvents = 'none';
                link.title = 'Acesso restrito para visitantes';
            }
        });
        
        // Esconder botões administrativos
        navMobile.querySelectorAll('.admin-btn').forEach(btn => {
            btn.style.display = 'none';
        });
    }
    
    // Modificar link "Home" para apontar para resultados
    document.querySelectorAll('a[href="index.html"]').forEach(link => {
        link.href = 'resultados.html';
        link.title = 'Página inicial (Resultados)';
    });
}

// Adicionar botão de logout (DESABILITADO)
/*
function addLogoutButton() {
    // Verificar se já existe
    if (document.querySelector('.logout-btn')) return;
    
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.textContent = '🚪 Sair';
    logoutBtn.onclick = logout;
    
    // Tentar adicionar no footer mobile
    const footer = document.querySelector('.footer-mobile .nav-mobile');
    if (footer) {
        const logoutItem = document.createElement('a');
        logoutItem.className = 'nav-item logout-item';
        logoutItem.innerHTML = '<span class="emoji">🚪</span>';
        logoutItem.onclick = logout;
        footer.appendChild(logoutItem);
    }
}
*/

// Fazer logout
function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('pelada3_user');
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// Verificar se usuário tem permissão específica
function hasPermission(requiredRole) {
    const currentUser = requireAuth();
    if (!currentUser) return false;
    
    const roleHierarchy = {
        'player': 1,
        'organizer': 2,
        'admin': 3
    };
    
    const userLevel = roleHierarchy[currentUser.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
}

// Obter nome de exibição do role
function getRoleDisplayName(role) {
    const roleNames = {
        'admin': '🔧 Admin',
        'organizer': '📋 Organizador',
        'player': '⚽ Jogador'
    };
    return roleNames[role] || role;
}

// Verificar se o usuário atual é visitante
function isGuest() {
    const user = JSON.parse(localStorage.getItem('pelada3_user') || '{}');
    return user.isGuest === true;
}

// Verificar se usuário tem permissão para ações
function hasActionPermission(action = 'modify') {
    if (isGuest()) {
        alert('❌ Visitantes não podem realizar alterações.\nFaça login como organizador ou admin.');
        return false;
    }
    return true;
}

// Adicionar indicador de visitante
function addGuestIndicator() {
    // Verificar se já existe
    if (document.querySelector('.guest-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'guest-indicator';
    indicator.innerHTML = '👀 Modo Visitante';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(108, 92, 231, 0.3);
        animation: slideIn 0.5s ease;
    `;
    
    document.body.appendChild(indicator);
    
    // Adicionar animação CSS
    if (!document.querySelector('#guest-indicator-styles')) {
        const styles = document.createElement('style');
        styles.id = 'guest-indicator-styles';
        styles.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(styles);
    }
}