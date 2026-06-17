import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Registra uma nova conversa (atendimento) no painel, caso não exista para o mesmo número e unidade.
 * Se já existir, apenas atualiza a data de modificação.
 */
export async function registerConversation(telefone, tutorName, clinicaId, unidadeId, lid = null) {
  if (!telefone || !unidadeId || !clinicaId) return null;

  try {
    // 1. Verifica se já existe
    const { data: existing } = await supabase
      .from('conversas')
      .select('id')
      .eq('telefone', telefone)
      .eq('unidade_id', unidadeId)
      .maybeSingle();

    if (existing) {
      // Já existe, atualiza apenas o updated_at para subir no painel (e o lid se for novo)
      const updateData = { updated_at: new Date().toISOString() };
      if (lid) updateData.whatsapp_lid = lid;
      
      await supabase
        .from('conversas')
        .update(updateData)
        .eq('id', existing.id);
      return existing;
    }

    // 2. Não existe, insere um novo registro (novo lead)
    const { data: newConv, error } = await supabase
      .from('conversas')
      .insert({
        telefone,
        whatsapp_lid: lid,
        tutor: tutorName || 'Não Informado',
        clinica_id: clinicaId,
        unidade_id: unidadeId,
        status: 'IA respondendo',
        origem: 'WhatsApp'
      })
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Erro ao registrar nova conversa:', error.message);
      return null;
    }

    console.log(`[Supabase] Nova conversa (lead) registrada para ${telefone}`);
    return newConv;
  } catch (err) {
    console.error('[Supabase] Falha ao tentar registrar conversa:', err.message);
    return null;
  }
}

/**
 * Insere uma nova mensagem na tabela `mensagens`.
 */
export async function insertMensagem(conversaId, remetente, conteudo) {
  if (!conversaId) return null;
  try {
    const { data, error } = await supabase
      .from('mensagens')
      .insert({ conversa_id: conversaId, remetente, conteudo })
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] Erro ao inserir mensagem:', error.message);
      return null;
    }
    
    // Atualiza o updated_at da conversa para subir no painel
    await supabase.from('conversas').update({ updated_at: new Date().toISOString() }).eq('id', conversaId);
    
    return data;
  } catch (err) {
    console.error('[Supabase] Falha ao tentar inserir mensagem:', err.message);
    return null;
  }
}
