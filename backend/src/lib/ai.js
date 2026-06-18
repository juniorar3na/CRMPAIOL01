import OpenAI from 'openai';
import { supabase } from './supabase.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Busca o histórico de conversa de um número no Supabase (memória longa).
 * Retorna no formato que a OpenAI espera: [{ role, content }]
 */
async function getConversationHistory(instanceId, senderJid, limit = 20) {
  const { data, error } = await supabase
    .from('ai_conversation_history')
    .select('role, content')
    .eq('instance_id', instanceId)
    .eq('sender_jid', senderJid)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[AI] Erro ao buscar histórico:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Salva uma mensagem no histórico de conversa (memória longa).
 */
export async function saveToHistory(instanceId, senderJid, role, content) {
  const { error } = await supabase.from('ai_conversation_history').insert({
    instance_id: instanceId,
    sender_jid: senderJid,
    role,
    content: typeof content === 'string' ? content : JSON.stringify(content),
  });

  if (error) {
    console.error('[AI] Erro ao salvar histórico:', error.message);
  }
}

import { toFile } from 'openai';

/**
 * Transcreve um áudio em Base64 (ogg/opus) usando o Whisper da OpenAI.
 * @param {string} base64Audio - String base64 do áudio (com ou sem prefixo data:audio/...)
 * @returns {string} - Texto transcrito
 */
export async function transcribeAudio(base64Audio) {
  // Remove o prefixo data URI se existir
  const base64Data = base64Audio.replace(/^data:audio\/\w+(?:;\s*codecs=[^;]+)?;base64,/, '').replace(/^data:application\/ogg;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // A OpenAI precisa de um File-like object com nome, usamos o helper do SDK
  const file = await toFile(buffer, 'audio.ogg', { type: 'audio/ogg' });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'pt',
  });

  return transcription.text;
}

/**
 * Gera uma resposta de IA multimodal com memória longa.
 *
 * @param {object} params
 * @param {string} params.instanceId - ID da instância/conexão no Supabase
 * @param {string} params.senderJid - JID do remetente (número@s.whatsapp.net)
 * @param {string} params.systemPrompt - Prompt personalizado configurado no CRM
 * @param {string|null} params.textContent - Texto recebido (agrupado se houver debounce)
 * @param {string|null} params.imageBase64 - Imagem em Base64 (se houver)
 * @returns {{ reply: string, inputTokens: number }}
 */
export async function generateAIResponse({
  instanceId,
  senderJid,
  systemPrompt,
  textContent = null,
  imageBase64 = null,
}) {
  // 1. Busca histórico de conversa para memória longa
  const history = await getConversationHistory(instanceId, senderJid);

  // 2. Monta o conteúdo da mensagem atual
  let userContentForOpenAI;
  let userContentForHistory;

  if (imageBase64) {
    // Monta mensagem com imagem para GPT-4o Vision
    userContentForOpenAI = [
      {
        type: 'image_url',
        image_url: { url: imageBase64, detail: 'auto' },
      },
    ];
    
    userContentForHistory = textContent ? `[Imagem enviada] ${textContent}` : '[Imagem enviada]';
    
    if (textContent) {
      userContentForOpenAI.push({ type: 'text', text: textContent });
    } else {
      userContentForOpenAI.push({ type: 'text', text: 'O que você vê nesta imagem?' });
    }
  } else {
    userContentForOpenAI = textContent || '';
    userContentForHistory = textContent || '';
  }

  // 3. Salva a mensagem do usuário no histórico (apenas texto, sem base64)
  await saveToHistory(instanceId, senderJid, 'user', userContentForHistory);

  // Limpa histórico antigo caso tenha arrays com imagens (evita estourar limite de tokens)
  const parsedHistory = history.map(h => {
    let content = h.content;
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        content = parsed.filter(item => item.type === 'text').map(item => item.text).join(' ') || '[Imagem]';
      }
    } catch (e) {}
    return { role: h.role, content };
  });

  // 4. Monta os messages para a OpenAI com system prompt + histórico completo
  const messages = [
    { role: 'system', content: systemPrompt },
    ...parsedHistory,
    { role: 'user', content: userContentForOpenAI },
  ];

  // 5. Chama a API da OpenAI
  const model = imageBase64 ? 'gpt-4o' : 'gpt-4o-mini';
  console.log(`[AI] Chamando modelo ${model}...`);

  const completion = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: 1000,
    temperature: 0.8, // Um pouco mais criativo/humanizado
  });

  const reply = completion.choices[0].message.content;

  // 6. Salva a resposta da IA no histórico (memória longa)
  await saveToHistory(instanceId, senderJid, 'assistant', reply);

  return {
    reply,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
  };
}

/**
 * Atualiza o resumo da conversa em background, analisando o histórico.
 */
export async function updateConversationSummary(instanceId, senderJid, conversaId) {
  if (!conversaId) return;
  try {
    const history = await getConversationHistory(instanceId, senderJid, 15);
    if (history.length < 2) return; // Não resume se tem poucas mensagens
    
    const transcript = history.map(h => `${h.role === 'user' ? 'Cliente' : 'Atendente/IA'}: ${h.content}`).join('\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente que resume conversas de uma clínica veterinária. Faça um resumo muito curto, direto e objetivo (no máximo 3 linhas) informando: Qual o problema/motivo do contato? Qual o pet? E qual o status atual ou próxima ação? Se não tiver esses dados ainda, resuma o que tem.'
        },
        { role: 'user', content: transcript }
      ],
      temperature: 0.3,
      max_tokens: 150
    });
    
    const resumo = response.choices[0].message.content;
    
    // Atualiza no banco (Supabase Realtime vai atualizar o CRM automaticamente)
    await supabase.from('conversas').update({ resumo_ia: resumo }).eq('id', conversaId);
    console.log(`[AI] Resumo atualizado para a conversa ${conversaId}`);
  } catch (error) {
    console.error(`[AI] Erro ao gerar resumo:`, error.message);
  }
}

/**
 * Calcula o delay humanizado com base no tamanho da resposta.
 * Simula uma velocidade de digitação realista (250ms por palavra).
 * Mínimo de 2s, Máximo de 15s.
 */
export function calculateTypingDelay(text) {
  const words = text.trim().split(/\s+/).length;
  const msPerWord = 250; // ~240 palavras por minuto
  const delay = words * msPerWord;
  return Math.min(Math.max(delay, 2000), 15000);
}
