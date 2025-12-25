# PelADM - Guia de Publicação na Vercel

## 📦 Preparação Concluída

Seu projeto agora está configurado como PWA e pronto para publicação!

### ✅ Configurações Implementadas:
- ✓ PWA configurado (manifest.json + service worker)
- ✓ Ícone do app (usando logo.png)
- ✓ Nome: PelADM
- ✓ Cor tema: Verde (#16a34a)
- ✓ Instalável em dispositivos móveis
- ✓ Funciona offline (cache básico)

---

## 🚀 Passo a Passo - Deploy na Vercel

### 1️⃣ **Criar conta na Vercel**
- Acesse: https://vercel.com
- Faça login com sua conta GitHub

### 2️⃣ **Fazer Push do código para GitHub**
```bash
# Se ainda não iniciou o git
git init
git add .
git commit -m "feat: PWA configurado e pronto para deploy"

# Criar repositório no GitHub e vincular
git remote add origin https://github.com/SEU-USUARIO/peladm.git
git branch -M main
git push -u origin main
```

### 3️⃣ **Importar projeto na Vercel**
1. Na Vercel, clique em "Add New Project"
2. Selecione "Import Git Repository"
3. Escolha seu repositório `peladm`
4. Clique em "Import"

### 4️⃣ **Configurar variáveis de ambiente**
No painel da Vercel, adicione as variáveis:
```
NEXT_PUBLIC_SUPABASE_URL=https://ewcswczqvelhlwpbraea.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=seu_anon_key_aqui
```

### 5️⃣ **Deploy**
- Clique em "Deploy"
- Aguarde o build (~2-3 minutos)
- Seu app estará no ar! 🎉

### 6️⃣ **Domínio Personalizado (quando comprar)**
1. No painel Vercel, vá em "Settings" → "Domains"
2. Adicione seu domínio `.com.br`
3. Configure os DNS conforme instruções da Vercel
4. Aguarde propagação (~24h)

---

## 📱 Como Instalar o PWA

### **Android:**
1. Abra o site no Chrome
2. Toque no menu (⋮)
3. Selecione "Adicionar à tela inicial"
4. Confirme

### **iOS:**
1. Abra no Safari
2. Toque no botão compartilhar (⎵)
3. Role e selecione "Adicionar à Tela Inicial"
4. Confirme

---

## 🔧 Comandos Úteis

```bash
# Build local para testar
npm run build
npm run start

# Desenvolvimento
npm run dev

# Limpar cache
rm -rf .next
npm run build
```

---

## 📊 Após o Deploy

**URL gerada pela Vercel:**
`https://peladm-seu-usuario.vercel.app`

**Recursos automáticos:**
- ✓ HTTPS automático
- ✓ CDN global
- ✓ Deploy automático a cada push
- ✓ Preview de branches
- ✓ Analytics (opcional)

---

## 🎯 Próximos Passos

1. Testar o app no mobile
2. Instalar como PWA
3. Verificar funcionamento offline
4. Comprar domínio .com.br
5. Configurar domínio personalizado

**Seu PelADM está pronto para o mundo! ⚽🎉**
