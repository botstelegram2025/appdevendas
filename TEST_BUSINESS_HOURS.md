# 🧪 Guia de Teste - Sistema de Horário de Atendimento

## ✅ Como Testar o Sistema Completo

### 1. **Configurar Horários (Admin)**

1. Faça login como admin
2. Acesse: **Admin Dashboard → Horário de Atendimento**
3. Ative o sistema (switch no topo)
4. Configure uma mensagem personalizada
5. Configure os horários por dia da semana

**Exemplo de Configuração para Teste:**
```
Segunda a Sexta: 09:00 - 18:00 (Aberto)
Sábado: 09:00 - 12:00 (Aberto)
Domingo: Fechado

Mensagem: "🕐 Estamos fechados no momento. Voltaremos em breve!"
```

### 2. **Testar API Diretamente**

**Verificar Status Atual:**
```bash
curl http://localhost:8001/api/business-hours/status | python3 -m json.tool
```

**Resposta quando ABERTO:**
```json
{
  "is_open": true,
  "closes_at": "18:00",
  "current_day_name": "Segunda",
  "system_enabled": true
}
```

**Resposta quando FECHADO:**
```json
{
  "is_open": false,
  "message": "🕐 Estamos fechados no momento. Voltaremos em breve!",
  "next_open": {
    "day": 1,
    "day_name": "Segunda",
    "time": "09:00",
    "today": false
  },
  "current_time": "20:30",
  "current_day_name": "Domingo",
  "system_enabled": true
}
```

### 3. **Testar Frontend Cliente**

**Cenário 1: Dentro do Horário**
1. Faça login como cliente
2. App funciona normalmente
3. Nenhum modal aparece

**Cenário 2: Fora do Horário**
1. Admin muda configuração para simular "fechado"
   - Ex: Configure horário de Segunda como 09:00 - 10:00
   - Se for após 10:00, estará fechado
2. Cliente recarrega o app ou aguarda 1 minuto
3. **Modal de bloqueio aparece**:
   - Ícone de relógio vermelho
   - Mensagem personalizada
   - Próxima abertura
   - Botão "Verificar Novamente"

### 4. **Cenários de Teste**

#### Teste A: Loja Fechada aos Domingos
```
1. Admin marca Domingo como "Fechado"
2. Mude a hora do sistema para domingo (ou aguarde domingo)
3. Cliente acessa app → Modal aparece
4. Modal mostra: "Próxima Abertura: Segunda às 09:00"
```

#### Teste B: Fora do Horário Comercial
```
1. Admin configura: Segunda 09:00-18:00
2. São 19:00 (após fechamento)
3. Cliente acessa → Modal aparece
4. Modal mostra: "Próxima Abertura: Terça às 09:00"
```

#### Teste C: Antes de Abrir
```
1. Admin configura: Segunda 09:00-18:00
2. São 08:00 (antes de abrir)
3. Cliente acessa → Modal aparece
4. Modal mostra: "Próxima Abertura: Segunda às 09:00" (hoje)
```

#### Teste D: Sistema Desativado
```
1. Admin desativa o sistema de horários
2. Cliente sempre consegue acessar
3. Modal nunca aparece
```

### 5. **Verificar Logs do Backend**

Quando o endpoint é consultado, o backend loga:
```
🕐 Verificação de horário: Dia=Segunda, Hora Atual=14:30, Abre=09:00, Fecha=18:00
✅ Loja ABERTA - Fecha às 18:00
```

ou

```
🕐 Verificação de horário: Dia=Domingo, Hora Atual=15:00, Abre=09:00, Fecha=18:00
🔒 Loja fechada - Domingo marcado como fechado
```

**Ver logs em tempo real:**
```bash
tail -f /var/log/supervisor/backend.out.log | grep "🕐\|✅\|🔒"
```

### 6. **Testar Atualização Automática**

1. Cliente está com app aberto (modal de fechado visível)
2. Admin muda horário para "aberto"
3. Cliente clica "Verificar Novamente"
4. Modal desaparece
5. App funciona normalmente

### 7. **Checklist de Testes**

- [ ] Sistema ativa/desativa corretamente
- [ ] Mensagem personalizada aparece no modal
- [ ] Horários por dia são respeitados
- [ ] Dias fechados bloqueiam acesso
- [ ] Próxima abertura é calculada corretamente
- [ ] Modal aparece/desaparece automaticamente
- [ ] Botão "Verificar Novamente" funciona
- [ ] Verificação automática a cada 1 minuto funciona
- [ ] Timezone Brasil (America/Sao_Paulo) está correto
- [ ] Admin pode salvar alterações

### 8. **Troubleshooting**

**Modal não aparece quando deveria:**
- Verifique se sistema está ativado no admin
- Verifique horários configurados
- Veja logs do backend para debug
- Confirme que cliente está consultando a API

**Horário errado:**
- Verifique timezone (deve ser America/Sao_Paulo)
- Confirme configuração no banco de dados
- Verifique hora do sistema: `date`

**API retorna erro:**
- Verifique se MongoDB está rodando
- Confirme que coleção business_hours existe
- Veja logs: `tail -f /var/log/supervisor/backend.err.log`

### 9. **Dados de Teste Úteis**

**Login Admin:**
- CPF: 99064820104
- Senha: 152316

**Endpoints Importantes:**
```
GET  /api/business-hours/status                 (Público)
GET  /api/admin/business-hours/config           (Admin)
PUT  /api/admin/business-hours/config           (Admin)
PUT  /api/admin/business-hours/schedule/{day}   (Admin)
```

### 10. **Simulação Manual de Horário**

Para testar sem esperar o horário real, você pode:

1. **Ajustar horários de teste:**
   - Configure horário atual +/- 1 hora
   - Ex: Se são 14:00, configure 13:00-15:00 (aberto) ou 09:00-13:00 (fechado)

2. **Usar dias diferentes:**
   - Marque dia atual como fechado para teste rápido
   - Reative depois do teste

---

## ✨ Sistema Funcionando Corretamente Quando:

✅ Modal aparece imediatamente quando fora do horário
✅ Modal mostra mensagem personalizada do admin
✅ Próxima abertura é calculada e exibida
✅ Modal desaparece quando dentro do horário
✅ Admin consegue configurar todos os dias
✅ Salvamentos refletem imediatamente
✅ Logs do backend mostram verificações corretas

**Sistema pronto para produção!** 🚀
