// src/services/agendamentoService.js
const prisma = require('../config/database');
const { addMinutes, proximosDiasDisponiveis, agora, formatarData, formatarHora } = require('../utils/dateHelper');
const logger = require('../utils/logger');

/**
 * Lista todos os serviços ativos
 */
async function listarServicos() {
  return prisma.servico.findMany({
    where: { ativo: true },
    orderBy: { ordemExibicao: 'asc' },
  });
}

/**
 * Lista profissionais ativas
 */
async function listarProfissionais(servicoId) {
  return prisma.profissional.findMany({
    where: {
      ativo: true,
      ...(servicoId && {
        especialidades: { has: '' } // sem filtro por enquanto
      }),
    },
  });
}

/**
 * Gera opções de data e horário disponíveis para um serviço e profissional
 */
async function calcularDisponibilidade(profissionalId, servicoId) {
  const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId } });
  const servico = await prisma.servico.findUnique({ where: { id: servicoId } });

  if (!profissional || !servico) throw new Error('Profissional ou serviço não encontrado');

  // Buscar agendamentos futuros da profissional
  const agendamentosFuturos = await prisma.agendamento.findMany({
    where: {
      profissionalId,
      status: { in: ['PENDENTE', 'CONFIRMADO'] },
      dataHoraInicio: { gte: agora() },
    },
  });

  const diasDisponiveis = await proximosDiasDisponiveis(
    profissional.diasTrabalho,
    profissional.horarioInicio,
    profissional.horarioFim,
    profissional.intervaloMinutos,
    servico.duracaoMinutos,
    agendamentosFuturos,
    7
  );

  return { profissional, servico, diasDisponiveis };
}

/**
 * Cria um agendamento verificando conflitos
 */
async function criarAgendamento({ clienteId, profissionalId, servicoId, dataHoraInicio }) {
  const servico = await prisma.servico.findUnique({ where: { id: servicoId } });
  const dataHoraFim = addMinutes(new Date(dataHoraInicio), servico.duracaoMinutos);

  // Verificar conflito
  const conflito = await prisma.agendamento.findFirst({
    where: {
      profissionalId,
      status: { in: ['PENDENTE', 'CONFIRMADO'] },
      AND: [
        { dataHoraInicio: { lt: dataHoraFim } },
        { dataHoraFim: { gt: new Date(dataHoraInicio) } },
      ],
    },
  });

  if (conflito) {
    throw new Error('HORARIO_OCUPADO');
  }

  const agendamento = await prisma.agendamento.create({
    data: {
      clienteId,
      profissionalId,
      servicoId,
      dataHoraInicio: new Date(dataHoraInicio),
      dataHoraFim,
      status: 'PENDENTE',
    },
    include: {
      servico: true,
      profissional: true,
      cliente: true,
    },
  });

  logger.info(`📅 Agendamento criado: ${agendamento.id} para ${agendamento.cliente.nome}`);
  return agendamento;
}

/**
 * Confirma um agendamento
 */
async function confirmarAgendamento(agendamentoId) {
  return prisma.agendamento.update({
    where: { id: agendamentoId },
    data: { status: 'CONFIRMADO', confirmadoEm: new Date() },
    include: { servico: true, profissional: true, cliente: true },
  });
}

/**
 * Cancela um agendamento
 */
async function cancelarAgendamento(agendamentoId, motivo = null) {
  return prisma.agendamento.update({
    where: { id: agendamentoId },
    data: { status: 'CANCELADO', canceladoMotivo: motivo },
    include: { servico: true, profissional: true, cliente: true },
  });
}

/**
 * Lista agendamentos futuros de um cliente
 */
async function agendamentosFuturosPorCliente(clienteId) {
  return prisma.agendamento.findMany({
    where: {
      clienteId,
      status: { in: ['PENDENTE', 'CONFIRMADO'] },
      dataHoraInicio: { gte: agora() },
    },
    include: { servico: true, profissional: true },
    orderBy: { dataHoraInicio: 'asc' },
  });
}

/**
 * Conclui um agendamento (chamado pelo admin)
 */
async function concluirAgendamento(agendamentoId) {
  return prisma.agendamento.update({
    where: { id: agendamentoId },
    data: { status: 'CONCLUIDO' },
    include: { servico: true, profissional: true, cliente: true },
  });
}

/**
 * Formata mensagem de confirmação de agendamento
 */
function formatarConfirmacao(agendamento) {
  return (
    `✅ *Agendamento confirmado!* 💖\n\n` +
    `💅 *Serviço:* ${agendamento.servico.nome}\n` +
    `📅 *Data:* ${formatarData(agendamento.dataHoraInicio)}\n` +
    `🕐 *Horário:* ${formatarHora(agendamento.dataHoraInicio)}\n` +
    `👩 *Profissional:* ${agendamento.profissional.nome}\n` +
    `💰 *Valor:* R$ ${Number(agendamento.servico.preco).toFixed(2)}\n\n` +
    `Qualquer dúvida, estamos à disposição! 😊`
  );
}

module.exports = {
  listarServicos,
  listarProfissionais,
  calcularDisponibilidade,
  criarAgendamento,
  confirmarAgendamento,
  cancelarAgendamento,
  concluirAgendamento,
  agendamentosFuturosPorCliente,
  formatarConfirmacao,
};
