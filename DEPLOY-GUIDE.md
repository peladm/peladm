# ⚽ Pelada 3 - Instruções de Deploy

## 🚀 **PASSO A PASSO PARA PUBLICAR NO GITHUB PAGES**

### **📋 Pré-requisitos**
- ✅ Conta no GitHub (criar em: https://github.com)
- ✅ Git instalado (download: https://git-scm.com)

---

## **1️⃣ CRIAR CONTA NO GITHUB**

1. Acesse: https://github.com
2. Clique em **"Sign up"**
3. Escolha um **username** (será parte da URL do seu site)
4. Confirme o email

---

## **2️⃣ CRIAR REPOSITÓRIO**

1. No GitHub, clique em **"New repository"** (botão verde)
2. **Repository name**: `pelada-3` (ou outro nome)
3. ✅ Marque **"Public"**
4. ✅ Marque **"Add a README file"**
5. Clique em **"Create repository"**

---

## **3️⃣ FAZER UPLOAD DOS ARQUIVOS**

### **Opção A: Via Interface Web (Mais Fácil)**
1. No repositório criado, clique em **"uploading an existing file"**
2. Arraste TODOS os arquivos da pasta `Pelada 3`
3. Digite uma mensagem: `"Initial commit - Pelada 3 System"`
4. Clique em **"Commit changes"**

### **Opção B: Via Git (Terminal)**
```bash
git clone https://github.com/SEU-USERNAME/pelada-3.git
cd pelada-3
# Copie todos os arquivos para esta pasta
git add .
git commit -m "Initial commit - Pelada 3 System"
git push origin main
```

---

## **4️⃣ ATIVAR GITHUB PAGES**

1. No repositório, vá em **"Settings"** (aba superior)
2. Role para baixo até **"Pages"** (menu lateral esquerdo)
3. Em **"Source"**, selecione **"GitHub Actions"**
4. **Pronto!** O deploy automático vai começar

---

## **5️⃣ ACESSAR SEU SITE**

Após 2-5 minutos, seu site estará disponível em:
```
https://SEU-USERNAME.github.io/pelada-3
```

### **🔧 Se der erro:**
- Verifique se o repositório é **Public**
- Aguarde alguns minutos para o processamento
- Vá em **"Actions"** para ver o status do deploy

---

## **📱 CONFIGURAÇÕES EXTRAS**

### **🌐 Domínio Personalizado (Opcional)**
1. Compre um domínio (ex: minhapelada.com)
2. Em **"Settings" > "Pages" > "Custom domain"**
3. Digite seu domínio
4. Configure DNS no provedor do domínio

### **🔒 HTTPS**
- ✅ Automático no GitHub Pages
- ✅ Certificado SSL gratuito

---

## **🎯 PRÓXIMOS PASSOS**

1. **Teste todas as funcionalidades** no site publicado
2. **Compartilhe a URL** com os jogadores
3. **Gerencie usuários** pelo painel admin
4. **Atualize o código** quando necessário (push para GitHub)

---

## **🆘 SUPORTE**

### **Site não carrega?**
- Verificar se repositório é Public
- Aguardar 5-10 minutos após upload
- Verificar mensagens de erro em "Actions"

### **Funcionalidades não funcionam?**
- ✅ Supabase configurado corretamente
- ✅ URLs atualizadas para produção
- ✅ Todas as dependências incluídas

---

## **🏆 SUCESSO!**

Parabéns! Seu sistema está online e funcionando! 🎉

**URL do seu site**: `https://SEU-USERNAME.github.io/pelada-3`