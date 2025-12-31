# Sistema de Atualização Automática - PelADM

## 📱 Como Funciona

Este sistema garante que os usuários sempre tenham a versão mais recente do app PWA, mesmo em dispositivos móveis.

### Componentes

1. **Service Worker (sw.js)**: Gerencia cache e notifica sobre novas versões
2. **version.json**: Armazena versão atual e histórico de mudanças
3. **UpdateNotification.tsx**: Mostra modal de atualização para usuários
4. **update-version.js**: Script para facilitar atualização de versões

## 🚀 Como Atualizar a Versão

### Opção 1: Usando o Script (Recomendado)

```bash
node scripts/update-version.js 2.2.0 "Título da Versão" "Feature 1" "Feature 2" "Feature 3"
```

**Exemplo:**
```bash
node scripts/update-version.js 2.2.0 "Melhorias de Performance" "🚀 Carregamento 50% mais rápido" "💾 Menor uso de memória" "🎨 Interface otimizada"
```

### Opção 2: Manual

1. **Atualizar version.json**:
```json
{
  "version": "2.2.0",
  "releaseDate": "2025-01-15",
  "changelog": {
    "2.2.0": {
      "date": "15/01/2025",
      "title": "Sua Atualização",
      "features": [
        "🚀 Feature 1",
        "💾 Feature 2"
      ]
    }
  }
}
```

2. **Atualizar manifest.json**:
```json
{
  "version": "2.2.0"
}
```

3. **Atualizar sw.js**:
```javascript
const APP_VERSION = '2.2.0';
```

## 📋 O Que Acontece no Deploy

1. **Deploy no Vercel**: Nova versão é enviada
2. **Service Worker**: Detecta mudança automaticamente
3. **Notificação**: Usuário vê modal de atualização
4. **Changelog**: Usuário pode ver lista de novidades
5. **Atualização**: App recarrega com nova versão

## 🎯 Estratégia de Cache

- **Network First**: Sempre busca da rede primeiro
- **Cache Fallback**: Usa cache apenas se offline
- **Auto-cleanup**: Remove caches antigas automaticamente

## 💡 Vantagens

✅ **Atualização Automática**: Usuários sempre na última versão
✅ **Changelog Visível**: Transparência sobre mudanças
✅ **Sem Reinstalação**: Não precisa desinstalar/reinstalar
✅ **Experiência Suave**: Transição suave entre versões
✅ **Offline Support**: Funciona mesmo sem internet

## 🔧 Troubleshooting

### Usuário não vê atualização?

1. Verifique se Service Worker está ativo:
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Registrations:', registrations);
});
```

2. Force atualização:
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.update());
});
```

3. Limpe cache manualmente:
```javascript
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});
```

### Service Worker não atualiza?

- Aguarde até 30 segundos (intervalo de verificação)
- Feche e abra o app novamente
- Limpe dados do navegador em último caso

## 📊 Monitoramento

O sistema loga todas as ações:
- `[SW] Instalando versão X.X.X`
- `[SW] Ativando versão X.X.X`
- `[SW] Nova versão encontrada!`

Verifique o console do navegador para debugging.

## 🎨 Personalização do Changelog

Edite `version.json` para adicionar seções:

```json
{
  "2.2.0": {
    "date": "15/01/2025",
    "title": "Grande Atualização",
    "features": ["🚀 Feature 1"],
    "improvements": ["✨ Melhoria 1"],
    "fixes": ["🐛 Correção 1"]
  }
}
```

## ⚡ Boas Práticas

1. **Sempre atualize as 3 arquivos**: sw.js, version.json, manifest.json
2. **Use versionamento semântico**: MAJOR.MINOR.PATCH
3. **Escreva changelogs claros**: Use emojis e seja específico
4. **Teste localmente**: Antes de fazer deploy
5. **Monitore logs**: Verifique se usuários estão atualizando

---

**Última atualização**: 31/12/2025
**Versão atual**: 2.1.0
