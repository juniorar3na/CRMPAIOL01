import axios from 'axios';

const WUZAPI_URL = process.env.WUZAPI_URL;

/**
 * Retorna uma instância do Axios configurada para a WUZAPI
 * usando o token da instância (usuário) específico
 */
function wuzClient(token) {
  return axios.create({
    baseURL: WUZAPI_URL,
    headers: {
      'Content-Type': 'application/json',
      token: token,
    },
    timeout: 30000,
  });
}

/**
 * Configura o webhook de uma instância para apontar para este servidor.
 * Chamado quando o usuário ativa a IA no CRM.
 */
export async function setWebhook(instanceToken, webhookUrl) {
  const client = wuzClient(instanceToken);
  const response = await client.post('/webhook', {
    WebhookURL: webhookUrl,
    webhook: webhookUrl,
    Events: ['Message'],
    events: ['Message'],
    Active: true,
    active: true
  });
  return response.data;
}

/**
 * Lê o webhook configurado em uma instância.
 */
export async function getWebhook(instanceToken) {
  const client = wuzClient(instanceToken);
  const response = await client.get('/webhook');
  return response.data;
}

/**
 * Remove o webhook de uma instância.
 * Chamado quando o usuário desativa a IA no CRM.
 */
export async function deleteWebhook(instanceToken) {
  const client = wuzClient(instanceToken);
  const response = await client.delete('/webhook');
  return response.data;
}

/**
 * Ativa o status "digitando..." para um número.
 * State: "composing" = digitando | "paused" = parou
 * Media: "audio" = gravando audio (opcional)
 */
export async function setPresence(instanceToken, phone, state = 'composing', media = null) {
  const cleanPhone = phone.split('@')[0];
  const client = wuzClient(instanceToken);
  const body = { Phone: cleanPhone, State: state };
  if (media) body.Media = media;

  const response = await client.post('/chat/presence', body);
  return response.data;
}

/**
 * Envia uma mensagem de texto simples para um número.
 */
export async function sendText(instanceToken, phone, text) {
  const cleanPhone = phone.split('@')[0];
  const client = wuzClient(instanceToken);
  const response = await client.post('/chat/send/text', {
    Phone: cleanPhone,
    Body: text,
  });
  return response.data;
}

/**
 * Faz o download de uma imagem de uma mensagem e retorna em Base64.
 * Payload deve conter as informações do media (url, mimetype, etc.)
 */
export async function downloadImage(instanceToken, mediaPayload) {
  const client = wuzClient(instanceToken);
  const response = await client.post('/chat/downloadimage', mediaPayload);
  return response.data; // { Data: "data:image/jpeg;base64,...", Mimetype: "image/jpeg" }
}

/**
 * Faz o download de um áudio de uma mensagem e retorna em Base64.
 */
export async function downloadAudio(instanceToken, mediaPayload) {
  const client = wuzClient(instanceToken);
  const response = await client.post('/chat/downloadaudio', mediaPayload);
  return response.data; // { Data: "data:audio/ogg;base64,...", Mimetype: "audio/ogg" }
}

/**
 * Envia um áudio para um número.
 * O áudio deve ser base64 encoded em formato audio/ogg; codecs=opus.
 * PTT = true indica push-to-talk (mensagem de voz).
 */
export async function sendAudio(instanceToken, phone, audioBase64, ptt = true) {
  const cleanPhone = phone.split('@')[0];
  const client = wuzClient(instanceToken);
  const response = await client.post('/chat/send/audio', {
    Phone: cleanPhone,
    Audio: audioBase64,
    PTT: ptt,
    MimeType: 'audio/ogg; codecs=opus',
  });
  return response.data;
}

/**
 * Envia um documento para um número.
 * O documento deve ser base64 encoded.
 */
export async function sendDocument(instanceToken, phone, documentBase64, fileName) {
  const cleanPhone = phone.split('@')[0];
  const client = wuzClient(instanceToken);
  const response = await client.post('/chat/send/document', {
    Phone: cleanPhone,
    Document: documentBase64,
    FileName: fileName,
  });
  return response.data;
}

/**
 * Verifica se os números possuem conta no WhatsApp e retorna o JID validado.
 */
export async function checkUser(instanceToken, phone) {
  const cleanPhone = phone.split('@')[0];
  const client = wuzClient(instanceToken);
  const response = await client.post('/user/check', {
    Phone: [cleanPhone],
  });
  const users = response.data?.data?.Users || [];
  return users[0] || null;
}

