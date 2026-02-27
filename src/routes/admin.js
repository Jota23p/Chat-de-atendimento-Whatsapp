// src/routes/admin.js
const express = require('express');
const router = express.Router();
const { autenticar } = require('../middleware/auth');
const {
  login, dashboard,
  listarAgendamentos, concluirAgendamentoAdmin,
  listarClientes, detalheCliente, atualizarCliente,
  relatorioFinanceiro,
  listarConfigs, atualizarConfig,
} = require('../controllers/adminController');

// Autenticação (sem JWT)
router.post('/login', login);

// Rotas protegidas por JWT
router.use(autenticar);

// Dashboard
router.get('/dashboard', dashboard);

// Agendamentos
router.get('/agendamentos', listarAgendamentos);
router.patch('/agendamentos/:id/concluir', concluirAgendamentoAdmin);

// Clientes
router.get('/clientes', listarClientes);
router.get('/clientes/:id', detalheCliente);
router.patch('/clientes/:id', atualizarCliente);

// Relatório
router.get('/relatorio/financeiro', relatorioFinanceiro);

// Configurações
router.get('/config', listarConfigs);
router.put('/config/:chave', atualizarConfig);

module.exports = router;
