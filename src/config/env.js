// src/config/env.js
require('dotenv').config();

const required = (key) => {
  if (!process.env[key]) {
    throw new Error(`❌ Variável de ambiente obrigatória não definida: ${key}`);
  }
  return process.env[key];
};

module.exports = {
  // Servidor
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Banco de dados
  DATABASE_URL: required('DATABASE_URL'),

  // Evolution API
  EVOLUTION_API_URL: required('EVOLUTION_API_URL'),
  EVOLUTION_API_KEY: required('EVOLUTION_API_KEY'),
  EVOLUTION_INSTANCE: required('EVOLUTION_INSTANCE'),

  // JWT para painel admin
  JWT_SECRET: process.env.JWT_SECRET || 'troque-esta-chave-secreta-em-producao',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Número do admin (recebe alertas)
  ADMIN_PHONE: process.env.ADMIN_PHONE || '',

  // Timezone
  TZ: process.env.TZ || 'America/Sao_Paulo',
};
