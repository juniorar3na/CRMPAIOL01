import { supabase, registerConversation, insertMensagem } from '../lib/supabase.js';
import { setPresence, sendText, downloadImage, downloadAudio } from '../lib/wuzapi.js';
import { generateAIResponse, calculateTypingDelay, saveToHistory, transcribeAudio, updateConversationSummary } from '../lib/ai.js';
import { enqueueMessage } from '../lib/debounce.js';
import { setHandoff, isHandoffActive } from '../lib/handoff.js';

/**
 * Busca os dados da instância/conexão no Supabase pelo token da WUZAPI ou pelo nome.
 */
async function getInstance(wuzapiToken, instanceName) {
  let query = supabase
    .from('whatsapp_sessoes')
    .select('id, ia_ativa, api_token, ia_prompt, clinica_id, unidade_id');

  if (wuzapiToken) {
    query = query.eq('api_token', wuzapiToken);
  } else if (instanceName) {
    query = query.eq('instance_name', instanceName);
  } else {
    return null;
  }

  const { data, error } = await query.single();

  if (error || !data) return null;
  return data;
}

/**
 * Handler principal do webhook recebido da WUZAPI.
 * Esta função é chamada para cada evento enviado pela WUZAPI.
 */
export async function handleWebhook(req, res) {
  // Responde imediatamente para não deixar a WUZAPI esperando
  res.status(200).json({ success: true });

  const payload = req.body;

  // Log completo do payload para debug
  console.log(`[Webhook] Payload recebido:`, JSON.stringify(payload).substring(0, 500));

  // A WUZAPI envia o token do usuário no header ou no payload, mas para webhooks v3 ela pode enviar apenas instanceName
  const instanceToken = req.headers['token'] || payload?.token;
  const instanceName = payload?.instanceName || payload?.instance_name;

  if (!instanceToken && !instanceName) {
    console.log('[Webhook] Sem token ou instanceName no payload. Ignorando.', JSON.stringify(payload));
    return;
  }

  // Extrai evento — pode ser string, array, ou outra coisa
  let eventName = payload?.type || '';
  if (typeof payload?.event === 'string') {
    eventName = payload.event;
  }
  
  // Se for array, pega o primeiro elemento
  if (Array.isArray(eventName)) {
    eventName = eventName[0] || '';
  }
  
  // Converte para string de forma segura
  eventName = String(eventName).toLowerCase();
  
  // O nome da instância já foi extraído acima
  
  // Extrai informações do WuzAPI
  const info = payload?.data?.info || payload?.data?.Info || payload?.event?.Info || {};
  const message = payload?.data?.message || payload?.data?.Message || payload?.event?.Message || {};

  if (!message || Object.keys(message).length === 0) {
    return;
  }

  // Identifica quem enviou
  const isFromMe = info.IsFromMe || info.fromMe || false;
  
  const possibleJids = [
    info.SenderAlt, info.RemoteJid, info.remoteJid, info.Chat, info.chat, info.Sender, info.sender
  ].filter(Boolean);

  let realJid = possibleJids.find(j => j.includes('@s.whatsapp.net') || j.match(/^\d+@/));
  let lidJid = possibleJids.find(j => j.includes('@lid'));

  let senderJid = realJid || possibleJids[0] || '';
  let lidId = lidJid ? lidJid.split('@')[0] : null;

  if (!senderJid) {
    console.log(`[Webhook] Mensagem sem senderJid:`, JSON.stringify(info));
    return;
  }

  // Remove o device ID se existir no JID (ex: 5511959767244:33@s.whatsapp.net -> 5511959767244@s.whatsapp.net)
  if (senderJid.includes(':') && senderJid.includes('@')) {
    const [phonePart, domainPart] = senderJid.split('@');
    senderJid = `${phonePart.split(':')[0]}@${domainPart}`;
  }

  // Ignora mensagens de status (status@broadcast)
  if (senderJid.includes('status@broadcast')) {
    console.log('[Webhook] Mensagem de status ignorada.');
    return;
  }

  // ✅ IGNORA GRUPOS (@g.us)
  if (senderJid.includes('@g.us') || info.IsGroup || info.isGroup || info.BroadcastListOwner) {
    console.log(`[Webhook] Mensagem de grupo ignorada.`);
    return;
  }

  console.log(`[Webhook] Mensagem recebida de ${senderJid}`);

  // Busca a instância no banco para verificar se a IA está ativa
  const instance = await getInstance(instanceToken, instanceName);

  if (!instance) {
    console.warn(`[Webhook] Instância não encontrada para token/nome: ${instanceToken || instanceName}`);
    return;
  }

  if (!instance.ia_ativa) {
    console.log(`[Webhook] IA desativada para a instância ${instance.id}. Ignorando.`);
    return;
  }

  // ---- NOVO: Registra o Lead/Atendimento e obtem conversaId ----
  let conversaId = null;
  const rawPhone = senderJid.split('@')[0];
  const isLid = senderJid.includes('@lid');
  let realPhone = rawPhone;

  if (isLid) {
    // Tenta achar o telefone real no banco
    const { data: convByLid } = await supabase.from('conversas').select('id, telefone').eq('whatsapp_lid', rawPhone).eq('unidade_id', instance.unidade_id).maybeSingle();
    if (convByLid) {
      conversaId = convByLid.id;
      realPhone = convByLid.telefone;
      senderJid = `${realPhone}@s.whatsapp.net`; // Substitui o senderJid pelo real para que o resto do sistema (handoff, etc) funcione!
    }
  }

  if (!isFromMe) {
    const tutorName = info.PushName || info.pushName || info.VerifiedName || info.verifiedName || '';
    const conv = await registerConversation(realPhone, tutorName, instance.clinica_id, instance.unidade_id, lidId);
    if (!conversaId) conversaId = conv?.id || null;
  } else if (!conversaId) {
    const { data: conv } = await supabase.from('conversas').select('id').eq('telefone', realPhone).eq('unidade_id', instance.unidade_id).maybeSingle();
    conversaId = conv?.id || null;
  }
  // -------------------------------------------

  // Extrai o conteúdo da mensagem
  let textContent = null;
  let imageBase64 = null;
  let audioBase64 = null;

  try {
    const isText = message.Conversation || message.conversation;
    const isExtended = message.ExtendedTextMessage || message.extendedTextMessage;
    const isImage = message.ImageMessage || message.imageMessage;
    const isAudio = message.AudioMessage || message.audioMessage || message.PTT || message.ptt;

    if (isText) {
      textContent = typeof isText === 'string' ? isText : String(isText);
      console.log(`[Webhook] Tipo: texto simples — "${textContent.substring(0, 50)}"`);
    } else if (isExtended) {
      textContent = isExtended.Text || isExtended.text || '';
      console.log(`[Webhook] Tipo: texto estendido — "${textContent.substring(0, 50)}"`);
    } else if (isImage) {
      console.log(`[Webhook] Tipo: imagem. Baixando...`);
      try {
        const downloaded = await downloadImage(instance.api_token, {
          Url: isImage.Url || isImage.url || isImage.URL,
          DirectPath: isImage.DirectPath || isImage.directPath,
          MediaKey: isImage.MediaKey || isImage.mediaKey,
          Mimetype: isImage.Mimetype || isImage.mimetype,
          FileEncSHA256: isImage.FileEncSha256 || isImage.fileEncSha256 || isImage.fileEncSHA256 || isImage.FileEncSHA256,
          FileSHA256: isImage.FileSha256 || isImage.fileSha256 || isImage.fileSHA256 || isImage.FileSHA256,
          FileLength: isImage.FileLength || isImage.fileLength,
        });
        imageBase64 = downloaded?.data?.Data || downloaded?.data?.data || downloaded?.Data || downloaded?.data;
        textContent = isImage.Caption || isImage.caption || null;
      } catch (dlErr) {
        console.error(`[Webhook] Erro ao baixar imagem:`, dlErr.message);
        textContent = isImage.Caption || isImage.caption || '[Imagem não pôde ser processada]';
      }
    } else if (isAudio) {
      console.log(`[Webhook] Tipo: áudio. Baixando...`);
      try {
        const downloaded = await downloadAudio(instance.api_token, {
          Url: isAudio.Url || isAudio.url || isAudio.URL,
          DirectPath: isAudio.DirectPath || isAudio.directPath,
          MediaKey: isAudio.MediaKey || isAudio.mediaKey,
          Mimetype: isAudio.Mimetype || isAudio.mimetype,
          FileEncSHA256: isAudio.FileEncSha256 || isAudio.fileEncSha256 || isAudio.fileEncSHA256 || isAudio.FileEncSHA256,
          FileSHA256: isAudio.FileSha256 || isAudio.fileSha256 || isAudio.fileSHA256 || isAudio.FileSHA256,
          FileLength: isAudio.FileLength || isAudio.fileLength,
        });
        audioBase64 = downloaded?.data?.Data || downloaded?.data?.data || downloaded?.Data || downloaded?.data;
      } catch (dlErr) {
        console.error(`[Webhook] Erro ao baixar áudio:`, dlErr.message);
        textContent = '[Áudio não pôde ser processado]';
      }
    } else {
      console.log(`[Webhook] Tipo de mensagem não suportado. Keys:`, Object.keys(message).join(', '));
      return;
    }

    // Verifica se temos algo para processar
    if (!textContent && !imageBase64 && !audioBase64) {
      console.log('[Webhook] Nenhum conteúdo extraído da mensagem. Ignorando.');
      return;
    }

    // Lógica de Handoff (Atendimento Humano)
    if (isFromMe) {
      console.log(`[Webhook] Mensagem enviada pelo proprietário para ${senderJid}. Ativando Handoff de 30 min.`);
      setHandoff(instance.id, senderJid);
      
      let contentToSave = textContent;
      if (audioBase64 && !contentToSave) {
        try {
          contentToSave = '[Áudio transcrito do proprietário]: ' + await transcribeAudio(audioBase64);
        } catch (e) {
          contentToSave = '[Áudio enviado pelo proprietário]';
        }
      } else if (imageBase64 && !contentToSave) {
        contentToSave = '[Imagem enviada pelo proprietário]';
      }

      if (contentToSave) {
        await saveToHistory(instance.id, senderJid, 'assistant', contentToSave);
        if (conversaId) {
          // Previne duplicação com o chat-send.js (que já salva como recepcao)
          const { data: recente } = await supabase.from('mensagens').select('id')
            .eq('conversa_id', conversaId)
            .eq('conteudo', contentToSave)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!recente) {
            await insertMensagem(conversaId, 'recepcao', contentToSave);
          }
          // Atualiza resumo no background
          updateConversationSummary(instance.id, senderJid, conversaId);
        }
      }
      return; // Encerra, não chama a IA
    }

    // Se for do cliente, mas estiver em Handoff
    if (isHandoffActive(instance.id, senderJid)) {
      console.log(`[Webhook] Handoff ativo para ${senderJid}. IA pausada. Salvando histórico do cliente.`);
      let contentToSave = textContent;
      if (audioBase64 && !contentToSave) {
        try {
          contentToSave = '[Áudio transcrito]: ' + await transcribeAudio(audioBase64);
        } catch (e) {
          contentToSave = '[Áudio enviado]';
        }
      } else if (imageBase64 && !contentToSave) {
        contentToSave = '[Imagem enviada]';
      }

      if (contentToSave) {
        await saveToHistory(instance.id, senderJid, 'user', contentToSave);
        if (conversaId) {
          await insertMensagem(conversaId, 'tutor', contentToSave);
          // Atualiza resumo no background
          updateConversationSummary(instance.id, senderJid, conversaId);
        }
      }
      return; // Encerra, não chama a IA
    }

    const systemPrompt = instance.ia_prompt || 'Você é um assistente virtual prestativo. Responda de forma natural, humanizada e concisa.';

    // Salva a mensagem original do tutor no CRM antes de agrupar para a IA
    let userMsgToCrm = textContent;
    if (audioBase64 && !userMsgToCrm) userMsgToCrm = '🎙️ Áudio recebido';
    if (imageBase64 && !userMsgToCrm) userMsgToCrm = '📷 Imagem recebida';
    if (conversaId && userMsgToCrm) await insertMensagem(conversaId, 'tutor', userMsgToCrm);

    // Envia a mensagem para a fila de debounce
    await enqueueMessage({
      instanceId: instance.id,
      conversaId,
      senderJid,
      systemPrompt,
      apiToken: instance.api_token,
      textContent,
      audioBase64,
      imageBase64,
    });
    
  } catch (error) {
    console.error(`[Webhook] ❌ Erro ao processar mensagem de ${senderJid}:`, error.message);
    console.error(`[Webhook] Stack:`, error.stack);
  }
}
