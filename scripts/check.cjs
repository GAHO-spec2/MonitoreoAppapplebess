const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
for (const file of fs.readdirSync(path.join(root, 'js'))) {
  if (file.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(root, 'js', file), 'utf8'), { filename: file });
}
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)) {
    const resource = match[1];
    if (/^(?:https?:|data:|mailto:)/.test(resource)) continue;
    if (!fs.existsSync(path.join(root, resource))) throw new Error(`${file}: recurso faltante ${resource}`);
  }
  if (file !== 'index.html') {
    const order = ['js/firebase.js', 'js/common.js', 'js/monitoreo.js', 'js/auth.js'];
    if (!order.every((file, i) => html.includes(file) && (!i || html.indexOf(file) > html.indexOf(order[i - 1])))) {
      throw new Error(`${file}: orden de scripts incorrecto`);
    }
  }
}
console.log('Sintaxis JavaScript, recursos locales y orden de carga correctos.');
