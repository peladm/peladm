# 🚀 PROCESSO DE CADASTRO DE CLIENTE PREMIUM

## 1️⃣ CRIAR PROJETO NO SUPABASE

1. Acesse https://supabase.com
2. Crie um novo projeto
3. Aguarde a criação (1-2 minutos)
4. Copie a **URL** e **anon key**

## 2️⃣ EXECUTAR SCRIPT SQL

1. No Supabase do cliente, vá em **SQL Editor**
2. Clique em **New Query**
3. Cole todo o conteúdo do arquivo: `database-scripts/SETUP-CLIENTE-PREMIUM.sql`
4. Clique em **Run** ▶️
5. Aguarde a mensagem: "✅ Setup completo! Todas as tabelas foram criadas."

## 3️⃣ CADASTRAR CLIENTE NO SISTEMA

1. Acesse: `/admin/clientes/cadastrar`
2. Preencha os dados:
   - **Nome:** Nome do cliente
   - **Telefone:** (opcional)
   - **Plano:** Premium
   - **Status:** Ativo
   - **Supabase URL:** Cole a URL copiada
   - **Supabase Anon Key:** Cole a anon key
3. Salve

## 4️⃣ TESTAR

1. Faça login com o código do cliente (pelada_id gerado)
2. Usuario: `admin`
3. Senha: (a senha de 4 dígitos gerada)
4. O sistema vai usar automaticamente o banco dedicado!

## ⚙️ AUTOMAÇÃO FUTURA (OPCIONAL)

Você pode criar uma função que:
1. Recebe URL + anon key
2. Executa o script SQL automaticamente via API do Supabase
3. Evita processo manual

## 📝 NOTAS

- **Plano Free:** Usa o banco principal (todos os clientes compartilham)
- **Plano Premium:** Banco dedicado (isolamento total)
- Cada banco premium precisa rodar o script de setup uma vez
