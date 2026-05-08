# 🚂 Deploy no Railway - MARKIMAGEM TV

## 📋 Pré-requisitos

1. Conta no Railway (https://railway.app)
2. GitHub account (opcional, mas recomendado)
3. Código do projeto em um repositório Git

---

## 🎯 Opção 1: Deploy via GitHub (RECOMENDADO)

### Passo 1: Preparar o Repositório

```bash
# No seu terminal, navegue até o projeto
cd /app

# Inicializar Git (se ainda não tiver)
git init

# Adicionar todos os arquivos
git add .

# Fazer commit
git commit -m "Preparar para deploy no Railway"

# Criar repositório no GitHub e conectar
git remote add origin https://github.com/SEU_USUARIO/markimagem-tv.git
git branch -M main
git push -u origin main
```

### Passo 2: Deploy no Railway

1. **Acessar Railway:**
   - Vá para https://railway.app
   - Faça login com GitHub

2. **Criar Novo Projeto:**
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha o repositório `markimagem-tv`

3. **Configurar Backend:**
   - Railway detectará o `Dockerfile.backend`
   - Clique em "Add variables" e adicione:

   ```env
   MONGO_URL=mongodb+srv://...
   DB_NAME=digital_sales_app
   JWT_SECRET=digital-sales-super-secret-key-change-in-production
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
   MERCADOPAGO_PUBLIC_KEY=APP_USR-...
   WAHA_API_URL=https://waha-production-9e0b.up.railway.app
   WAHA_API_KEY=waha_vendas2025
   WAHA_SESSION=default
   ADMIN_WHATSAPP=556195021362
   WHATSAPP_SENDER_NAME=MARKIMAGEM TV
   PORT=8001
   ```

4. **Adicionar MongoDB:**
   - Clique em "+ New"
   - Selecione "Database" → "Add MongoDB"
   - Railway criará um MongoDB automaticamente
   - Copie a `MONGO_URL` e atualize nas variáveis do backend

5. **Configurar Frontend:**
   - Clique em "+ New" → "GitHub Repo" (mesmo repo)
   - Em Settings → Build:
     - Dockerfile Path: `Dockerfile.frontend`
   - Adicione variável:

   ```env
   EXPO_PUBLIC_BACKEND_URL=https://SEU-BACKEND.railway.app
   PORT=3000
   ```

6. **Obter URLs:**
   - Backend: Clique no serviço backend → Settings → Generate Domain
   - Frontend: Clique no serviço frontend → Settings → Generate Domain
   - Anote as URLs geradas (exemplo: `markimagem-backend.railway.app`)

7. **Atualizar BACKEND_URL no Frontend:**
   - Vá nas variáveis do frontend
   - Atualize `EXPO_PUBLIC_BACKEND_URL` com a URL real do backend
   - Clique em "Redeploy"

---

## 🎯 Opção 2: Deploy via Railway CLI

### Passo 1: Instalar Railway CLI

```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Windows (PowerShell)
iwr https://railway.app/install.ps1 | iex
```

### Passo 2: Fazer Login

```bash
railway login
```

### Passo 3: Inicializar Projeto

```bash
cd /app
railway init
```

### Passo 4: Deploy Backend

```bash
# Criar serviço do backend
railway up --service backend --dockerfile Dockerfile.backend

# Adicionar variáveis de ambiente
railway variables set MONGO_URL="mongodb+srv://..."
railway variables set DB_NAME="digital_sales_app"
railway variables set JWT_SECRET="your-secret-key"
railway variables set MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."
railway variables set MERCADOPAGO_PUBLIC_KEY="APP_USR-..."
railway variables set WAHA_API_URL="https://waha-production-9e0b.up.railway.app"
railway variables set WAHA_API_KEY="waha_vendas2025"
railway variables set PORT="8001"
```

### Passo 5: Deploy Frontend

```bash
# Criar serviço do frontend
railway up --service frontend --dockerfile Dockerfile.frontend

# Adicionar variável
railway variables set EXPO_PUBLIC_BACKEND_URL="https://SEU-BACKEND.railway.app"
railway variables set PORT="3000"
```

---

## 🎯 Opção 3: Deploy com Docker Compose Local

### Passo 1: Criar arquivo .env

```bash
cp backend/.env .env.production
```

Edite `.env.production` com suas credenciais.

### Passo 2: Build e Start

```bash
# Build das imagens
docker-compose build

# Iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down
```

### Passo 3: Acessar

- Frontend: http://localhost:3000
- Backend: http://localhost:8001
- MongoDB: localhost:27017

---

## 🔧 Configurações Importantes

### 1. MongoDB no Railway

O Railway oferece MongoDB gratuito com algumas limitações:
- 500MB de storage
- Sem backups automáticos no plano gratuito

**Alternativa:** Usar MongoDB Atlas (grátis com mais recursos)
1. Criar cluster em https://mongodb.com/cloud/atlas
2. Obter connection string
3. Usar no `MONGO_URL`

### 2. Domínio Personalizado

Para usar `markimagemtv.com`:
1. No Railway, vá em Settings do serviço frontend
2. Custom Domain → Add Domain
3. Digite: `markimagemtv.com`
4. Configure DNS com os registros fornecidos

### 3. Variáveis de Ambiente Sensíveis

⚠️ **NUNCA comite** arquivos `.env` no Git!

Configure todas as variáveis sensíveis diretamente no Railway:
- MERCADOPAGO_ACCESS_TOKEN
- JWT_SECRET
- WAHA_API_KEY

---

## 💰 Custos Estimados

**Railway Pricing:**
- **Hobby Plan (Gratuito):**
  - $5 de crédito/mês
  - Suficiente para projetos pequenos
  - ~500 horas de execução

- **Developer Plan ($5/mês):**
  - $5 de crédito + $5 adicionais
  - Melhor para produção
  - Mais recursos e uptime

**Estimativa para MARKIMAGEM TV:**
- Backend: ~$3-4/mês
- Frontend: ~$2-3/mês
- MongoDB (se usar Railway): ~$2/mês
- **Total:** ~$7-9/mês

---

## 🐛 Troubleshooting

### Backend não inicia

```bash
# Ver logs
railway logs --service backend

# Verificar variáveis
railway variables --service backend
```

### Frontend não conecta ao Backend

1. Verificar `EXPO_PUBLIC_BACKEND_URL` nas variáveis
2. Certificar que backend está rodando
3. Testar endpoint: `curl https://SEU-BACKEND.railway.app/api/products`

### MongoDB Connection Error

1. Verificar `MONGO_URL` está correta
2. Se usar MongoDB Atlas, liberar IP 0.0.0.0/0 (permitir de qualquer lugar)
3. Verificar username/password corretos

---

## 📊 Monitoramento

### Logs em Tempo Real

```bash
# Backend
railway logs --service backend -f

# Frontend
railway logs --service frontend -f
```

### Métricas

No dashboard do Railway você pode ver:
- CPU usage
- Memory usage
- Network traffic
- Deployment history

---

## 🚀 CI/CD Automático

Com GitHub conectado, o Railway fará deploy automático quando você:
1. Fazer push para a branch `main`
2. Criar uma Pull Request (deploy preview)
3. Merge de PR (deploy em produção)

---

## ✅ Checklist Final

- [ ] Código commitado no GitHub
- [ ] Dockerfile.backend criado
- [ ] Dockerfile.frontend criado
- [ ] Variáveis de ambiente configuradas no Railway
- [ ] MongoDB criado/conectado
- [ ] Backend deployado e funcionando
- [ ] Frontend deployado e funcionando
- [ ] URLs geradas e testadas
- [ ] Domínio personalizado configurado (opcional)
- [ ] Webhook do Mercado Pago atualizado com nova URL

---

## 📞 Suporte

Se tiver problemas:
1. Documentação Railway: https://docs.railway.app
2. Discord Railway: https://discord.gg/railway
3. Status: https://status.railway.app

---

**Boa sorte com o deploy! 🎉**