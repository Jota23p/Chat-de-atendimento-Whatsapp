// src/utils/dateHelper.js
const { format, addMinutes, parseISO, isAfter, isBefore,
        startOfDay, endOfDay, addDays, setHours, setMinutes,
        isWeekend, getDay } = require('date-fns');
const { ptBR } = require('date-fns/locale');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');

const TZ = process.env.TZ || 'America/Sao_Paulo';

function agora() {
  return toZonedTime(new Date(), TZ);
}

function formatarData(date) {
  return format(toZonedTime(date, TZ), "EEEE, dd/MM/yyyy", { locale: ptBR });
}

function formatarHora(date) {
  return format(toZonedTime(date, TZ), "HH:mm");
}

function formatarDataHora(date) {
  return format(toZonedTime(date, TZ), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/**
 * Gera slots de horário disponíveis para um dia
 * @param {Date} dia
 * @param {string} inicio - ex: "09:00"
 * @param {string} fim    - ex: "18:00"
 * @param {number} intervalo - em minutos
 * @param {number} duracao   - duração do serviço em minutos
 * @param {Array} ocupados   - array de {inicio, fim} já agendados
 */
function gerarSlots(dia, inicio, fim, intervalo, duracao, ocupados = []) {
  const [hIni, mIni] = inicio.split(':').map(Number);
  const [hFim, mFim] = fim.split(':').map(Number);

  let cursor = setMinutes(setHours(startOfDay(dia), hIni), mIni);
  const limFim = setMinutes(setHours(startOfDay(dia), hFim), mFim);
  const slots = [];
  const now = agora();

  while (isBefore(addMinutes(cursor, duracao), limFim) || 
         cursor.getTime() + duracao * 60000 <= limFim.getTime()) {
    const slotFim = addMinutes(cursor, duracao);

    // Não mostrar horários passados (+ 2h de antecedência)
    if (isAfter(cursor, addMinutes(now, 120))) {
      const conflito = ocupados.some(oc => {
        const ocIni = new Date(oc.dataHoraInicio);
        const ocFim = new Date(oc.dataHoraFim);
        return cursor < ocFim && slotFim > ocIni;
      });

      if (!conflito) {
        slots.push(new Date(cursor));
      }
    }

    cursor = addMinutes(cursor, intervalo);
    if (cursor >= limFim) break;
  }

  return slots;
}

/**
 * Retorna os próximos N dias úteis com slots disponíveis
 */
async function proximosDiasDisponiveis(diasTrabalho, horarioInicio, horarioFim, 
                                        intervalo, duracao, agendamentosExistentes,
                                        quantidade = 7) {
  const dias = [];
  let cursor = addDays(agora(), 0);
  let tentativas = 0;

  while (dias.length < quantidade && tentativas < 60) {
    const diaSemana = getDay(cursor); // 0=Dom

    if (diasTrabalho.includes(diaSemana)) {
      const ocupadosDia = agendamentosExistentes.filter(a => {
        const d = toZonedTime(new Date(a.dataHoraInicio), TZ);
        return format(d, 'yyyy-MM-dd') === format(toZonedTime(cursor, TZ), 'yyyy-MM-dd');
      });

      const slots = gerarSlots(cursor, horarioInicio, horarioFim, 
                                intervalo, duracao, ocupadosDia);
      if (slots.length > 0) {
        dias.push({ data: new Date(cursor), slots });
      }
    }

    cursor = addDays(cursor, 1);
    tentativas++;
  }

  return dias;
}

module.exports = {
  agora,
  formatarData,
  formatarHora,
  formatarDataHora,
  gerarSlots,
  proximosDiasDisponiveis,
  addMinutes,
  addDays,
  startOfDay,
  endOfDay,
};
