# 🌐 Guia Completo: Deploy Web (PWA) - MARKIMAGEM TV

## 📋 Visão Geral

Este guia mostra como fazer deploy do seu app como uma **PWA (Progressive Web App)** pura, **SEM DEPENDER DO EXPO GO** ou túneis.

---

## 🎯 Solução Implementada

### **Antes:**
- ❌ App dependia do túnel Expo
- ❌ Necessário Expo Go para testar
- ❌ Não acessível diretamente via navegador

### **Depois:**
- ✅ Build de produção estático (HTML/JS/CSS)
- ✅ Servido via Nginx
- ✅ Acessível diretamente no navegador
- ✅ PWA installable (pode ser adicionado à tela inicial)
- ✅ Funcionamento offline

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│         Usuário (Navegador)             │
└─────────────┬───────────────────────────┘
              │
              │ HTTPS
              ▼
┌─────────────────────────────────────────┐
│    Nginx (Servidor Web)                 │
│    - Serve arquivos estáticos           │
│    - Proxy reverso para API             │
└─────────────┬───────────────────────────┘
              │
              │ Proxy /api/*
              ▼
┌─────────────────────────────────────────┐
│    FastAPI Backend                      │
│    - API REST                           │
│    - MongoDB                            │
└─────────────────────────────────────────┘
```

---

## 📦 Arquivos Criados

1. **`Dockerfile.frontend.production`** - Build e deploy de produção
2. **`nginx.conf`** - Configuração do servidor web
3. **`build-web.sh`** - Script de build
4. **`serve-web.sh`** - Script para testar localmente
5. **`app.json.production`** - Configuração Expo para web

---

## 🚀 Opção 1: Deploy no Railway (RECOMENDADO)

### **Passo 1: Atualizar package.json**

Adicione o script de build no `/app/frontend/package.json`:

```json
{
  "scripts": {
    "web:build": "expo export:web"
  }
}
```

### **Passo 2: Criar Serviço no Railway**

1. **No Railway Dashboard:**
   - Clique em "+ New"
   - Selecione "GitHub Repo"
   - Escolha seu repositório

2. **Configurar Build:**
   - Settings → Build
   - Builder: `Dockerfile`
   - Dockerfile Path: `Dockerfile.frontend.production`

3. **Adicionar Variáveis:**
   ```env
   BACKEND_URL=https://seu-backend.railway.app
   EXPO_PUBLIC_BACKEND_URL=https://seu-backend.railway.app
   ```

4. **Deploy:**
   - Clique em "Deploy"
   - Aguarde o build (3-5 minutos)

5. **Obter URL:**
   - Settings → Generate Domain
   - Sua URL: `https://markimagem-tv.railway.app`

### **Passo 3: Configurar Domínio Personalizado**

1. **No Railway:**
   - Settings → Custom Domain
   - Digite: `markimagemtv.com`

2. **No seu provedor de domínio:**
   - Adicione registro CNAME:
   ```
   CNAME markimagemtv.com → seu-app.railway.app
   ```

3. **Aguardar propagação DNS (5-30 minutos)**

---

## 🧪 Opção 2: Testar Localmente

### **Método 1: Com Docker**

```bash
# Build da imagem
cd /app
docker build -f Dockerfile.frontend.production -t markimagem-web .

# Rodar container
docker run -p 3000:80 \
  -e BACKEND_URL=http://localhost:8001 \
  markimagem-web

# Acessar
open http://localhost:3000
```

### **Método 2: Build Manual**

```bash
# Executar script de build
cd /app
bash build-web.sh

# Servir com script
bash serve-web.sh

# Ou com Python
cd frontend/web-build
python3 -m http.server 3000
```

---

## 🌐 Opção 3: Deploy em Outros Provedores

### **Vercel (Grátis)**

```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer build
cd /app/frontend
yarn web:build

# Deploy
cd web-build
vercel --prod
```

### **Netlify (Grátis)**

1. Conecte seu repositório GitHub
2. Configure:
   - Build command: `cd frontend && yarn web:build`
   - Publish directory: `frontend/web-build`
3. Deploy

### **AWS S3 + CloudFront**

```bash
# Build
cd /app/frontend
yarn web:build

# Upload para S3
aws s3 sync web-build/ s3://seu-bucket/ --delete

# Invalidar cache do CloudFront
aws cloudfront create-invalidation --distribution-id SEU_ID --paths "/*"
```

---

## 🔧 Configurações Importantes

### **1. Variáveis de Ambiente**

No arquivo de build, configure:

```bash
export EXPO_PUBLIC_BACKEND_URL=https://seu-backend.railway.app
```

Ou no Railway:
```env
BACKEND_URL=https://seu-backend.railway.app
EXPO_PUBLIC_BACKEND_URL=https://seu-backend.railway.app
```

### **2. CORS no Backend**

Certifique-se que o backend aceita requisições do seu domínio:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://markimagemtv.com",
        "https://markimagem-tv.railway.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### **3. PWA Features**

O Expo automaticamente gera:
- ✅ `manifest.json` - Metadados do app
- ✅ Service Worker - Cache offline
- ✅ Ícones em múltiplos tamanhos

---

## 📊 Otimizações

### **1. Compressão Gzip**

Já configurado no `nginx.conf`:
- Reduz tamanho dos arquivos em ~70%
- Melhora tempo de carregamento

### **2. Cache de Assets**

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### **3. Code Splitting**

O Expo/Metro automaticamente divide o código em chunks menores.

---

## 🐛 Troubleshooting

### **Build falha com erro de memória**

```bash
# Aumentar memória do Node
export NODE_OPTIONS="--max-old-space-size=4096"
yarn web:build
```

### **API não conecta (CORS)**

1. Verificar `EXPO_PUBLIC_BACKEND_URL`
2. Verificar CORS no backend
3. Testar endpoint: `curl https://seu-backend.railway.app/health`

### **App não carrega assets**

1. Limpar cache: `rm -rf .expo`
2. Rebuild: `yarn web:build`
3. Verificar console do navegador (F12)

### **Rotas retornam 404**

- Nginx não está configurado para SPA
- Verificar `try_files $uri $uri/ /index.html;` no nginx.conf

---

## ✅ Checklist Final

- [ ] Script `web:build` adicionado ao package.json
- [ ] `Dockerfile.frontend.production` criado
- [ ] `nginx.conf` criado
- [ ] Variável `EXPO_PUBLIC_BACKEND_URL` configurada
- [ ] CORS configurado no backend
- [ ] Build local testado com sucesso
- [ ] Deploy no Railway concluído
- [ ] URL acessível no navegador
- [ ] PWA installable (ícone "Adicionar à tela inicial")
- [ ] Domínio personalizado configurado (opcional)

---

## 🎯 Resultado Final

**Antes:**
```
Usuário → Expo Go → Túnel → App
```

**Depois:**
```
Usuário → Navegador → Nginx → App (PWA)
                         ↓
                    Backend API
```

**Acesso direto:** `https://markimagemtv.com` 🎉

---

## 💰 Custos Estimados

**Railway:**
- Frontend (static): ~$0-2/mês
- Backend: ~$3-5/mês
- **Total**: ~$3-7/mês

**Vercel/Netlify (grátis):**
- Frontend: $0
- Backend (Railway): ~$3-5/mês
- **Total**: ~$3-5/mês

---

## 📞 Suporte

**Documentação:**
- Expo Web: https://docs.expo.dev/workflow/web/
- React Native Web: https://necolas.github.io/react-native-web/
- Railway: https://docs.railway.app

**Problemas comuns:**
- GitHub Issues do projeto
- Railway Discord
- Expo Forums