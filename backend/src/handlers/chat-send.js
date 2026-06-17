import { supabase } from '../lib/supabase.js';
import { sendText, sendAudio, sendDocument, checkUser } from '../lib/wuzapi.js';
import { setHandoff, clearHandoff } from '../lib/handoff.js';

/**
 * Busca o api_token da sessão WhatsApp pela unidade_id da conversa.
 */
async function getSessionForConversa(conversaId) {
  // 1. Buscar a conversa para pegar unidade_id
  const { data: conversa, error: convError } = await supabase
    .from('conversas')
    .select('id, telefone, unidade_id, clinica_id')
    .eq('id', conversaId)
    .single();

  if (convError || !conversa) {
    throw new Error(`Conversa ${conversaId} não encontrada.`);
  }

  // 2. Buscar a sessão WhatsApp da unidade
  const { data: sessao, error: sessError } = await supabase
    .from('whatsapp_sessoes')
    .select('id, api_token, ia_ativa')
    .eq('unidade_id', conversa.unidade_id)
    .maybeSingle();

  if (sessError || !sessao || !sessao.api_token) {
    throw new Error(`Sessão WhatsApp não encontrada para a unidade da conversa ${conversaId}.`);
  }

  return { conversa, sessao };
}

/**
 * Salva a mensagem enviada na tabela mensagens do Supabase.
 */
async function salvarMensagem(conversaId, conteudo, remetente = 'recepcao') {
  const { data, error } = await supabase
    .from('mensagens')
    .insert({
      conversa_id: conversaId,
      conteudo,
      remetente,
    })
    .select()
    .single();

  if (error) {
    console.error('[ChatSend] Erro ao salvar mensagem:', error.message);
  }

  // Atualiza status da conversa para "Em atendimento" e updated_at
  await supabase
    .from('conversas')
    .update({
      status: 'Em atendimento',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversaId);

  return data;
}

/**
 * POST /chat/send/text
 * Body: { conversaId, texto }
 */
export async function handleSendText(req, res) {
  const { conversaId, texto } = req.body;

  if (!conversaId || !texto) {
    return res.status(400).json({ success: false, error: 'conversaId e texto são obrigatórios.' });
  }

  try {
    const { conversa, sessao } = await getSessionForConversa(conversaId);
    const phone = conversa.telefone;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Conversa sem telefone.' });
    }

    // Valida o número com WUZAPI
    const validacao = await checkUser(sessao.api_token, phone);
    if (!validacao || !validacao.IsInWhatsapp) {
      return res.status(400).json({ success: false, error: 'Este número não é um WhatsApp válido.' });
    }
    const validPhone = validacao.JID.split('@')[0];

    // Atualiza o telefone se estiver errado
    if (validPhone !== phone) {
      await supabase.from('conversas').update({ telefone: validPhone }).eq('id', conversaId);
    }

    // 1. Envia via WUZAPI
    const result = await sendText(sessao.api_token, validPhone, texto);
    console.log(`[ChatSend] Texto enviado para ${validPhone}:`, result?.data?.Details || 'ok');

    // 2. Salva no banco
    await salvarMensagem(conversaId, texto);

    // 3. Ativa handoff (IA para de responder)
    const senderJid = `${phone}@s.whatsapp.net`;
    setHandoff(sessao.id, senderJid);

    return res.json({ success: true, message: 'Texto enviado.' });
  } catch (error) {
    console.error('[ChatSend] Erro ao enviar texto:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /chat/send/audio
 * Body: { conversaId, audioBase64 }
 */
export async function handleSendAudio(req, res) {
  const { conversaId, audioBase64 } = req.body;

  if (!conversaId || !audioBase64) {
    return res.status(400).json({ success: false, error: 'conversaId e audioBase64 são obrigatórios.' });
  }

  try {
    const { conversa, sessao } = await getSessionForConversa(conversaId);
    const phone = conversa.telefone;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Conversa sem telefone.' });
    }

    // Valida o número com WUZAPI
    const validacao = await checkUser(sessao.api_token, phone);
    if (!validacao || !validacao.IsInWhatsapp) {
      return res.status(400).json({ success: false, error: 'Este número não é um WhatsApp válido.' });
    }
    const validPhone = validacao.JID.split('@')[0];

    if (validPhone !== phone) {
      await supabase.from('conversas').update({ telefone: validPhone }).eq('id', conversaId);
    }

    // 1. Envia via WUZAPI
    const result = await sendAudio(sessao.api_token, validPhone, audioBase64, true);
    console.log(`[ChatSend] Áudio enviado para ${validPhone}:`, result?.data?.Details || 'ok');

    // 2. Salva no banco
    await salvarMensagem(conversaId, '🎙️ Áudio enviado');

    // 3. Ativa handoff
    const senderJid = `${phone}@s.whatsapp.net`;
    setHandoff(sessao.id, senderJid);

    return res.json({ success: true, message: 'Áudio enviado.' });
  } catch (error) {
    console.error('[ChatSend] Erro ao enviar áudio:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /chat/send/document
 * Body: { conversaId, documentBase64, fileName }
 */
export async function handleSendDocument(req, res) {
  const { conversaId, documentBase64, fileName } = req.body;

  if (!conversaId || !documentBase64 || !fileName) {
    return res.status(400).json({ success: false, error: 'conversaId, documentBase64 e fileName são obrigatórios.' });
  }

  try {
    const { conversa, sessao } = await getSessionForConversa(conversaId);
    const phone = conversa.telefone;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Conversa sem telefone.' });
    }

    // Valida o número com WUZAPI
    const validacao = await checkUser(sessao.api_token, phone);
    if (!validacao || !validacao.IsInWhatsapp) {
      return res.status(400).json({ success: false, error: 'Este número não é um WhatsApp válido.' });
    }
    const validPhone = validacao.JID.split('@')[0];

    if (validPhone !== phone) {
      await supabase.from('conversas').update({ telefone: validPhone }).eq('id', conversaId);
    }

    // 1. Envia via WUZAPI
    const result = await sendDocument(sessao.api_token, validPhone, documentBase64, fileName);
    console.log(`[ChatSend] Documento enviado para ${validPhone}:`, result?.data?.Details || 'ok');

    // 2. Salva no banco
    await salvarMensagem(conversaId, `📎 ${fileName}`);

    // 3. Ativa handoff
    const senderJid = `${phone}@s.whatsapp.net`;
    setHandoff(sessao.id, senderJid);

    return res.json({ success: true, message: 'Documento enviado.' });
  } catch (error) {
    console.error('[ChatSend] Erro ao enviar documento:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /chat/handoff
 * Body: { conversaId }
 * Assume o atendimento: ativa o handoff e atualiza o status da conversa.
 */
export async function handleHandoff(req, res) {
  const { conversaId } = req.body;

  if (!conversaId) {
    return res.status(400).json({ success: false, error: 'conversaId é obrigatório.' });
  }

  try {
    const { conversa, sessao } = await getSessionForConversa(conversaId);
    const phone = conversa.telefone;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Conversa sem telefone.' });
    }

    // 1. Ativa handoff (IA para de responder por 30 min)
    const senderJid = `${phone}@s.whatsapp.net`;
    setHandoff(sessao.id, senderJid);

    // 2. Atualiza status da conversa
    await supabase
      .from('conversas')
      .update({
        status: 'Em atendimento',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversaId);

    console.log(`[ChatSend] Handoff ativado para conversa ${conversaId} (${phone})`);

    return res.json({ success: true, message: 'Atendimento assumido. IA pausada por 30 minutos.' });
  } catch (error) {
    console.error('[ChatSend] Erro ao ativar handoff:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /chat/resume
 * Body: { conversaId }
 * Retoma o atendimento pela IA: limpa o handoff ativo e atualiza status.
 */
export async function handleResumeAI(req, res) {
  const { conversaId } = req.body;

  if (!conversaId) {
    return res.status(400).json({ success: false, error: 'conversaId é obrigatório.' });
  }

  try {
    const { conversa, sessao } = await getSessionForConversa(conversaId);
    const phone = conversa.telefone;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Conversa sem telefone.' });
    }

    const senderJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    clearHandoff(sessao.id, senderJid);

    await supabase
      .from('conversas')
      .update({
        status: 'IA respondendo',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversaId);

    console.log(`[ChatSend] IA retomada manualmente para conversa ${conversaId} (${phone})`);

    return res.json({ success: true, message: 'IA retomada com sucesso.' });
  } catch (error) {
    console.error('[ChatSend] Erro ao retomar IA:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
