// src/flows/fluxoPrincipal.js
const { enviarMensagem } = require('../utils/whatsapp');
const { buscarEstado, salvarEstado, resetarConversa, incrementarTentativas, registrarInteracao } = require('../services/conversaService');
const { buscarOuCriar } = require('../services/clienteService');
const { listarServicos, listarProfissionais, calcularDisponibilidade,
        criarAgendamento, confirmarAgendamento, cancelarAgendamento,
        agendamentosFuturosPorCliente, formatarConfirmacao } = require('../services/agendamentoService');
const { formatarData, formatarHora } = require('../utils/dateHelper');
const prisma = require('../config/database');
const logger = require('../utils/logger');

// ─── MENSAGENS ────────────────────────────────────────────────────────────────

async function getNomeSalao() {
  const config = await prisma.configSalao.findUnique({ where: { chave: 'nome_salao' } });
  return config?.valor || 'Salão';
}

async function menuPrincipal(telefone) {
  const nomeSalao = await getNomeSalao();
  return (
    `Olá! 💅 Seja bem-vinda ao *${nomeSalao}*!\n\n` +
    `Como posso te ajudar hoje?\n\n` +
    `1️⃣ Agendar horário\n` +
    `2️⃣ Ver serviços e preços\n` +
    `3️⃣ Remarcar horário\n` +
    `4️⃣ Cancelar horário\n` +
    `5️⃣ Meu histórico e pontos\n` +
    `6️⃣ Falar com atendente\n\n` +
    `_Digite o número da opção desejada_`
  );
}

function mensagemNaoEntendida() {
  return `Desculpe, não entendi. 😅\nDigite o *número* da opção desejada ou *0* para voltar ao menu.`;
}

// ─── FLUXO PRINCIPAL ─────────────────────────────────────────────────────────

async function processarMensagem(telefone, texto) {
  const mensagem = texto.trim().toLowerCase();
  const cliente = await buscarOuCriar(telefone);
  const estado = await buscarEstado(telefone) || { etapa: 'MENU', dadosTemp: {} };
  const dados = estado.dadosTemp || {};

  logger.info(`📩 ${telefone} | Etapa: ${estado.etapa} | Mensagem: "${texto}"`);

  // Registrar interação
  await registrarInteracao(telefone, cliente.id, texto, null, estado.etapa);

  // Comando universal: voltar ao menu
  if (mensagem === '0' || mensagem === 'menu' || mensagem === 'cancelar') {
    const resposta = await menuPrincipal(telefone);
    await salvarEstado(telefone, 'MENU', null, cliente.id);
    await enviarMensagem(telefone, resposta);
    return;
  }

  let resposta = null;

  // ── ROTEAMENTO POR ETAPA ──────────────────────────────────────────────────

  switch (estado.etapa) {

    // ── MENU PRINCIPAL ───────────────────────────────────────────────────────
    case 'MENU': {
      switch (mensagem) {
        case '1': {
          const servicos = await listarServicos();
          let msg = `💅 *Nossos serviços:*\n\n`;
          servicos.forEach((s, i) => {
            msg += `*${i + 1}.* ${s.nome}\n`;
            msg += `    ⏱ ${s.duracaoMinutos}min  💰 R$ ${Number(s.preco).toFixed(2)}\n\n`;
          });
          msg += `Digite o *número* do serviço desejado:\n_(ou 0 para voltar)_`;
          await salvarEstado(telefone, 'ESCOLHER_SERVICO', { servicos: servicos.map(s => s.id) }, cliente.id);
          resposta = msg;
          break;
        }

        case '2': {
          const servicos = await listarServicos();
          let msg = `📋 *Serviços e preços:*\n\n`;
          let categoriaAtual = '';
          servicos.forEach(s => {
            if (s.categoria !== categoriaAtual) {
              msg += `\n*── ${s.categoria} ──*\n`;
              categoriaAtual = s.categoria;
            }
            msg += `• ${s.nome}: R$ ${Number(s.preco).toFixed(2)} (${s.duracaoMinutos}min)\n`;
          });
          msg += `\nDeseja agendar?\n*1* - Sim  |  *0* - Voltar ao menu`;
          await salvarEstado(telefone, 'VER_SERVICOS_OPCAO', null, cliente.id);
          resposta = msg;
          break;
        }

        case '3': {
          const agendamentos = await agendamentosFuturosPorCliente(cliente.id);
          if (agendamentos.length === 0) {
            resposta = `Você não tem horários agendados no momento. 😊\n\nDigite *1* para agendar ou *0* para o menu.`;
          } else {
            let msg = `📅 *Seus agendamentos:*\n\n`;
            agendamentos.forEach((a, i) => {
              msg += `*${i + 1}.* ${a.servico.nome}\n`;
              msg += `    📅 ${formatarData(a.dataHoraInicio)} às ${formatarHora(a.dataHoraInicio)}\n`;
              msg += `    👩 ${a.profissional.nome}\n\n`;
            });
            msg += `Digite o *número* do agendamento que deseja remarcar:\n_(ou 0 para voltar)_`;
            await salvarEstado(telefone, 'REMARCAR_ESCOLHER', { agendamentos: agendamentos.map(a => a.id) }, cliente.id);
            resposta = msg;
          }
          break;
        }

        case '4': {
          const agendamentos = await agendamentosFuturosPorCliente(cliente.id);
          if (agendamentos.length === 0) {
            resposta = `Você não tem horários agendados para cancelar. 😊\n\nDigite *0* para voltar ao menu.`;
          } else {
            let msg = `❌ *Cancelamento de agendamento*\n\n`;
            agendamentos.forEach((a, i) => {
              msg += `*${i + 1}.* ${a.servico.nome}\n`;
              msg += `    📅 ${formatarData(a.dataHoraInicio)} às ${formatarHora(a.dataHoraInicio)}\n\n`;
            });
            msg += `Digite o *número* do agendamento que deseja cancelar:\n_(ou 0 para voltar)_`;
            await salvarEstado(telefone, 'CANCELAR_ESCOLHER', { agendamentos: agendamentos.map(a => a.id) }, cliente.id);
            resposta = msg;
          }
          break;
        }

        case '5': {
          const fid = await prisma.fidelidade.findUnique({ where: { clienteId: cliente.id } });
          const config = await prisma.configSalao.findUnique({ where: { chave: 'pontos_premio' } });
          const pontosPremio = parseInt(config?.valor || '10');
          const ciclo = fid?.atendimentosCiclo || 0;
          const faltam = Math.max(0, pontosPremio - ciclo);

          let emoji = '😊';
          if (cliente.classificacao === 'VIP') emoji = '⭐';
          if (cliente.classificacao === 'FREQUENTE') emoji = '💜';
          if (cliente.classificacao === 'INATIVO') emoji = '😴';

          resposta =
            `✨ *Seu histórico, ${cliente.nome}!*\n\n` +
            `${emoji} *Classificação:* ${cliente.classificacao}\n` +
            `💅 *Total de visitas:* ${cliente.totalAtendimentos}\n` +
            `🎯 *Ciclo atual:* ${ciclo}/${pontosPremio} atendimentos\n` +
            (faltam > 0
              ? `🎁 Faltam *${faltam}* para seu próximo serviço grátis!\n`
              : `🎉 *Você tem um serviço grátis disponível!* Fale com a gente!\n`) +
            (cliente.ultimoAtendimento
              ? `📅 *Última visita:* ${formatarData(cliente.ultimoAtendimento)}\n`
              : '') +
            `\n_Digite 0 para voltar ao menu_`;
          break;
        }

        case '6': {
          const adminPhone = await prisma.configSalao.findUnique({ where: { chave: 'telefone_admin' } });
          resposta =
            `👩 *Transferindo para atendimento humano...*\n\n` +
            `Em breve nossa equipe vai te atender! 💕\n\n` +
            `_Se preferir, pode ligar ou chamar diretamente no WhatsApp._`;
          // Notificar admin
          if (adminPhone?.valor && adminPhone.valor !== telefone) {
            await enviarMensagem(adminPhone.valor,
              `🔔 *Cliente solicitou atendimento humano*\n📱 Número: ${telefone}\n👤 Nome: ${cliente.nome}`
            ).catch(() => {});
          }
          await resetarConversa(telefone);
          break;
        }

        default: {
          const tentativas = await incrementarTentativas(telefone);
          if (tentativas >= 3) {
            resposta = `Parece que está tendo dificuldade. Vou te conectar com nossa equipe! 💕`;
            await resetarConversa(telefone);
          } else {
            resposta = await menuPrincipal(telefone);
          }
        }
      }
      break;
    }

    // ── VER SERVIÇOS → OPÇÃO AGENDAR ────────────────────────────────────────
    case 'VER_SERVICOS_OPCAO': {
      if (mensagem === '1') {
        const servicos = await listarServicos();
        let msg = `💅 *Escolha o serviço:*\n\n`;
        servicos.forEach((s, i) => {
          msg += `*${i + 1}.* ${s.nome} — R$ ${Number(s.preco).toFixed(2)}\n`;
        });
        msg += `\nDigite o número do serviço:`;
        await salvarEstado(telefone, 'ESCOLHER_SERVICO', { servicos: servicos.map(s => s.id) }, cliente.id);
        resposta = msg;
      } else {
        resposta = await menuPrincipal(telefone);
        await salvarEstado(telefone, 'MENU', null, cliente.id);
      }
      break;
    }

    // ── ESCOLHER SERVIÇO ─────────────────────────────────────────────────────
    case 'ESCOLHER_SERVICO': {
      const idx = parseInt(mensagem) - 1;
      if (isNaN(idx) || idx < 0 || idx >= (dados.servicos?.length || 0)) {
        resposta = mensagemNaoEntendida();
      } else {
        const servicoId = dados.servicos[idx];
        const profissionais = await listarProfissionais();
        const profAtivos = profissionais.filter(p => p.ativo);

        if (profAtivos.length === 1) {
          // Apenas 1 profissional — vai direto para datas
          await salvarEstado(telefone, 'ESCOLHER_DATA', { ...dados, servicoId, profissionalId: profAtivos[0].id }, cliente.id);
          const { diasDisponiveis } = await calcularDisponibilidade(profAtivos[0].id, servicoId);

          if (diasDisponiveis.length === 0) {
            resposta = `😔 Não há horários disponíveis no momento. Tente novamente mais tarde ou fale conosco digitando *6*.`;
            await resetarConversa(telefone);
          } else {
            let msg = `📅 *Datas disponíveis com ${profAtivos[0].nome}:*\n\n`;
            diasDisponiveis.forEach((d, i) => {
              msg += `*${i + 1}.* ${formatarData(d.data)} (${d.slots.length} horários)\n`;
            });
            msg += `\nDigite o *número* da data:\n_(ou 0 para voltar)_`;
            await salvarEstado(telefone, 'ESCOLHER_DATA', { servicoId, profissionalId: profAtivos[0].id, dias: diasDisponiveis.map(d => ({ data: d.data, slots: d.slots })) }, cliente.id);
            resposta = msg;
          }
        } else {
          let msg = `👩 *Escolha a profissional:*\n\n`;
          profAtivos.forEach((p, i) => {
            msg += `*${i + 1}.* ${p.nome}\n`;
          });
          msg += `*${profAtivos.length + 1}.* Sem preferência\n\n`;
          msg += `Digite o número:`;
          await salvarEstado(telefone, 'ESCOLHER_PROFISSIONAL', { ...dados, servicoId, profissionais: profAtivos.map(p => p.id) }, cliente.id);
          resposta = msg;
        }
      }
      break;
    }

    // ── ESCOLHER PROFISSIONAL ─────────────────────────────────────────────────
    case 'ESCOLHER_PROFISSIONAL': {
      const profissionais = dados.profissionais || [];
      const idx = parseInt(mensagem) - 1;
      let profissionalId;

      if (mensagem === String(profissionais.length + 1)) {
        // Sem preferência — escolhe aleatório
        profissionalId = profissionais[Math.floor(Math.random() * profissionais.length)];
      } else if (!isNaN(idx) && idx >= 0 && idx < profissionais.length) {
        profissionalId = profissionais[idx];
      } else {
        resposta = mensagemNaoEntendida();
        break;
      }

      const { profissional, diasDisponiveis } = await calcularDisponibilidade(profissionalId, dados.servicoId);

      if (diasDisponiveis.length === 0) {
        resposta = `😔 ${profissional.nome} não tem horários disponíveis. Tente outra profissional ou volte mais tarde.`;
      } else {
        let msg = `📅 *Datas disponíveis com ${profissional.nome}:*\n\n`;
        diasDisponiveis.forEach((d, i) => {
          msg += `*${i + 1}.* ${formatarData(d.data)} (${d.slots.length} horários)\n`;
        });
        msg += `\nDigite o *número* da data:\n_(ou 0 para voltar)_`;
        await salvarEstado(telefone, 'ESCOLHER_DATA',
          { ...dados, profissionalId, dias: diasDisponiveis.map(d => ({ data: d.data, slots: d.slots })) },
          cliente.id
        );
        resposta = msg;
      }
      break;
    }

    // ── ESCOLHER DATA ─────────────────────────────────────────────────────────
    case 'ESCOLHER_DATA': {
      const dias = dados.dias || [];
      const idx = parseInt(mensagem) - 1;

      if (isNaN(idx) || idx < 0 || idx >= dias.length) {
        resposta = mensagemNaoEntendida();
      } else {
        const diaEscolhido = dias[idx];
        const slots = diaEscolhido.slots;

        let msg = `🕐 *Horários disponíveis em ${formatarData(new Date(diaEscolhido.data))}:*\n\n`;
        slots.forEach((s, i) => {
          msg += `*${i + 1}.* ${formatarHora(new Date(s))}\n`;
        });
        msg += `\nDigite o *número* do horário:\n_(ou 0 para voltar)_`;

        await salvarEstado(telefone, 'ESCOLHER_HORARIO',
          { ...dados, dataEscolhida: diaEscolhido.data, slots: slots },
          cliente.id
        );
        resposta = msg;
      }
      break;
    }

    // ── ESCOLHER HORÁRIO ──────────────────────────────────────────────────────
    case 'ESCOLHER_HORARIO': {
      const slots = dados.slots || [];
      const idx = parseInt(mensagem) - 1;

      if (isNaN(idx) || idx < 0 || idx >= slots.length) {
        resposta = mensagemNaoEntendida();
      } else {
        const horarioEscolhido = slots[idx];
        const [servico, profissional] = await Promise.all([
          prisma.servico.findUnique({ where: { id: dados.servicoId } }),
          prisma.profissional.findUnique({ where: { id: dados.profissionalId } }),
        ]);

        const msg =
          `📋 *Confirme seu agendamento:*\n\n` +
          `💅 *Serviço:* ${servico.nome}\n` +
          `📅 *Data:* ${formatarData(new Date(horarioEscolhido))}\n` +
          `🕐 *Horário:* ${formatarHora(new Date(horarioEscolhido))}\n` +
          `👩 *Profissional:* ${profissional.nome}\n` +
          `💰 *Valor:* R$ ${Number(servico.preco).toFixed(2)}\n\n` +
          `Confirmar?\n*1* - Sim, confirmar! ✅\n*2* - Não, voltar ❌`;

        await salvarEstado(telefone, 'CONFIRMAR_AGENDAMENTO',
          { ...dados, horarioEscolhido },
          cliente.id
        );
        resposta = msg;
      }
      break;
    }

    // ── CONFIRMAR AGENDAMENTO ─────────────────────────────────────────────────
    case 'CONFIRMAR_AGENDAMENTO': {
      if (mensagem === '1') {
        try {
          const agendamento = await criarAgendamento({
            clienteId: cliente.id,
            profissionalId: dados.profissionalId,
            servicoId: dados.servicoId,
            dataHoraInicio: new Date(dados.horarioEscolhido),
          });
          resposta = formatarConfirmacao(agendamento);
          await resetarConversa(telefone);
        } catch (err) {
          if (err.message === 'HORARIO_OCUPADO') {
            resposta = `😔 Ops! Esse horário acabou de ser ocupado. Vamos escolher outro?\nDigite *1* para agendar novamente.`;
            await salvarEstado(telefone, 'MENU', null, cliente.id);
          } else {
            logger.error(`Erro ao criar agendamento: ${err.message}`);
            resposta = `Ocorreu um erro. Tente novamente ou fale conosco digitando *6*.`;
            await resetarConversa(telefone);
          }
        }
      } else {
        resposta = await menuPrincipal(telefone);
        await resetarConversa(telefone);
      }
      break;
    }

    // ── CANCELAR: ESCOLHER AGENDAMENTO ────────────────────────────────────────
    case 'CANCELAR_ESCOLHER': {
      const agendamentos = dados.agendamentos || [];
      const idx = parseInt(mensagem) - 1;

      if (isNaN(idx) || idx < 0 || idx >= agendamentos.length) {
        resposta = mensagemNaoEntendida();
      } else {
        const agendamentoId = agendamentos[idx];
        const ag = await prisma.agendamento.findUnique({
          where: { id: agendamentoId },
          include: { servico: true, profissional: true },
        });

        const msg =
          `⚠️ *Confirma o cancelamento?*\n\n` +
          `💅 ${ag.servico.nome}\n` +
          `📅 ${formatarData(ag.dataHoraInicio)} às ${formatarHora(ag.dataHoraInicio)}\n` +
          `👩 ${ag.profissional.nome}\n\n` +
          `*1* - Sim, cancelar\n*2* - Não, manter`;

        await salvarEstado(telefone, 'CANCELAR_CONFIRMAR',
          { agendamentoId },
          cliente.id
        );
        resposta = msg;
      }
      break;
    }

    // ── CANCELAR: CONFIRMAR ───────────────────────────────────────────────────
    case 'CANCELAR_CONFIRMAR': {
      if (mensagem === '1') {
        await cancelarAgendamento(dados.agendamentoId, 'Cancelado pelo cliente via WhatsApp');
        resposta =
          `✅ Agendamento cancelado com sucesso!\n\n` +
          `Sentiremos sua falta! 💔\n` +
          `Quando quiser, é só nos chamar! 😊\n\n` +
          `_Digite 0 para voltar ao menu_`;
        await resetarConversa(telefone);
      } else {
        resposta = `Ok! Seu agendamento foi mantido. 💅\n\n_Digite 0 para voltar ao menu_`;
        await resetarConversa(telefone);
      }
      break;
    }

    // ── REMARCAR: ESCOLHER AGENDAMENTO ───────────────────────────────────────
    case 'REMARCAR_ESCOLHER': {
      const agendamentos = dados.agendamentos || [];
      const idx = parseInt(mensagem) - 1;

      if (isNaN(idx) || idx < 0 || idx >= agendamentos.length) {
        resposta = mensagemNaoEntendida();
      } else {
        const agendamentoId = agendamentos[idx];
        const ag = await prisma.agendamento.findUnique({
          where: { id: agendamentoId },
          include: { servico: true, profissional: true },
        });

        // Calcula nova disponibilidade
        const { profissional, diasDisponiveis } = await calcularDisponibilidade(
          ag.profissionalId, ag.servicoId
        );

        if (diasDisponiveis.length === 0) {
          resposta = `😔 Não há horários disponíveis no momento. Tente mais tarde.`;
          await resetarConversa(telefone);
        } else {
          let msg = `📅 *Novas datas disponíveis para ${ag.servico.nome}:*\n\n`;
          diasDisponiveis.forEach((d, i) => {
            msg += `*${i + 1}.* ${formatarData(d.data)}\n`;
          });
          msg += `\nDigite o *número* da nova data:`;

          await salvarEstado(telefone, 'REMARCAR_DATA', {
            agendamentoAntigoId: agendamentoId,
            servicoId: ag.servicoId,
            profissionalId: ag.profissionalId,
            dias: diasDisponiveis.map(d => ({ data: d.data, slots: d.slots })),
          }, cliente.id);
          resposta = msg;
        }
      }
      break;
    }

    // ── REMARCAR: ESCOLHER DATA ───────────────────────────────────────────────
    case 'REMARCAR_DATA': {
      const dias = dados.dias || [];
      const idx = parseInt(mensagem) - 1;

      if (isNaN(idx) || idx < 0 || idx >= dias.length) {
        resposta = mensagemNaoEntendida();
      } else {
        const diaEscolhido = dias[idx];
        let msg = `🕐 *Horários disponíveis em ${formatarData(new Date(diaEscolhido.data))}:*\n\n`;
        diaEscolhido.slots.forEach((s, i) => {
          msg += `*${i + 1}.* ${formatarHora(new Date(s))}\n`;
        });
        msg += `\nDigite o *número* do horário:`;

        await salvarEstado(telefone, 'REMARCAR_HORARIO', { ...dados, dataEscolhida: diaEscolhido.data, slots: diaEscolhido.slots }, cliente.id);
        resposta = msg;
      }
      break;
    }

    // ── REMARCAR: ESCOLHER HORÁRIO ────────────────────────────────────────────
    case 'REMARCAR_HORARIO': {
      const slots = dados.slots || [];
      const idx = parseInt(mensagem) - 1;

      if (isNaN(idx) || idx < 0 || idx >= slots.length) {
        resposta = mensagemNaoEntendida();
      } else {
        // Cancelar antigo e criar novo
        await cancelarAgendamento(dados.agendamentoAntigoId, 'Remarcado pelo cliente via WhatsApp');
        try {
          const novoAg = await criarAgendamento({
            clienteId: cliente.id,
            profissionalId: dados.profissionalId,
            servicoId: dados.servicoId,
            dataHoraInicio: new Date(slots[idx]),
          });
          resposta = `🔄 *Remarcado com sucesso!*\n\n` + formatarConfirmacao(novoAg);
          await resetarConversa(telefone);
        } catch {
          resposta = `😔 Esse horário não está mais disponível. Tente novamente.`;
          await resetarConversa(telefone);
        }
      }
      break;
    }

    default: {
      const respMenu = await menuPrincipal(telefone);
      await salvarEstado(telefone, 'MENU', null, cliente.id);
      resposta = respMenu;
    }
  }

  if (resposta) {
    await enviarMensagem(telefone, resposta);
  }
}

module.exports = { processarMensagem };
