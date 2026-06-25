const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('dashboard.html', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
dom.window.addEventListener('error', (e) => {
  console.error('Caught error:', e.error);
});
setTimeout(() => {
  console.log('Done test');
}, 500);
