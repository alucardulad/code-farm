/**
 * 零依赖静态服务器：node tools/dev-server.mjs 即可本地试玩。
 *
 * 除了项目文件，还会把本机统一素材库映射成两个只读路径：
 *   /media/sfx/*    → ~/Documents/ChatGPT/语音合成/音效库
 *   /media/music/*  → ~/Documents/ChatGPT/语音合成/音乐库
 * 这样游戏和有声项目共用同一份素材，不在项目里另建音效目录。
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT ?? 5173);
const MEDIA_HOME = join(homedir(), 'Documents', 'ChatGPT', '语音合成');

const MEDIA_ROUTES = [
  { prefix: '/media/sfx/', dir: join(MEDIA_HOME, '音效库') },
  { prefix: '/media/music/', dir: join(MEDIA_HOME, '音乐库') },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
};

/** 只允许读取素材库目录下的文件，挡住 ../ 穿越。 */
function resolveMedia(pathname) {
  for (const route of MEDIA_ROUTES) {
    if (!pathname.startsWith(route.prefix)) continue;
    const name = decodeURIComponent(pathname.slice(route.prefix.length));
    const target = resolve(route.dir, name);
    if (!target.startsWith(resolve(route.dir))) return null;
    return target;
  }
  return null;
}

/** 音频要用 Range 才能拖动播放，这里做最简实现。 */
function sendAudio(req, res, filePath, info) {
  const type = TYPES[extname(filePath)] ?? 'application/octet-stream';
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Accept-Ranges': 'bytes' });
    createReadStream(filePath).pipe(res);
    return;
  }
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = match?.[2] ? Number(match[2]) : info.size - 1;
  if (Number.isNaN(start) || start >= info.size) {
    res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
    res.end();
    return;
  }
  res.writeHead(206, {
    'Content-Type': type,
    'Content-Range': `bytes ${start}-${end}/${info.size}`,
    'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes',
  });
  createReadStream(filePath, { start, end }).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    // 统一素材库
    const mediaPath = resolveMedia(pathname);
    if (mediaPath) {
      const info = await stat(mediaPath).catch(() => null);
      if (!info || !info.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('素材库里没有这个文件');
        return;
      }
      sendAudio(req, res, mediaPath, info);
      return;
    }

    // 项目文件
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(ROOT, safePath);
    const info = await stat(filePath).catch(() => null);
    if (!info || info.isDirectory()) filePath = join(ROOT, 'index.html');

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 找不到这个文件');
  }
});

server.listen(PORT, () => {
  console.log(`🌾 麦田小课堂已经开张：http://localhost:${PORT}`);
  console.log(`   音效库：${join(MEDIA_HOME, '音效库')}`);
});
