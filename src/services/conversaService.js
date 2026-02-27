// src/services/conversaService.js
const prisma = require('../config/database');

/**
 * Busca o estado atual da conversa de um telefone
 */
async function buscarEstado(telefone) {
  return prisma.estadoConversa.findUnique({ where: { telefone } });
}

/**
 * Cria ou atualiza o estado da conversa
 */
async function salvarEstado(telefone, etapa, dadosTemp = null, clienteId = null) {
  return prisma.estadoConversa.upsert({
    where: { telefone },
    update: {
      etapa,
      dadosTemp,
      ...(clienteId && { clienteId }),
      tentativasInvalidas: etapa === 'MENU' ? 0 : undefined,
    },
    create: {
      telefone,
      etapa,
      dadosTemp,
      clienteId,
    },
  });
}

/**
 * Reseta a conversa para o menu inicial
 */
async function resetarConversa(telefone) {
  return salvarEstado(telefone, 'MENU', null);
}

/**
 * Incrementa tentativas inválidas (para transferir para humano)
 */
async function incrementarTentativas(telefone) {
  const estado = await buscarEstado(telefone);
  if (!estado) return 1;

  const novasTentativas = (estado.tentativasInvalidas || 0) + 1;
  await prisma.estadoConversa.update({
    where: { telefone },
    data: { tentativasInvalidas: novasTentativas },
  });
  return novasTentativas;
}

/**
 * Registra interação no banco
 */
async function registrarInteracao(telefone, clienteId, recebida, enviada, etapa) {
  return prisma.interacaoWhatsapp.create({
    data: {
      telefone,
      clienteId,
      mensagemRecebida: recebida,
      mensagemEnviada: enviada,
      etapaConversa: etapa,
      direcao: 'INBOUND',
    },
  });
}

module.exports = {
  buscarEstado,
  salvarEstado,
  resetarConversa,
  incrementarTentativas,
  registrarInteracao,
};
