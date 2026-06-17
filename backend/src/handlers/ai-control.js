import { supabase } from '../lib/supabase.js';
import { setWebhook, deleteWebhook, getWebhook } from '../lib/wuzapi.js';

const BACKEND_WEBHOOK_URL = process.env.BACKEND_WEBHOOK_URL;

/**
 * Ativa a IA de uma instância:
 * 1. Registra o webhook na WUZAPI
 * 2. Atualiza ia_ativa = true no Supabase
 */
export async function activateAI(req, res) {
  const { instanceId } = req.params;

  try {
    // Busca a instância no banco
    const { data: instance, error } = await supabase
      .from('whatsapp_sessoes')
      .select('id, api_token')
      .eq('id', instanceId)
      .single();

    if (error || !instance) {
      return res.status(404).json({ success: false, error: 'Instância não encontrada.' });
    }

    // Registra o webhook na WUZAPI
    const webhookResult = await setWebhook(instance.api_token, BACKEND_WEBHOOK_URL);
    console.log(`[AI] Webhook configurado para instância ${instanceId}:`, webhookResult);

    // Atualiza o banco
    const { error: updateError } = await supabase
      .from('whatsapp_sessoes')
      .update({ ia_ativa: true })
      .eq('id', instanceId);

    if (updateError) throw updateError;

    return res.json({ success: true, message: 'IA ativada com sucesso!', webhook: BACKEND_WEBHOOK_URL });
  } catch (error) {
    console.error('[AI] Erro ao ativar IA:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Desativa a IA de uma instância:
 * 1. Remove o webhook da WUZAPI
 * 2. Atualiza ia_ativa = false no Supabase
 */
export async function deactivateAI(req, res) {
  const { instanceId } = req.params;

  try {
    const { data: instance, error } = await supabase
      .from('whatsapp_sessoes')
      .select('id, api_token')
      .eq('id', instanceId)
      .single();

    if (error || !instance) {
      return res.status(404).json({ success: false, error: 'Instância não encontrada.' });
    }

    // Remove o webhook da WUZAPI
    await deleteWebhook(instance.api_token);
    console.log(`[AI] Webhook removido para instância ${instanceId}`);

    // Atualiza o banco
    await supabase
      .from('whatsapp_sessoes')
      .update({ ia_ativa: false })
      .eq('id', instanceId);

    return res.json({ success: true, message: 'IA desativada com sucesso!' });
  } catch (error) {
    console.error('[AI] Erro ao desativar IA:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Retorna o status atual da IA de uma instância.
 */
export async function getAIStatus(req, res) {
  const { instanceId } = req.params;

  try {
    const { data: instance, error } = await supabase
      .from('whatsapp_sessoes')
      .select('id, ia_ativa, api_token')
      .eq('id', instanceId)
      .single();

    if (error || !instance) {
      return res.status(404).json({ success: false, error: 'Instância não encontrada.' });
    }

    // Verifica o webhook atual na WUZAPI
    const webhookInfo = await getWebhook(instance.api_token).catch(() => null);

    return res.json({
      success: true,
      ia_ativa: instance.ia_ativa,
      webhook: webhookInfo?.data?.webhook || null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
