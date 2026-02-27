const axios = require('axios');
const env = require('../config/env');
const logger = require('./logger');

const api = axios.create({
  baseURL: env.EVOLUTION_API_URL,
  headers: {
    'apikey': env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Envia uma mensagem de texto via Evolution API
 * @param {string} telefone - número no formato 5511999999999 ou JID (@lid)
 * @param {string} mensagem - texto a enviar
 */
async function enviarMensagem(telefone, mensagem) {
  try {
    // Se o número tiver um '@' (ex: @lid ou @g.us), mantemos intacto.
    // Se for um telefone normal, tiramos os espaços e traços.
    const numero = telefone.includes('@') ? telefone : telefone.replace(/\D/g, '');
    
    await api.post(`/message/sendText/${env.EVOLUTION_INSTANCE}`, {
      number: numero,
      text: mensagem,
    });
    logger.info(`📤 Mensagem enviada para ${numero}`);
  } catch (error) {
    logger.error(`❌ Erro ao enviar mensagem para ${telefone}: ${error.message}`);
    throw error;
  }
}

/**
 * Formata o número para padrão brasileiro
 */
function formatarTelefone(telefone) {
  // Ignora a formatação se for um ID especial do WhatsApp
  if (telefone.includes('@')) return telefone;
  
  return telefone.replace(/\D/g, '').replace(/^0/, '55');
}

/**
 * Verifica se a instância está conectada
 */
async function verificarConexao() {
  try {
    const response = await api.get(`/instance/connectionState/${env.EVOLUTION_INSTANCE}`);
    return response.data?.instance?.state === 'open';
  } catch {
    return false;
  }
}

module.exports = { enviarMensagem, formatarTelefone, verificarConexao };