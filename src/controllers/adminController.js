// src/controllers/adminController.js
const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { agora } = require('../utils/dateHelper');
const { adicionarPonto, resgatarPremio } = require('../services/clienteService');
const { concluirAgendamento } = require('../services/agendamentoService');
const { enviarMensagem } = require('../utils/whatsapp');

// ── AUTH ──────────────────────────────────────────────────────────────────────

async function login(req, res) {
  try {
    const { email, senha } = req.body;
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin || !(await bcrypt.compare(senha, admin.senhaHash))) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    res.json({ token, nome: admin.nome });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

async function dashboard(req, res) {
  try {
    const hoje = agora();
    const inicioDia = new Date(hoje.setHours(0, 0, 0, 0));
    const fimDia = new Date(hoje.setHours(23, 59, 59, 999));

    const [
      agendamentosHoje,
      agendamentosSemana,
      totalClientes,
      clientesVip,
      clientesInativos,
      naoConfirmados,
    ] = await Promise.all([
      prisma.agendamento.count({ where: { dataHoraInicio: { gte: inicioDia, lte: fimDia }, status: { not: 'CANCELADO' } } }),
      prisma.agendamento.count({ where: { dataHoraInicio: { gte: inicioDia }, status: { not: 'CANCELADO' } } }),
      prisma.cliente.count(),
      prisma.cliente.count({ where: { classificacao: 'VIP' } }),
      prisma.cliente.count({ where: { classificacao: 'INATIVO' } }),
      prisma.agendamento.count({ where: { status: 'NAO_CONFIRMADO' } }),
    ]);

    res.json({ agendamentosHoje, agendamentosSemana, totalClientes, clientesVip, clientesInativos, naoConfirmados });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

// ── AGENDAMENTOS ──────────────────────────────────────────────────────────────

async function listarAgendamentos(req, res) {
  try {
    const { data, profissionalId, status } = req.query;
    const where = {};

    if (data) {
      const d = new Date(data);
      where.dataHoraInicio = { gte: new Date(d.setHours(0, 0, 0, 0)), lte: new Date(d.setHours(23, 59, 59, 999)) };
    }
    if (profissionalId) where.profissionalId = profissionalId;
    if (status) where.status = status;

    const agendamentos = await prisma.agendamento.findMany({
      where,
      include: { cliente: true, profissional: true, servico: true },
      orderBy: { dataHoraInicio: 'asc' },
    });

    res.json(agendamentos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

async function concluirAgendamentoAdmin(req, res) {
  try {
    const { id } = req.params;
    const agendamento = await concluirAgendamento(id);

    // Adicionar ponto de fidelidade
    const fidelidade = await adicionarPonto(agendamento.clienteId);

    // Notificar cliente se atingiu prêmio
    if (fidelidade.atingiuPremio) {
      await enviarMensagem(
        agendamento.cliente.telefone,
        `🎉 *Parabéns ${agendamento.cliente.nome}!*\n\nVocê completou ${fidelidade.pontosParaPremio} atendimentos e ganhou um *serviço grátis*! 🎁💅\n\nFale conosco para resgatar seu presente!`
      ).catch(() => {});
    }

    res.json({ agendamento, fidelidade });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────

async function listarClientes(req, res) {
  try {
    const { classificacao, busca } = req.query;
    const where = {};
    if (classificacao) where.classificacao = classificacao;
    if (busca) where.OR = [
      { nome: { contains: busca, mode: 'insensitive' } },
      { telefone: { contains: busca } },
    ];

    const clientes = await prisma.cliente.findMany({
      where,
      include: { fidelidade: true },
      orderBy: { nome: 'asc' },
    });
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

async function detalheCliente(req, res) {
  try {
    const { id } = req.params;
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        fidelidade: true,
        agendamentos: {
          include: { servico: true, profissional: true },
          orderBy: { dataHoraInicio: 'desc' },
          take: 20,
        },
      },
    });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

async function atualizarCliente(req, res) {
  try {
    const { id } = req.params;
    const { nome, observacoes, email, dataNascimento } = req.body;
    const cliente = await prisma.cliente.update({
      where: { id },
      data: { nome, observacoes, email, dataNascimento: dataNascimento ? new Date(dataNascimento) : undefined },
    });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

// ── RELATÓRIO FINANCEIRO ──────────────────────────────────────────────────────

async function relatorioFinanceiro(req, res) {
  try {
    const { inicio, fim } = req.query;
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        status: 'CONCLUIDO',
        dataHoraInicio: {
          gte: inicio ? new Date(inicio) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          lte: fim ? new Date(fim) : new Date(),
        },
      },
      include: { servico: true, profissional: true },
    });

    const total = agendamentos.reduce((sum, a) => sum + Number(a.servico.preco), 0);
    const porServico = {};
    const porProfissional = {};

    for (const a of agendamentos) {
      porServico[a.servico.nome] = (porServico[a.servico.nome] || 0) + Number(a.servico.preco);
      porProfissional[a.profissional.nome] = (porProfissional[a.profissional.nome] || 0) + Number(a.servico.preco);
    }

    res.json({ total, quantidadeAtendimentos: agendamentos.length, porServico, porProfissional });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────

async function listarConfigs(req, res) {
  try {
    const configs = await prisma.configSalao.findMany();
    const obj = {};
    configs.forEach(c => { obj[c.chave] = c.valor; });
    res.json(obj);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

async function atualizarConfig(req, res) {
  try {
    const { chave } = req.params;
    const { valor } = req.body;
    const config = await prisma.configSalao.upsert({
      where: { chave },
      update: { valor },
      create: { chave, valor },
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

module.exports = {
  login, dashboard,
  listarAgendamentos, concluirAgendamentoAdmin,
  listarClientes, detalheCliente, atualizarCliente,
  relatorioFinanceiro,
  listarConfigs, atualizarConfig,
};
