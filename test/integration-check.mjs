import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = resolve(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const sourceFiles = walk(resolve(root, 'src')).filter(path => ['.js', '.mjs'].includes(extname(path)));
const sources = new Map(sourceFiles.map(path => [path, readFileSync(path, 'utf8')]));
const importMapText = html.match(/<script\b[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
const imports = importMapText ? JSON.parse(importMapText).imports ?? {} : {};

function checkLocal(from, specifier) {
  const clean = specifier.split(/[?#]/)[0];
  const target = resolve(dirname(from), clean);
  assert.ok(!relative(root, target).startsWith('..'), `Asset escapes project: ${specifier}`);
  assert.ok(existsSync(target), `${relative(root, from)} references missing ${specifier}`);
  assert.ok(statSync(target).isFile(), `${specifier} must resolve to a file`);
}

function mapSpecifier(specifier) {
  if (imports[specifier]) return imports[specifier];
  let best = null;
  for (const [key, value] of Object.entries(imports)) {
    if (key.endsWith('/') && specifier.startsWith(key) && (!best || key.length > best.key.length)) best = { key, value };
  }
  return best ? best.value + specifier.slice(best.key.length) : undefined;
}

test('every source import resolves locally or through the browser import map', () => {
  let count = 0;
  for (const [path, text] of sources) {
    const matcher = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
    for (const match of text.matchAll(matcher)) {
      const specifier = match[1];
      if (/^(https?:|data:|node:)/.test(specifier)) continue;
      count++;
      if (specifier.startsWith('.')) checkLocal(path, specifier);
      else {
        const mapped = mapSpecifier(specifier);
        assert.ok(mapped, `Unmapped browser import ${specifier} in ${relative(root, path)}`);
        if (!/^(https?:|data:)/.test(mapped)) checkLocal(resolve(root, 'index.html'), mapped);
      }
    }
  }
  assert.ok(count > 0, 'Expected browser module imports');
});

test('every model in the assets catalog exists on disk and stays inside the project', () => {
  const catalog = sources.get(resolve(root, 'src/assets.js')) ?? '';
  const urls = [...catalog.matchAll(/['"](assets\/models\/[^'"]+)['"]/g)].map(m => m[1]);
  assert.ok(urls.length >= 15, `Expected the full model catalog, found ${urls.length}`);
  for (const url of urls) checkLocal(resolve(root, 'index.html'), url);
});

test('local script, stylesheet and image entry assets are present', () => {
  for (const tag of html.matchAll(/<(?:script|link|img|source)\b[^>]*>/gi)) {
    const ref = tag[0].match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
    if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    checkLocal(resolve(root, 'index.html'), ref);
  }
});

test('literal DOM ids used by UI code have declarations in the application', () => {
  const allText = [html, ...sources.values()].join('\n');
  const declared = new Set([
    ...[...allText.matchAll(/\bid\s*=\s*["']([^"'$<>]+)["']/g)].map(match => match[1]),
    ...[...allText.matchAll(/\.id\s*=\s*["']([^"']+)["']/g)].map(match => match[1]),
  ]);
  for (const [path, text] of sources) {
    for (const match of text.matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)/g)) {
      assert.ok(declared.has(match[1]), `Undeclared DOM id "${match[1]}" in ${relative(root, path)}`);
    }
  }
});

test('upstream copyright and the vendored Three.js attribution remain included', () => {
  assert.match(readFileSync(resolve(root, 'LICENSE'), 'utf8'), /Weiping Yan/);
  assert.match(readFileSync(resolve(root, 'lib/three.module.js'), 'utf8'), /@license/);
});
