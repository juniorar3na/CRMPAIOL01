const fs = require('fs');
const path = 'e:/CRM vetpaiol/backend/.env';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/BACKEND_WEBHOOK_URL=".+"/, 'BACKEND_WEBHOOK_URL="https://better-jeans-joke.loca.lt/webhook"');
fs.writeFileSync(path, content, 'utf8');
console.log('Updated .env');
