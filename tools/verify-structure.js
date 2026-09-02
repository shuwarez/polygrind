'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexFile = path.join(root, 'index.html');
const index = fs.readFileSync(indexFile, 'utf8');
const errors = [];

function relativeFiles(directory, extensions) {
  const result = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, {withFileTypes:true})) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (!extensions || extensions.includes(path.extname(entry.name).toLowerCase())) result.push(absolute);
    }
  };
  visit(path.join(root, directory));
  return result;
}

const scripts = [...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(x=>x[1]);
const styles = [...index.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(x=>x[1]);
if (index.length > 50_000) errors.push(`index.html is too large: ${index.length} bytes`);
for (const block of index.matchAll(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
  if (!/\bsrc=/i.test(block[2]) && block[3].trim().length > 500) {
    errors.push(`large inline ${block[1]} block found in index.html`);
  }
}
if (/data:[^,]+;base64,/i.test(index)) errors.push('base64 data URI found in index.html');
if (scripts.length < 2) errors.push('structured script list is missing');
if (styles.length < 2) errors.push('structured stylesheet list is missing');

for (const reference of [...scripts, ...styles]) {
  if (!fs.existsSync(path.resolve(root, reference))) errors.push(`missing linked file: ${reference}`);
}

const sourceFiles = [...relativeFiles('src', ['.js','.css']), indexFile];
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (/data:(?:image|audio|font)\/[^,]+;base64,/i.test(source)) {
    errors.push(`embedded binary found: ${path.relative(root,file)}`);
  }
  for (const match of source.matchAll(/(?:\.\.\/)*assets\/[A-Za-z0-9_./-]+\.(?:png|webp|ogg|woff2)/g)) {
    const reference = match[0];
    const absolute = reference.startsWith('assets/')
      ? path.resolve(root, reference)
      : path.resolve(path.dirname(file), reference);
    if (!fs.existsSync(absolute)) errors.push(`missing asset from ${path.relative(root,file)}: ${reference}`);
  }
}

const manifestFile = path.join(root, 'assets', 'manifest.json');
let manifestPaths = new Set();
if (!fs.existsSync(manifestFile)) errors.push('assets/manifest.json is missing');
else {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const listedPaths = (manifest.assets || []).map(asset=>asset.path.replace(/\\/g,'/'));
  manifestPaths = new Set(listedPaths);
  if (manifestPaths.size !== listedPaths.length) errors.push('duplicate path found in assets/manifest.json');
  for (const asset of manifest.assets || []) {
    if (!fs.existsSync(path.resolve(root, asset.path))) errors.push(`manifest asset missing: ${asset.path}`);
  }
}

const assetFiles = relativeFiles('assets').filter(file=>path.basename(file)!=='manifest.json');
for (const file of assetFiles) {
  const relative = path.relative(root,file).replace(/\\/g,'/');
  if (!manifestPaths.has(relative)) errors.push(`unreferenced asset is not allowed: ${relative}`);
}

if (errors.length) {
  console.error(`Structure check failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const assetBytes = assetFiles.reduce((sum,file)=>sum+fs.statSync(file).size,0);
console.log(`Structure OK: index ${index.length} B, ${scripts.length} JS, ${styles.length} CSS, ${assetFiles.length} assets (${(assetBytes/1048576).toFixed(2)} MiB).`);
