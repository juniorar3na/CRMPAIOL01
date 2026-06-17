const fs = require('fs');
const path = 'e:/CRM vetpaiol/backend/src/handlers/webhook.js';
let content = fs.readFileSync(path, 'utf8');

const oldStr = `  try {
    if (message.Conversation) {
      // Mensagem de texto simples
      textContent = message.Conversation;
    } else if (message.ExtendedTextMessage) {
      // Mensagem de texto com preview de link
      textContent = message.ExtendedTextMessage.Text;
    } else if (message.ImageMessage) {
      // Imagem: faz download via WUZAPI
      console.log(\`[Webhook] Baixando imagem...\`);
      const downloaded = await downloadImage(instance.api_token, {
        Url: message.ImageMessage.Url,
        DirectPath: message.ImageMessage.DirectPath,
        MediaKey: message.ImageMessage.MediaKey,
        Mimetype: message.ImageMessage.Mimetype,
        FileEncSha256: message.ImageMessage.FileEncSha256,
        FileSha256: message.ImageMessage.FileSha256,
        FileLength: message.ImageMessage.FileLength,
      });
      imageBase64 = downloaded?.data?.Data;
      textContent = message.ImageMessage.Caption || null;
    } else if (message.AudioMessage || message.PTT) {
      // Áudio de voz (PTT = Push To Talk = mensagem de voz)
      const audioMsg = message.AudioMessage || message.PTT;
      console.log(\`[Webhook] Baixando áudio...\`);
      const downloaded = await downloadAudio(instance.api_token, {
        Url: audioMsg.Url,
        DirectPath: audioMsg.DirectPath,
        MediaKey: audioMsg.MediaKey,
        Mimetype: audioMsg.Mimetype,
        FileEncSha256: audioMsg.FileEncSha256,
        FileSha256: audioMsg.FileSha256,
        FileLength: audioMsg.FileLength,
      });
      audioBase64 = downloaded?.data?.Data;
    } else {
      console.log(\`[Webhook] Tipo de mensagem não suportado. Ignorando.\`);
      return;
    }`;

const newStr = `  try {
    const isText = message.Conversation || message.conversation;
    const isExtended = message.ExtendedTextMessage || message.extendedTextMessage;
    const isImage = message.ImageMessage || message.imageMessage;
    const isAudio = message.AudioMessage || message.audioMessage || message.PTT || message.ptt;

    if (isText) {
      // Mensagem de texto simples
      textContent = isText;
    } else if (isExtended) {
      // Mensagem de texto com preview de link/menção
      textContent = isExtended.Text || isExtended.text;
    } else if (isImage) {
      // Imagem: faz download via WUZAPI
      console.log(\`[Webhook] Baixando imagem...\`);
      const downloaded = await downloadImage(instance.api_token, {
        Url: isImage.Url || isImage.url,
        DirectPath: isImage.DirectPath || isImage.directPath,
        MediaKey: isImage.MediaKey || isImage.mediaKey,
        Mimetype: isImage.Mimetype || isImage.mimetype,
        FileEncSha256: isImage.FileEncSha256 || isImage.fileEncSha256,
        FileSha256: isImage.FileSha256 || isImage.fileSha256,
        FileLength: isImage.FileLength || isImage.fileLength,
      });
      imageBase64 = downloaded?.data?.Data || downloaded?.data?.data || downloaded?.Data || downloaded?.data;
      textContent = isImage.Caption || isImage.caption || null;
    } else if (isAudio) {
      // Áudio de voz (PTT = Push To Talk = mensagem de voz)
      console.log(\`[Webhook] Baixando áudio...\`);
      const downloaded = await downloadAudio(instance.api_token, {
        Url: isAudio.Url || isAudio.url,
        DirectPath: isAudio.DirectPath || isAudio.directPath,
        MediaKey: isAudio.MediaKey || isAudio.mediaKey,
        Mimetype: isAudio.Mimetype || isAudio.mimetype,
        FileEncSha256: isAudio.FileEncSha256 || isAudio.fileEncSha256,
        FileSha256: isAudio.FileSha256 || isAudio.fileSha256,
        FileLength: isAudio.FileLength || isAudio.fileLength,
      });
      audioBase64 = downloaded?.data?.Data || downloaded?.data?.data || downloaded?.Data || downloaded?.data;
    } else {
      console.log(\`[Webhook] Tipo de mensagem não suportado. Ignorando.\`, JSON.stringify(message));
      return;
    }`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed message keys');
} else {
  console.log('Old string not found in webhook.js');
}
