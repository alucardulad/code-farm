#!/usr/bin/env node
/**
 * 打包成单文件 HTML。
 *
 * 把 CSS、全部 JS 模块、精灵图、仙女语音统统内联进一个 .html 里，
 * 双击就能玩：不用起服务器、不用 npm install、不用联网。
 * （音效和背景音乐来自本机统一素材库、不随包分发，这份单文件版会自动
 *   退回 WebAudio 合成音，玩法一点不受影响。）
 *
 * 用法：node tools/build-single.mjs
 * 产物：dist/code-farm-v<版本>.html
 *
 * 文件名保持 ASCII：GitHub Release 上传附件时会把中文名吞掉。
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'src/game.js';
const ASSET_ROOT = join(ROOT, 'src', 'assets');
const OUT_DIR = join(ROOT, 'dist');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const OUT_FILE = join(OUT_DIR, `code-farm-v${pkg.version}.html`);

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const read = (absPath) => readFileSync(absPath, 'utf8');

// ---------------------------------------------------------------- 模块图

const graph = new Map();

function resolveId(fromId, spec) {
  const target = resolve(ROOT, dirname(fromId), spec);
  return relative(ROOT, target).split('\\').join('/');
}

function collect(id, trail = []) {
  if (graph.has(id)) return graph.get(id);
  if (trail.includes(id)) {
    throw new Error(`发现循环依赖：${[...trail, id].join(' → ')}，单文件打包需要先拆掉它。`);
  }

  const raw = read(join(ROOT, id));
  const deps = [];
  let code = raw;

  // import { a, b } from './x.js';
  code = code.replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?[ \t]*$/gm, (_, names, spec) => {
    const dep = resolveId(id, spec);
    deps.push(dep);
    const bindings = names.split(',').map((name) => name.trim()).filter(Boolean).join(', ');
    return `const { ${bindings} } = __require(${JSON.stringify(dep)});`;
  });

  // export const / function / async function / class
  const exported = [];
  code = code.replace(/^export\s+(async\s+function|function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });

  if (/^\s*export\s/m.test(code)) throw new Error(`${id} 里还有没处理的 export 写法。`);
  if (/^\s*import\s/m.test(code)) throw new Error(`${id} 里还有没处理的 import 写法。`);

  for (const dep of deps) collect(dep, [...trail, id]);

  const entry = { id, code, exported };
  graph.set(id, entry);
  return entry;
}

collect(ENTRY);

// ---------------------------------------------------------------- 素材内联

const assets = {};
function walkAssets(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      walkAssets(abs);
      continue;
    }
    const rel = relative(ASSET_ROOT, abs).split('\\').join('/');
    const mime = MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream';
    assets[rel] = `data:${mime};base64,${readFileSync(abs).toString('base64')}`;
  }
}
walkAssets(ASSET_ROOT);

// ---------------------------------------------------------------- 改写 import.meta 资源引用

function rewriteAssets(code, id) {
  let out = code;

  out = out.replace(/new URL\('\.\.\/assets\/([^']+)', import\.meta\.url\)\.href/g, (_, rel) => {
    if (!(rel in assets)) throw new Error(`${id} 引用了不存在的素材：${rel}`);
    return `__asset(${JSON.stringify(rel)})`;
  });

  out = out.replace(
    /new URL\(line\.file, TUTOR_VOICE_BASE\)\.href/g,
    () => '__asset("voice/" + line.file)',
  );
  out = out.replace(
    /const TUTOR_VOICE_BASE = new URL\('\.\.\/assets\/voice\/', import\.meta\.url\);/g,
    () => 'const TUTOR_VOICE_BASE = null; // 单文件版：语音走 __asset("voice/…")',
  );

  if (out.includes('import.meta')) throw new Error(`${id} 里还有没改写的 import.meta 引用。`);
  return out;
}

// ---------------------------------------------------------------- 拼装

const runtime = `const __ASSETS = ${JSON.stringify(assets)};
const __modules = Object.create(null);
const __cache = Object.create(null);
function __asset(rel) {
  const url = __ASSETS[rel];
  if (!url) throw new Error('少了素材：' + rel);
  return url;
}
function __define(id, factory) { __modules[id] = factory; }
function __require(id) {
  if (__cache[id]) return __cache[id];
  const target = __modules[id];
  if (!target) throw new Error('找不到模块：' + id);
  const exported = {};
  __cache[id] = exported;
  target(exported);
  return exported;
}`;

const moduleChunks = [...graph.values()].map(({ id, code, exported }) => {
  const body = rewriteAssets(code, id);
  const assign = exported.length
    ? `\nObject.assign(__exports, { ${exported.join(', ')} });`
    : '';
  return `__define(${JSON.stringify(id)}, function (__exports) {\n${body}${assign}\n});`;
});

const bundle = [runtime, ...moduleChunks, `__require(${JSON.stringify(ENTRY)});`].join('\n\n');

const css = read(join(ROOT, 'src', 'ui', 'styles.css'));
const shell = read(join(ROOT, 'index.html'));

const linkTag = '<link rel="stylesheet" href="/src/ui/styles.css" />';
const scriptTag = '<script type="module" src="/src/game.js"></script>';
if (!shell.includes(linkTag) || !shell.includes(scriptTag)) {
  throw new Error('index.html 结构和打包脚本对不上，先看下标签有没有改过。');
}

// 注意：替换内容一律用函数返回。字符串里出现 $' / $& 之类会被 String.replace
// 当成特殊替换模式，之前就把 '</body></html>' 注进过 JS 里。
const html = shell
  .replace(linkTag, () => `<style>\n${css}\n</style>`)
  .replace(scriptTag, () => `<script type="module">\n${bundle}\n</script>`)
  .replace('</head>', () => `  <!-- 单文件版 · 麦田小课堂 v${pkg.version} · 双击本文件即可开始 -->\n  </head>`);

// 自检：打包结果拼不出合法 JS 就直接报错，别等到浏览器里才发现白屏。
try {
  // eslint-disable-next-line no-new-func
  new Function(bundle);
} catch (error) {
  throw new Error(`打包出来的脚本有语法错误：${error.message}`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, html);

const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`✅ 打包完成：${relative(ROOT, OUT_FILE)}`);
console.log(`   模块 ${graph.size} 个 · 素材 ${Object.keys(assets).length} 个 · 共 ${mb} MB`);
