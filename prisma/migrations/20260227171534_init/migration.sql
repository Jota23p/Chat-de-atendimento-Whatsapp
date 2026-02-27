-- CreateEnum
CREATE TYPE "Classificacao" AS ENUM ('VIP', 'FREQUENTE', 'NORMAL', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'CONCLUIDO', 'NAO_CONFIRMADO');

-- CreateEnum
CREATE TYPE "OrigemAgendamento" AS ENUM ('WHATSAPP', 'PAINEL_ADMIN', 'MANUAL');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'GRATUITO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT 'Cliente',
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "observacoes" TEXT,
    "classificacao" "Classificacao" NOT NULL DEFAULT 'NORMAL',
    "ultimoAtendimento" TIMESTAMP(3),
    "totalAtendimentos" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "especialidades" TEXT[],
    "horarioInicio" TEXT NOT NULL DEFAULT '09:00',
    "horarioFim" TEXT NOT NULL DEFAULT '18:00',
    "diasTrabalho" INTEGER[],
    "intervaloMinutos" INTEGER NOT NULL DEFAULT 15,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "duracaoMinutos" INTEGER NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Unhas',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordemExibicao" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "dataHoraInicio" TIMESTAMP(3) NOT NULL,
    "dataHoraFim" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'PENDENTE',
    "confirmadoEm" TIMESTAMP(3),
    "lembreteEnviado" BOOLEAN NOT NULL DEFAULT false,
    "origem" "OrigemAgendamento" NOT NULL DEFAULT 'WHATSAPP',
    "observacoes" TEXT,
    "canceladoMotivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL DEFAULT 'PIX',
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "pagoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fidelidade" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "pontosAcumulados" INTEGER NOT NULL DEFAULT 0,
    "atendimentosCiclo" INTEGER NOT NULL DEFAULT 0,
    "totalResgates" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fidelidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado_conversas" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "clienteId" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'MENU',
    "dadosTemp" JSONB,
    "tentativasInvalidas" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estado_conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacoes_whatsapp" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT,
    "telefone" TEXT NOT NULL,
    "mensagemRecebida" TEXT,
    "mensagemEnviada" TEXT,
    "etapaConversa" TEXT,
    "direcao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacoes_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_salao" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_salao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_telefone_key" ON "clientes"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_agendamentoId_key" ON "pagamentos"("agendamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "fidelidade_clienteId_key" ON "fidelidade"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "estado_conversas_telefone_key" ON "estado_conversas"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "estado_conversas_clienteId_key" ON "estado_conversas"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "config_salao_chave_key" ON "config_salao"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fidelidade" ADD CONSTRAINT "fidelidade_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estado_conversas" ADD CONSTRAINT "estado_conversas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes_whatsapp" ADD CONSTRAINT "interacoes_whatsapp_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
