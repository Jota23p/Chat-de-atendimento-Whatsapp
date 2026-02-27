// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // ── PROFISSIONAIS ──────────────────────────────────────────────────────────
  const ana = await prisma.profissional.upsert({
    where: { id: 'prof-ana-001' },
    update: {},
    create: {
      id: 'prof-ana-001',
      nome: 'Ana',
      especialidades: ['Manicure', 'Pedicure', 'Gel', 'Fibra'],
      horarioInicio: '09:00',
      horarioFim: '18:00',
      diasTrabalho: [1, 2, 3, 4, 5, 6], // Seg a Sab
      intervaloMinutos: 15,
    },
  });

  const carol = await prisma.profissional.upsert({
    where: { id: 'prof-carol-002' },
    update: {},
    create: {
      id: 'prof-carol-002',
      nome: 'Carol',
      especialidades: ['Manicure', 'Pedicure', 'Nail Art'],
      horarioInicio: '10:00',
      horarioFim: '19:00',
      diasTrabalho: [2, 3, 4, 5, 6], // Ter a Sab
      intervaloMinutos: 15,
    },
  });

  // ── SERVIÇOS ──────────────────────────────────────────────────────────────
  const servicos = [
    { id: 'serv-001', nome: 'Manicure simples',         duracao: 45,  preco: 40.00,  categoria: 'Unhas', ordem: 1 },
    { id: 'serv-002', nome: 'Manicure com esmaltação',  duracao: 60,  preco: 55.00,  categoria: 'Unhas', ordem: 2 },
    { id: 'serv-003', nome: 'Pedicure simples',         duracao: 60,  preco: 50.00,  categoria: 'Unhas', ordem: 3 },
    { id: 'serv-004', nome: 'Pedicure com esmaltação',  duracao: 75,  preco: 65.00,  categoria: 'Unhas', ordem: 4 },
    { id: 'serv-005', nome: 'Mãos + Pés completo',      duracao: 120, preco: 100.00, categoria: 'Combo', ordem: 5 },
    { id: 'serv-006', nome: 'Gel (aplicação)',          duracao: 90,  preco: 120.00, categoria: 'Gel',   ordem: 6 },
    { id: 'serv-007', nome: 'Gel (manutenção)',         duracao: 75,  preco: 80.00,  categoria: 'Gel',   ordem: 7 },
    { id: 'serv-008', nome: 'Fibra de vidro',           duracao: 120, preco: 150.00, categoria: 'Fibra', ordem: 8 },
    { id: 'serv-009', nome: 'Nail Art (por unha)',      duracao: 30,  preco: 10.00,  categoria: 'Arte',  ordem: 9 },
    { id: 'serv-010', nome: 'Remoção de gel/fibra',     duracao: 45,  preco: 40.00,  categoria: 'Gel',   ordem: 10 },
  ];

  for (const s of servicos) {
    await prisma.servico.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        nome: s.nome,
        duracaoMinutos: s.duracao,
        preco: s.preco,
        categoria: s.categoria,
        ordemExibicao: s.ordem,
      },
    });
  }

  // ── CONFIGURAÇÕES DO SALÃO ────────────────────────────────────────────────
  const configs = [
    { chave: 'nome_salao',           valor: 'Samara Nails' },
    { chave: 'horario_abertura',     valor: '09:00' },
    { chave: 'horario_fechamento',   valor: '19:00' },
    { chave: 'dias_funcionamento',   valor: '1,2,3,4,5,6' }, // Seg-Sab
    { chave: 'antecedencia_minima',  valor: '120' },          // minutos
    { chave: 'antecedencia_maxima',  valor: '60' },           // dias
    { chave: 'pontos_premio',        valor: '10' },           // atendimentos p/ prêmio
    { chave: 'dias_inatividade',     valor: '60' },
    { chave: 'telefone_admin',       valor: process.env.ADMIN_PHONE || '5511999999999' },
  ];

  for (const c of configs) {
    await prisma.configSalao.upsert({
      where: { chave: c.chave },
      update: { valor: c.valor },
      create: c,
    });
  }

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  const senhaHash = await bcrypt.hash('admin123', 12);
  await prisma.admin.upsert({
    where: { email: 'admin@salaonails.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@salaonails.com',
      senhaHash,
    },
  });

  console.log('✅ Seed concluído!');
  console.log(`   👩 Profissionais: Ana, Carol`);
  console.log(`   💅 Serviços: ${servicos.length} cadastrados`);
  console.log(`   🔑 Admin: admin@salaonails.com / admin123`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
