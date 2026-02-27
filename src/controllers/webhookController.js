// src/controllers/webhookController.js
const { processarMensagem } = require('../flows/fluxoPrincipal');
const { formatarTelefone } = require('../utils/whatsapp');
const logger = require('../utils/logger');

// Rate limiting por telefone (anti-spam)
const rateLimits = new Map();
const MAX_MSG_POR_MINUTO = 15;

function verificarRateLimit(telefone) {
  const agora = Date.now();
  const janela = 60 * 1000;

  if (!rateLimits.has(telefone)) {
    rateLimits.set(telefone, { count: 1, inicio: agora });
    return true;
  }

  const dados = rateLimits.get(telefone);
  if (agora - dados.inicio > janela) {
    rateLimits.set(telefone, { count: 1, inicio: agora });
    return true;
  }

  dados.count++;
  if (dados.count > MAX_MSG_POR_MINUTO) {
    logger.warn(`🚫 Rate limit atingido para ${telefone}`);
    return false;
  }

  return true;
}

/**
 * Processa webhook da Evolution API
 * POST /webhook/whatsapp
 */
async function receberWebhook(req, res) {
  // Responde 200 imediatamente para não dar timeout na Evolution API
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    // Formato Evolution API
    const event = body.event;
    if (event !== 'messages.upsert') return;

    const mensagens = body.data?.messages || [body.data] || [];

    for (const msg of mensagens) {
      // Ignorar mensagens do próprio bot e grupos
      if (msg.key?.fromMe) continue;
      if (msg.key?.remoteJid?.includes('@g.us')) continue; // ignorar grupos

      const telefone = formatarTelefone(msg.key?.remoteJid?.replace('@s.whatsapp.net', '') || '');
      if (!telefone) continue;

      // Extrair texto da mensagem
      const texto =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';

      if (!texto) continue;

      // Rate limit
      if (!verificarRateLimit(telefone)) continue;

      logger.info(`📩 Webhook recebido de ${telefone}: "${texto}"`);

      // Processar de forma assíncrona
      processarMensagem(telefone, texto).catch(err => {
        logger.error(`❌ Erro ao processar mensagem de ${telefone}: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`❌ Erro no webhook: ${err.message}`);
  }
}

module.exports = { receberWebhook };
