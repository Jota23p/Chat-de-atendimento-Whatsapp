// src/services/clienteService.js
const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Busca ou cria um cliente pelo telefone
 */
async function buscarOuCriar(telefone) {
  let cliente = await prisma.cliente.findUnique({
    where: { telefone },
    include: { fidelidade: true },
  });

  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: {
        telefone,
        nome: 'Cliente',
        fidelidade: { create: {} },
      },
      include: { fidelidade: true },
    });
    logger.info(`👤 Novo cliente criado: ${telefone}`);
  }

  return cliente;
}

/**
 * Atualiza o nome do cliente
 */
async function atualizarNome(clienteId, nome) {
  return prisma.cliente.update({
    where: { id: clienteId },
    data: { nome },
  });
}

/**
 * Reclassifica clientes baseado em atividade
 */
async function reclassificarClientes() {
  const agora = new Date();
  const limite60 = new Date(agora - 60 * 24 * 60 * 60 * 1000);
  const limite90 = new Date(agora - 90 * 24 * 60 * 60 * 1000);

  // Marcar inativos
  await prisma.cliente.updateMany({
    where: {
      ultimoAtendimento: { lt: limite60 },
      classificacao: { not: 'INATIVO' },
    },
    data: { classificacao: 'INATIVO' },
  });

  // VIP: 20+ atendimentos
  await prisma.cliente.updateMany({
    where: { totalAtendimentos: { gte: 20 } },
    data: { classificacao: 'VIP' },
  });

  logger.info('✅ Clientes reclassificados');
}

/**
 * Lista clientes inativos há mais de 60 dias
 */
async function listarInativos() {
  const limite = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  return prisma.cliente.findMany({
    where: {
      OR: [
        { ultimoAtendimento: { lt: limite } },
        { ultimoAtendimento: null, criadoEm: { lt: limite } },
      ],
    },
    orderBy: { ultimoAtendimento: 'asc' },
  });
}

/**
 * Adiciona ponto de fidelidade
 */
async function adicionarPonto(clienteId) {
  const config = await prisma.configSalao.findUnique({ where: { chave: 'pontos_premio' } });
  const pontosParaPremio = parseInt(config?.valor || '10');

  const fidelidade = await prisma.fidelidade.upsert({
    where: { clienteId },
    update: {
      pontosAcumulados: { increment: 1 },
      atendimentosCiclo: { increment: 1 },
    },
    create: {
      clienteId,
      pontosAcumulados: 1,
      atendimentosCiclo: 1,
    },
  });

  await prisma.cliente.update({
    where: { id: clienteId },
    data: {
      totalAtendimentos: { increment: 1 },
      ultimoAtendimento: new Date(),
    },
  });

  return {
    ...fidelidade,
    atingiuPremio: fidelidade.atendimentosCiclo >= pontosParaPremio,
    pontosParaPremio,
    faltam: Math.max(0, pontosParaPremio - fidelidade.atendimentosCiclo),
  };
}

/**
 * Resgata prêmio de fidelidade
 */
async function resgatarPremio(clienteId) {
  return prisma.fidelidade.update({
    where: { clienteId },
    data: {
      atendimentosCiclo: 0,
      totalResgates: { increment: 1 },
    },
  });
}

module.exports = {
  buscarOuCriar,
  atualizarNome,
  reclassificarClientes,
  listarInativos,
  adicionarPonto,
  resgatarPremio,
};
