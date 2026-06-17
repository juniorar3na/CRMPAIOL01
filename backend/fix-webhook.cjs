const fs = require('fs');
const path = 'e:/CRM vetpaiol/backend/src/handlers/webhook.js';
let content = fs.readFileSync(path, 'utf8');

const oldStr = `  // Filtra apenas eventos de mensagem recebida (não enviada)
  if (payload?.type !== 'Message') return;

  const message = payload?.data?.Message;
  const info = payload?.data?.Info;

  if (!message || !info) return;

  // Ignora mensagens enviadas pelo próprio número (echo)
  if (info.FromMe === true) return;

  const senderJid = info.RemoteJid;
  if (!senderJid) return;

  // ✅ IGNORA GRUPOS (@g.us)
  if (senderJid.endsWith('@g.us')) {
    console.log(\`[Webhook] Mensagem de grupo ignorada: \${senderJid}\`);
    return;
  }

  console.log(\`[Webhook] Mensagem recebida de \${senderJid}\`);`;

const newStr = `  // Extrai evento de mensagem (suporta WuzAPI v3 'message' event)
  const eventName = payload?.event || payload?.type;
  if (!eventName || eventName.toLowerCase() !== 'message') {
    return;
  }

  const message = payload?.data?.message || payload?.data?.Message;
  const info = payload?.data?.info || payload?.data?.Info;

  if (!message || !info) {
    console.log(\`[Webhook] Evento de mensagem sem info/message:\`, JSON.stringify(payload).substring(0, 200));
    return;
  }

  // Ignora mensagens enviadas pelo próprio número (echo)
  if (info.FromMe === true || info.fromMe === true) return;

  const senderJid = info.RemoteJid || info.remoteJid || info.PushName;
  if (!senderJid) {
    console.log(\`[Webhook] Mensagem sem senderJid:\`, JSON.stringify(info));
    return;
  }

  // ✅ IGNORA GRUPOS (@g.us)
  if (senderJid.includes('@g.us')) {
    console.log(\`[Webhook] Mensagem de grupo ignorada: \${senderJid}\`);
    return;
  }

  console.log(\`[Webhook] Mensagem recebida de \${senderJid}\`);`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed webhook.js');
} else {
  console.log('Old string not found in webhook.js');
}
