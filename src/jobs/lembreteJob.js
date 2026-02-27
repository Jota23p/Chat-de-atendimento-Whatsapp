// src/jobs/lembreteJob.js
const cron = require('node-cron');
const prisma = require('../config/database');
const { enviarMensagem } = require('../utils/whatsapp');
const { reclassificarClientes } = require('../services/clienteService');
const { formatarData, formatarHora, agora, addMinutes } = require('../utils/dateHelper');
const logger = require('../utils/logger');

/**
 * Envia lembretes 24h antes e aguarda confirmação
 * Roda a cada hora
 */
async function enviarLembretes() {
  try {
    const agora24 = agora();
    const inicio = addMinutes(agora24, 23 * 60);   // 23h a partir de agora
    const fim = addMinutes(agora24, 25 * 60);       // 25h a partir de agora

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        status: 'PENDENTE',
        lembreteEnviado: false,
        dataHoraInicio: { gte: inicio, lte: fim },
      },
      include: { cliente: true, servico: true, profissional: true },
    });

    for (const ag of agendamentos) {
      const msg =
        `⏰ *Lembrete de agendamento!*\n\n` +
        `Olá, ${ag.cliente.nome}! 💅\n\n` +
        `Você tem um horário amanhã:\n` +
        `📅 *${formatarData(ag.dataHoraInicio)}* às *${formatarHora(ag.dataHoraInicio)}*\n` +
        `💅 ${ag.servico.nome} com ${ag.profissional.nome}\n\n` +
        `Por favor, confirme sua presença:\n` +
        `*1* - Sim, estarei lá! ✅\n` +
        `*2* - Preciso cancelar ❌\n\n` +
        `_Você tem 4 horas para confirmar. Após esse prazo, o horário poderá ser liberado._`;

      await enviarMensagem(ag.cliente.telefone, msg);

      // Atualizar estado da conversa para aguardar confirmação
      await prisma.estadoConversa.upsert({
        where: { telefone: ag.cliente.telefone },
        update: { etapa: 'CONFIRMAR_LEMBRETE', dadosTemp: { agendamentoId: ag.id } },
        create: {
          telefone: ag.cliente.telefone,
          clienteId: ag.clienteId,
          etapa: 'CONFIRMAR_LEMBRETE',
          dadosTemp: { agendamentoId: ag.id },
        },
      });

      await prisma.agendamento.update({
        where: { id: ag.id },
        data: { lembreteEnviado: true },
      });

      logger.info(`📤 Lembrete enviado para ${ag.cliente.telefone} (agendamento ${ag.id})`);
    }
  } catch (err) {
    logger.error(`❌ Erro ao enviar lembretes: ${err.message}`);
  }
}

/**
 * Cancela agendamentos não confirmados após 6h do lembrete
 * Roda a cada 30 minutos
 */
async function cancelarNaoConfirmados() {
  try {
    const limite = addMinutes(agora(), -(6 * 60)); // 6h atrás

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        status: 'PENDENTE',
        lembreteEnviado: true,
        dataHoraInicio: { gte: agora() }, // apenas futuros
        atualizadoEm: { lte: limite },
      },
      include: { cliente: true, servico: true, profissional: true },
    });

    for (const ag of agendamentos) {
      await prisma.agendamento.update({
        where: { id: ag.id },
        data: { status: 'NAO_CONFIRMADO', canceladoMotivo: 'Cancelado automaticamente por falta de confirmação' },
      });

      await enviarMensagem(
        ag.cliente.telefone,
        `😔 Seu agendamento foi *cancelado automaticamente* pois não recebemos sua confirmação.\n\n` +
        `Quando quiser, é só agendar novamente! 💅\n\n` +
        `_(Envie qualquer mensagem para voltar ao menu)_`
      ).catch(() => {});

      await prisma.estadoConversa.upsert({
        where: { telefone: ag.cliente.telefone },
        update: { etapa: 'MENU', dadosTemp: null },
        create: { telefone: ag.cliente.telefone, etapa: 'MENU', dadosTemp: null },
      }).catch(() => {});

      logger.info(`🚫 Agendamento ${ag.id} cancelado por falta de confirmação`);
    }
  } catch (err) {
    logger.error(`❌ Erro ao cancelar não confirmados: ${err.message}`);
  }
}

/**
 * Campanha de reativação: envia mensagem para clientes inativos há 60+ dias
 * Roda toda segunda-feira às 10h
 */
async function campanhReativacao() {
  try {
    const limite = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const inativos = await prisma.cliente.findMany({
      where: {
        ultimoAtendimento: { lt: limite },
        classificacao: { not: 'INATIVO' },
        ativo: true,
      },
      take: 50, // máximo 50 por vez
    });

    for (const cliente of inativos) {
      const msg =
        `Sentimos sua falta, ${cliente.nome}! 💕\n\n` +
        `Faz um tempinho que você não nos visita... 😊\n\n` +
        `Que tal agendar um mimo? Temos horários disponíveis essa semana!\n\n` +
        `Envie qualquer mensagem para ver nossos serviços e horários. 💅`;

      await enviarMensagem(cliente.telefone, msg).catch(() => {});
      logger.info(`💌 Campanha de reativação enviada para ${cliente.telefone}`);
    }
  } catch (err) {
    logger.error(`❌ Erro na campanha de reativação: ${err.message}`);
  }
}

/**
 * Inicializa todos os jobs
 */
function inicializarJobs() {
  // Lembretes de confirmação: toda hora
  cron.schedule('0 * * * *', enviarLembretes, { timezone: process.env.TZ || 'America/Sao_Paulo' });

  // Cancelamento automático: a cada 30 minutos
  cron.schedule('*/30 * * * *', cancelarNaoConfirmados, { timezone: process.env.TZ || 'America/Sao_Paulo' });

  // Reclassificação de clientes: todo dia à meia-noite
  cron.schedule('0 0 * * *', reclassificarClientes, { timezone: process.env.TZ || 'America/Sao_Paulo' });

  // Campanha de reativação: segunda às 10h
  cron.schedule('0 10 * * 1', campanhReativacao, { timezone: process.env.TZ || 'America/Sao_Paulo' });

  logger.info('⏰ Jobs agendados iniciados');
}

module.exports = { inicializarJobs };
