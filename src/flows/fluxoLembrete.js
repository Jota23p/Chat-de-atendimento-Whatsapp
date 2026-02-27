// src/flows/fluxoLembrete.js
// Adiciona tratamento da etapa CONFIRMAR_LEMBRETE no fluxo principal
// Este arquivo é importado e mesclado no fluxoPrincipal.js

const prisma = require('../config/database');
const { enviarMensagem } = require('../utils/whatsapp');
const { salvarEstado, resetarConversa } = require('../services/conversaService');
const { confirmarAgendamento, cancelarAgendamento, formatarConfirmacao } = require('../services/agendamentoService');

async function processarConfirmacaoLembrete(telefone, mensagem, dados) {
  const { agendamentoId } = dados;

  if (mensagem === '1') {
    const ag = await confirmarAgendamento(agendamentoId);
    await enviarMensagem(telefone,
      `✅ *Confirmado!* Te esperamos! 💖\n\n` + formatarConfirmacao(ag)
    );
  } else if (mensagem === '2') {
    await cancelarAgendamento(agendamentoId, 'Cancelado pelo cliente via confirmação de lembrete');
    await enviarMensagem(telefone,
      `Tudo bem! Agendamento cancelado. 💔\n\nQuando quiser, é só nos chamar! 😊`
    );
  } else {
    await enviarMensagem(telefone,
      `Por favor, responda *1* para confirmar ou *2* para cancelar seu agendamento.`
    );
    return; // Não resetar, aguardar resposta
  }

  await resetarConversa(telefone);
}

module.exports = { processarConfirmacaoLembrete };
