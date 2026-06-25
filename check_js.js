const fs = require('fs');
const html = fs.readFileSync('dashboard.html', 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
fs.writeFileSync('extracted.js', script);
