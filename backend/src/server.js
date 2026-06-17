import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { handleWebhook } from './handlers/webhook.js';
import { activateAI, deactivateAI, getAIStatus } from './handlers/ai-control.js';
import { handleSendText, handleSendAudio, handleSendDocument, handleHandoff, handleResumeAI } from './handlers/chat-send.js';
import { handleCreateRecepcao, handleGetRecepcao, handleUpdateRecepcao } from './handlers/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares ───────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Limite alto para suportar imagens em base64

// ─── Rota de saúde ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Webhook da WUZAPI ────────────────────────────────────
// A WUZAPI fará POST nesta rota quando receber mensagens
app.post('/webhook', handleWebhook);

// ─── Controle da IA ───────────────────────────────────────
// Chamados pelo Frontend (CRM) quando o usuário ativa/desativa a IA
app.post('/ai/:instanceId/activate', activateAI);
app.post('/ai/:instanceId/deactivate', deactivateAI);
app.get('/ai/:instanceId/status', getAIStatus);

// ─── Envio de mensagens pelo CRM ──────────────────────────
app.post('/chat/send/text', handleSendText);
app.post('/chat/send/audio', handleSendAudio);
app.post('/chat/send/document', handleSendDocument);
app.post('/chat/handoff', handleHandoff);
app.post('/chat/resume', handleResumeAI);

// ─── Autenticação e Usuários ──────────────────────────────
app.post('/auth/create-recepcao', handleCreateRecepcao);
app.get('/auth/recepcao/:unidadeId', handleGetRecepcao);
app.put('/auth/recepcao/:unidadeId', handleUpdateRecepcao);

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🤖 Servidor de IA rodando em http://localhost:${PORT}`);
  console.log(`📬 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`❤️  Health check:    http://localhost:${PORT}/health\n`);
  console.log('⚠️  IMPORTANTE: Para testar localmente, exponha esta porta com ngrok:');
  console.log(`   npx ngrok http ${PORT}\n`);
});

export default app;
