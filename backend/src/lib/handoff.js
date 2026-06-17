// Duração do handoff: 30 minutos em milissegundos
const HANDOFF_TIMEOUT_MS = 30 * 60 * 1000;

// Mapa para gerenciar os timers ativos
// Chave: `${instanceId}_${senderJid}`
// Valor: NodeJS.Timeout
const activeHandoffs = new Map();

/**
 * Ativa ou renova o modo de atendimento humano (Handoff) para um usuário.
 * Pausa a IA por 30 minutos.
 * @param {string} instanceId 
 * @param {string} senderJid 
 */
export function setHandoff(instanceId, senderJid) {
  const key = `${instanceId}_${senderJid}`;

  // Se já havia um timer, limpa para renovar
  if (activeHandoffs.has(key)) {
    clearTimeout(activeHandoffs.get(key));
  }

  // Cria um novo timer de 30 minutos
  const timer = setTimeout(() => {
    activeHandoffs.delete(key);
    console.log(`[Handoff] Timer de 30 minutos expirou para ${senderJid}. IA retomou o controle.`);
  }, HANDOFF_TIMEOUT_MS);

  activeHandoffs.set(key, timer);
  console.log(`[Handoff] Atendimento Humano ativado/renovado para ${senderJid}. IA pausada por 30 minutos.`);
}

/**
 * Verifica se a IA está pausada (atendimento humano ativo) para um usuário específico.
 * @param {string} instanceId 
 * @param {string} senderJid 
 * @returns {boolean}
 */
export function isHandoffActive(instanceId, senderJid) {
  const key = `${instanceId}_${senderJid}`;
  return activeHandoffs.has(key);
}

/**
 * Encerra o Handoff manualmente (se necessário no futuro).
 * @param {string} instanceId 
 * @param {string} senderJid 
 */
export function clearHandoff(instanceId, senderJid) {
  const key = `${instanceId}_${senderJid}`;
  if (activeHandoffs.has(key)) {
    clearTimeout(activeHandoffs.get(key));
    activeHandoffs.delete(key);
    console.log(`[Handoff] Handoff encerrado manualmente para ${senderJid}. IA retomou o controle.`);
  }
}
