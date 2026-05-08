# 🚀 Guia: Instalar WAHA Plus no Railway

## 📋 Pré-requisitos
- Conta Railway
- Chave de licença WAHA Plus (comprar em https://waha.devlike.pro)

## 🛠️ Passo a Passo

### 1. Criar Novo Serviço no Railway

1. Acesse seu projeto no Railway
2. Clique em **"+ New Service"**
3. Selecione **"Docker Image"**

### 2. Configurar o Serviço

**Nome do Serviço:** `waha-plus`

**Docker Image:** `devlikeapro/waha-plus:latest`

### 3. Configurar Variáveis de Ambiente

No Railway, adicione estas variáveis de ambiente no serviço WAHA:

```bash
# OBRIGATÓRIAS
WAHA_API_KEY=sua_chave_secreta_aqui_123456789

# RECOMENDADAS
WHATSAPP_DEFAULT_ENGINE=WEBJS
WHATSAPP_API_PORT=3000
WAHA_PRINT_QR=false

# OPCIONAIS (para 100 sessões)
WHATSAPP_MAX_SESSION=100
WHATSAPP_RESTART_ALL_SESSIONS=true

# SEGURANÇA
WAHA_DASHBOARD_ENABLED=true
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=SuaSenhaForte123!
```

**IMPORTANTE:** Anote o valor de `WAHA_API_KEY` - você vai precisar!

### 4. Expor Porta Pública

1. No Railway, vá em **Settings** do serviço WAHA
2. Em **Networking**, clique em **"Generate Domain"**
3. Railway vai gerar uma URL pública tipo: `waha-plus-production-xxxx.up.railway.app`
4. **ANOTE ESSA URL** - será sua `WAHA_API_URL`

### 5. Deploy

1. Clique em **"Deploy"**
2. Aguarde ~2-3 minutos para o serviço iniciar
3. Acesse a URL gerada para ver o Swagger: `https://seu-waha.railway.app`

### 6. Testar Conexão

Abra o terminal e teste:

```bash
curl -X GET "https://seu-waha.railway.app/api/sessions" \
  -H "X-Api-Key: sua_chave_secreta_aqui_123456789"
```

Se retornar `[]` (array vazio), está funcionando! ✅

### 7. Acessar Dashboard (Opcional)

```
URL: https://seu-waha.railway.app/dashboard
Usuário: admin
Senha: SuaSenhaForte123!
```

## 📝 Próximos Passos

Após configurar o WAHA Plus no Railway:

1. Copie a **URL do serviço** (ex: https://waha-plus-xxxx.railway.app)
2. Copie o **API Key** que você definiu
3. Continue para Etapa 2: Configurar Backend

## ⚠️ Notas Importantes

- **Custo:** WAHA Plus no Railway consome recursos. Para 100 sessões, considere um plano Railway adequado
- **Persistência:** Sessões são mantidas em memória. Se o serviço reiniciar, você precisará reconectar QR Codes
- **Volumes:** Para persistir sessões após restart, considere adicionar volume (avançado)

## 🆘 Problemas Comuns

**Erro 401 Unauthorized:**
- Verifique se o `X-Api-Key` está correto

**Serviço não inicia:**
- Verifique os logs no Railway
- Certifique-se que a porta 3000 está configurada

**Dashboard não abre:**
- Verifique se `WAHA_DASHBOARD_ENABLED=true`
- Tente acessar `/dashboard` na URL

---

**Pronto!** WAHA Plus configurado no Railway! 🎉

Continue para o próximo passo para integrar com seu backend FastAPI.
