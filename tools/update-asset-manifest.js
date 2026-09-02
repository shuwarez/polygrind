'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceRoots = [path.join(root, 'index.html'), path.join(root, 'src')];
const mime = {'.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.woff2':'font/woff2'};
const references = new Set();

function scan(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) scan(path.join(target, entry));
    return;
  }
  if (!['.html','.css','.js'].includes(path.extname(target))) return;
  const source = fs.readFileSync(target, 'utf8');
  for (const match of source.matchAll(/(?:\.\.\/)*assets\/[A-Za-z0-9_./-]+\.(?:png|webp|ogg|woff2)/g)) {
    const reference = match[0];
    const absolute = reference.startsWith('assets/')
      ? path.resolve(root, reference)
      : path.resolve(path.dirname(target), reference);
    references.add(path.relative(root, absolute).replace(/\\/g, '/'));
  }
}

for (const target of sourceRoots) scan(target);
const assets = [...references].sort().map(relative => {
  const absolute = path.resolve(root, relative);
  if (!fs.existsSync(absolute)) throw new Error(`Missing referenced asset: ${relative}`);
  const data = fs.readFileSync(absolute);
  return {
    path: relative,
    mime: mime[path.extname(relative).toLowerCase()] || 'application/octet-stream',
    bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
  };
});

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  note: 'Generated from asset references in index.html and src/.',
  assets,
};
fs.writeFileSync(path.join(root, 'assets', 'manifest.json'), `${JSON.stringify(manifest,null,2)}\n`, 'utf8');
console.log(`Wrote assets/manifest.json with ${assets.length} referenced assets.`);
