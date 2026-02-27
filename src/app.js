// src/app.js
require('./config/env'); // Valida variáveis de ambiente
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const { inicializarJobs } = require('./jobs/lembreteJob');
const logger = require('./utils/logger');
const prisma = require('./config/database');

// Garantir pasta de logs
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARES ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit geral da API
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: { erro: 'Muitas requisições, tente novamente em alguns minutos.' },
}));

// Rate limit mais restrito para login
app.use('/api/admin/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' },
}));

// ── ROTAS ─────────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'erro', banco: 'desconectado' });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Erro não tratado: ${err.message}`);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────────
async function iniciar() {
  try {
    await prisma.$connect();
    logger.info('✅ Banco de dados conectado');

    inicializarJobs();

    app.listen(PORT, () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT}`);
      logger.info(`📡 Webhook: http://localhost:${PORT}/webhook/whatsapp`);
      logger.info(`🔑 Admin API: http://localhost:${PORT}/api/admin`);
    });
  } catch (err) {
    logger.error(`❌ Erro ao iniciar: ${err.message}`);
    process.exit(1);
  }
}

iniciar();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Encerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});
