# Bot WhatsApp — Salão de Manicure

Bot de atendimento automatizado via WhatsApp para salão de manicure com agendamento inteligente, sistema de fidelidade e painel administrativo.

---

## ✅ O que o bot faz

- Menu automático no primeiro contato
- Agendamento completo (serviço → profissional → data → horário → confirmação)
- Cancelamento e remarcação de horários
- Bloqueia horários conflitantes pela duração do serviço
- Lembrete automático 24h antes com pedido de confirmação
- Cancelamento automático se cliente não confirmar
- Sistema de fidelidade (10 atendimentos = 1 grátis)
- Classificação de clientes (VIP, Frequente, Normal, Inativo)
- Campanha de reativação para clientes inativos
- API REST para painel administrativo

---

## 🛠 Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para o PostgreSQL)
- [Evolution API](https://github.com/EvolutionAPI/evolution-api) instalada e rodando

---

## 🚀 Passo a passo para rodar

### 1. Abrir o projeto no VSCode

Abra a pasta `salon-bot` no VSCode.

### 2. Instalar dependências

Abra o terminal integrado do VSCode (`Ctrl + '`) e rode:

```bash
npm install
```

### 3. Subir o banco de dados PostgreSQL

```bash
docker-compose up -d
```

Aguarde ~30 segundos. O PostgreSQL vai subir na porta 5432.

### 4. Configurar variáveis de ambiente

```bash
# Copie o arquivo de exemplo
copy .env.example .env     # Windows
cp .env.example .env       # Mac/Linux
```

Abra o arquivo `.env` e preencha:

| Variável | O que é | Exemplo |
|---|---|---|
| `DATABASE_URL` | Conexão com PostgreSQL | `postgresql://postgres:suasenha@localhost:5432/salon_bot` |
| `EVOLUTION_API_URL` | URL da Evolution API | `http://localhost:8080` |
| `EVOLUTION_API_KEY` | Chave da Evolution API | `sua-chave-aqui` |
| `EVOLUTION_INSTANCE` | Nome da instância WA | `meu-salao` |
| `ADMIN_PHONE` | Seu número (alertas) | `5511999999999` |

### 5. Criar as tabelas no banco

```bash
npm run db:migrate
```

### 6. Popular dados iniciais (serviços, profissionais, admin)

```bash
npm run db:seed
```

Isso vai criar:
- 👩 Profissionais: Ana e Carol
- 💅 10 serviços com preços
- 🔑 Admin: `admin@salaonails.com` / senha: `admin123`

### 7. Iniciar o servidor

```bash
npm run dev
```

Você vai ver:
```
✅ Banco de dados conectado
🚀 Servidor rodando na porta 3000
📡 Webhook: http://localhost:3000/webhook/whatsapp
```

### 8. Configurar o Webhook na Evolution API

No painel da Evolution API, configure o webhook apontando para:
```
http://SEU-IP:3000/webhook/whatsapp
```

> 💡 Para desenvolvimento local, use o [ngrok](https://ngrok.com):
> ```bash
> ngrok http 3000
> ```
> Use a URL gerada (ex: `https://abc123.ngrok.io/webhook/whatsapp`)

### 9. Conectar o WhatsApp

No painel da Evolution API, escaneie o QR Code com o WhatsApp do salão.

### 10. Testar!

Envie uma mensagem de qualquer número para o WhatsApp do salão. O bot vai responder automaticamente! 🎉

---

## 🔑 API do Painel Admin

### Login
```http
POST /api/admin/login
Content-Type: application/json

{
  "email": "admin@salaonails.com",
  "senha": "admin123"
}
```

Use o `token` retornado em todas as requisições seguintes como:
```
Authorization: Bearer SEU_TOKEN
```

### Principais endpoints

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/admin/dashboard` | Métricas gerais |
| GET | `/api/admin/agendamentos?data=2024-02-15` | Agenda do dia |
| PATCH | `/api/admin/agendamentos/:id/concluir` | Concluir atendimento |
| GET | `/api/admin/clientes` | Listar clientes |
| GET | `/api/admin/clientes?classificacao=VIP` | Clientes VIP |
| GET | `/api/admin/relatorio/financeiro?inicio=2024-01-01` | Relatório financeiro |
| PUT | `/api/admin/config/nome_salao` | Alterar nome do salão |

---

## ⚙️ Personalizando o salão

Após rodar o seed, edite diretamente no banco (use `npm run db:studio`) ou via API:

### Alterar nome do salão
```http
PUT /api/admin/config/nome_salao
{ "valor": "Studio da Samara" }
```

### Alterar horário de funcionamento
```http
PUT /api/admin/config/horario_abertura
{ "valor": "09:00" }

PUT /api/admin/config/horario_fechamento
{ "valor": "19:00" }
```

### Adicionar profissional (via banco)
Use o `npm run db:studio` para abrir interface visual e adicionar diretamente na tabela `profissionais`.

---

## 📁 Estrutura de arquivos

```
salon-bot/
├── src/
│   ├── app.js                    → Entrada principal
│   ├── config/
│   │   ├── env.js                → Variáveis de ambiente
│   │   └── database.js           → Conexão Prisma
│   ├── controllers/
│   │   ├── webhookController.js  → Recebe mensagens WA
│   │   └── adminController.js    → Painel admin
│   ├── flows/
│   │   ├── fluxoPrincipal.js     → Cérebro do bot (toda a conversa)
│   │   └── fluxoLembrete.js      → Confirmação de lembretes
│   ├── services/
│   │   ├── agendamentoService.js → Lógica de agenda
│   │   ├── clienteService.js     → Clientes e fidelidade
│   │   └── conversaService.js    → Estado da conversa
│   ├── jobs/
│   │   └── lembreteJob.js        → Tarefas automáticas (cron)
│   ├── routes/
│   │   ├── webhook.js
│   │   └── admin.js
│   ├── middleware/
│   │   └── auth.js               → JWT
│   └── utils/
│       ├── whatsapp.js           → Envio de mensagens
│       ├── dateHelper.js         → Datas e slots
│       └── logger.js             → Logs
├── prisma/
│   ├── schema.prisma             → Estrutura do banco
│   └── seed.js                   → Dados iniciais
├── .env.example                  → Modelo de configuração
├── docker-compose.yml            → PostgreSQL local
└── package.json
```

---

## 🔧 Comandos úteis

```bash
npm run dev          # Inicia em modo desenvolvimento (auto-restart)
npm start            # Inicia em produção
npm run db:studio    # Interface visual do banco (abre no navegador)
npm run db:migrate   # Aplica mudanças no schema
npm run db:seed      # Popula dados iniciais
```

---

## ❓ Problemas comuns

**"Cannot connect to database"**
→ Verifique se o Docker está rodando: `docker ps`
→ Confirme o `DATABASE_URL` no `.env`

**"EVOLUTION_API_URL not defined"**
→ Você esqueceu de copiar o `.env.example` para `.env`

**Bot não responde**
→ Verifique se o webhook está configurado corretamente na Evolution API
→ Veja os logs no terminal ou na pasta `logs/`

**"Route not found" no webhook**
→ A rota correta é `POST /webhook/whatsapp` (não `/api/webhook`)

---

## 📞 Suporte

Para dúvidas técnicas, abra uma issue ou consulte a documentação da [Evolution API](https://doc.evolution-api.com).
