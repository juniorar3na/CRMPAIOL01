import { generateAIResponse, transcribeAudio, calculateTypingDelay, updateConversationSummary } from './ai.js';
import { setPresence, sendText } from './wuzapi.js';
import { insertMensagem } from './supabase.js';

// Tempo de debounce: 5 segundos
const DEBOUNCE_DELAY_MS = 5000;

// Mapa para armazenar as filas de mensagens por usuário
// Chave: `${instanceId}_${senderJid}`
// Valor: { timer: NodeJS.Timeout, messages: Array, instanceId, senderJid, systemPrompt, apiToken }
const userQueues = new Map();

/**
 * Adiciona uma nova mensagem à fila do usuário e reinicia o timer.
 * @param {object} params
 * @param {string} params.instanceId - ID da instância
 * @param {string} params.senderJid - JID do usuário que enviou a mensagem
 * @param {string} params.systemPrompt - Prompt do sistema
 * @param {string} params.apiToken - Token da API WuzAPI
 * @param {string|null} params.textContent - Texto da mensagem
 * @param {string|null} params.audioBase64 - Áudio base64
 * @param {string|null} params.imageBase64 - Imagem base64
 */
export async function enqueueMessage({
  instanceId,
  conversaId,
  senderJid,
  systemPrompt,
  apiToken,
  textContent,
  audioBase64,
  imageBase64,
}) {
  const queueKey = `${instanceId}_${senderJid}`;

  let queue = userQueues.get(queueKey);

  // Se não existe fila para esse usuário, cria uma nova
  if (!queue) {
    queue = {
      messages: [],
      timer: null,
      instanceId,
      conversaId,
      senderJid,
      systemPrompt,
      apiToken,
    };
    userQueues.set(queueKey, queue);
  }

  // Adiciona a nova mensagem ao array
  queue.messages.push({ textContent, audioBase64, imageBase64 });

  // Limpa o timer anterior se existir (reiniciando a contagem)
  if (queue.timer) {
    clearTimeout(queue.timer);
  }

  // Ativa o status de digitando/gravando
  try {
    const presenceState = audioBase64 ? 'recording' : 'composing';
    // Observação: a documentação diz que media="audio" para gravação, mas se não suportar, deixamos composing
    await setPresence(apiToken, senderJid, 'composing');
  } catch (err) {
    console.warn(`[Debounce] Não foi possível definir presence para ${senderJid}:`, err.message);
  }

  // Configura o novo timer
  queue.timer = setTimeout(async () => {
    await processQueue(queueKey);
  }, DEBOUNCE_DELAY_MS);
}

/**
 * Processa as mensagens acumuladas após o tempo de debounce expirar.
 * @param {string} queueKey - Chave da fila (instanceId_senderJid)
 */
async function processQueue(queueKey) {
  const queue = userQueues.get(queueKey);
  if (!queue) return;

  // Remove a fila do mapa para permitir novos agrupamentos
  userQueues.delete(queueKey);

  const { instanceId, conversaId, senderJid, systemPrompt, apiToken, messages } = queue;
  console.log(`[Debounce] Processando fila para ${senderJid} com ${messages.length} mensagens agregadas.`);

  try {
    let finalGroupedText = '';
    let lastImageBase64 = null;

    // Processa todas as mensagens sequencialmente
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // Se tiver áudio, transcreve e adiciona ao texto agrupado
      if (msg.audioBase64) {
        console.log(`[Debounce] Transcrevendo áudio ${i + 1} de ${senderJid}...`);
        try {
          const transcription = await transcribeAudio(msg.audioBase64);
          finalGroupedText += `\n[Áudio transcrito]: ${transcription}`;
        } catch (audioErr) {
          console.error(`[Debounce] Erro ao transcrever áudio:`, audioErr.message);
          finalGroupedText += `\n[Áudio recebido, mas falhou ao transcrever]`;
        }
      }

      // Se tiver texto, adiciona ao texto agrupado
      if (msg.textContent) {
        // Se já tiver texto acumulado, adiciona quebra de linha
        if (finalGroupedText.length > 0) finalGroupedText += '\n';
        finalGroupedText += msg.textContent;
      }

      // Se tiver imagem, mantém a última
      if (msg.imageBase64) {
        lastImageBase64 = msg.imageBase64;
      }
    }

    finalGroupedText = finalGroupedText.trim();

    if (!finalGroupedText && !lastImageBase64) {
      console.log(`[Debounce] Fila vazia após processamento. Cancelando resposta para ${senderJid}.`);
      return;
    }

    console.log(`[AI] Gerando resposta com prompt agrupado:\n"${finalGroupedText.substring(0, 100)}..."`);

    // Gera a resposta chamando a IA
    const { reply } = await generateAIResponse({
      instanceId,
      senderJid,
      systemPrompt,
      textContent: finalGroupedText,
      imageBase64: lastImageBase64,
    });

    // Calcula delay realista de digitação (já que agrupamos mensagens grandes, o delay pode ser longo)
    const delay = calculateTypingDelay(reply);
    console.log(`[AI] Resposta gerada (${reply.length} chars). Aguardando ${delay}ms antes de enviar...`);

    // Aguarda simulando a digitação
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Para o "digitando..."
    try {
      await setPresence(apiToken, senderJid, 'paused');
    } catch (_) {}

    // Envia a resposta final
    await sendText(apiToken, senderJid, reply);
    console.log(`[AI] ✅ Resposta enviada para ${senderJid}: "${reply.substring(0, 80)}..."`);

    // Salva a resposta no CRM
    if (conversaId) {
      await insertMensagem(conversaId, 'ia', reply);
      
      // Atualiza resumo no background
      updateConversationSummary(instanceId, senderJid, conversaId);
    }

  } catch (error) {
    console.error(`[Debounce] ❌ Erro ao processar fila agrupada de ${senderJid}:`, error.message);
    console.error(error.stack);

    try {
      await setPresence(apiToken, senderJid, 'paused');
    } catch (_) {}
  }
}
