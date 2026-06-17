const fs = require('fs');
const path = 'e:/CRM vetpaiol/backend/src/lib/wuzapi.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/Events: \['Message'\],/, "Events: ['Message', 'message', 'All'],");
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed Events in wuzapi.js');
