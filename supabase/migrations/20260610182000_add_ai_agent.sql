-- Migração: Tabela de histórico de conversas para memória longa da IA
-- Crie também a coluna is_ai_active e ai_prompt na tabela de conexões

-- 1. Histórico de conversa (memória longa da IA)
CREATE TABLE IF NOT EXISTS ai_conversation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL,  -- FK para a tabela de conexoes_whatsapp
  sender_jid TEXT NOT NULL,   -- Ex: 5511999999999@s.whatsapp.net
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para buscar histórico rapidamente por instância + número
CREATE INDEX IF NOT EXISTS idx_ai_history_instance_sender
  ON ai_conversation_history(instance_id, sender_jid, created_at DESC);

-- 2. Adiciona campos de IA na tabela de conexões (caso não existam)
-- Ajuste "conexoes_whatsapp" para o nome real da tabela no seu banco
ALTER TABLE conexoes_whatsapp
  ADD COLUMN IF NOT EXISTS is_ai_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_prompt TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wuzapi_token TEXT DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN conexoes_whatsapp.is_ai_active IS 'Indica se o agente de IA está ativo para esta instância';
COMMENT ON COLUMN conexoes_whatsapp.ai_prompt IS 'Prompt personalizado do sistema para o agente de IA';
COMMENT ON COLUMN conexoes_whatsapp.wuzapi_token IS 'Token do usuário na WUZAPI para autenticar as chamadas';
COMMENT ON TABLE ai_conversation_history IS 'Histórico de conversas para memória longa do agente de IA';
