const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf8');

// Replace the misformatted rule with the correct one
const target = "\\}?\\s*--font:\\s*'PMingLiU', 'MingLiU', '新細明體', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;";
css = css.replace(new RegExp(target, 'g'), "  --font: 'PMingLiU', 'MingLiU', '新細明體', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\n}");

fs.writeFileSync('css/style.css', css);
