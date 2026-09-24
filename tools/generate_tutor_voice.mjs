#!/usr/bin/env node
/**
 * 用本机原神 Bert-VITS2 为丰收仙女预生成提示语音。
 *
 * 第一次运行会加载本地模型，随后一次进程内批量合成，不会逐条重复加载。
 * 生成的 mp3 放在 src/assets/voice/，游戏运行时直接读取，不需要联网。
 */

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUTOR_LINES, TUTOR_VOICE } from '../src/core/tutor-lines.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'assets', 'voice');
const TTS_DIR = '/Users/alucardulad/Documents/ChatGPT/语音合成';
const TTS_PYTHON = process.env.TTS_PYTHON ?? '/Users/alucardulad/style-bert-vits2-mcp/venv/bin/python';
const TTS_SERVER = process.env.TTS_SERVER ?? join(TTS_DIR, 'tts_server.py');
const force = process.argv.includes('--force');
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);

mkdirSync(OUT_DIR, { recursive: true });

const entries = Object.entries(TUTOR_LINES)
  .filter(([key]) => !only || key === only)
  .filter(([, line]) => force || (readFileSyncSafe(join(OUT_DIR, line.file))?.length ?? 0) < 4096);

if (entries.length === 0) {
  console.log('提示语音已经齐全，无需重新生成。');
  process.exit(0);
}

const requests = entries.map(([key, line], index) => JSON.stringify({
  jsonrpc: '2.0',
  id: index + 1,
  method: 'tools/call',
  params: {
    name: 'tts_speak',
    arguments: {
      text: line.text,
      speaker: TUTOR_VOICE.speaker,
      speed: TUTOR_VOICE.speed,
      language: TUTOR_VOICE.language,
    },
  },
})).join('\n') + '\n';

const child = spawn(TTS_PYTHON, [TTS_SERVER], {
  cwd: TTS_DIR,
  env: { ...process.env },
  stdio: ['pipe', 'pipe', 'ignore'],
});

let stdout = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => { stdout += chunk; });
child.stdin.end(requests);

const exitCode = await new Promise((resolveExit) => {
  child.on('close', (code) => resolveExit(code));
});
if (exitCode !== 0) throw new Error(`TTS 服务退出码 ${exitCode}`);

const responses = new Map();
for (const row of stdout.trim().split(/\r?\n/)) {
  if (!row.trim()) continue;
  const response = JSON.parse(row);
  responses.set(Number(response.id), response);
}

for (let i = 0; i < entries.length; i += 1) {
  const [key, line] = entries[i];
  const response = responses.get(i + 1);
  const payload = response?.result?.content?.[0]?.text ?? '';
  const match = /\[OK\]\s+(.+?\.wav)\s+\|/.exec(payload);
  if (!match) throw new Error(`${key} 配音失败：${payload || '没有返回结果'}`);

  const wav = match[1];
  const mp3 = join(OUT_DIR, line.file);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', wav,
    '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k',
    mp3,
  ]);
  rmSync(wav, { force: true });
  console.log(`✓ ${key} → ${line.file}`);
}

console.log(`完成：${entries.length} 条提示语音，音色 ${TUTOR_VOICE.speaker}。`);

function readFileSyncSafe(path) {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}
