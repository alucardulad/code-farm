#!/usr/bin/env node
/**
 * 用无头 Chrome 给 README 重新拍预览图。
 *
 * 界面改过之后预览图就会过时，直接跑这个脚本重新出一套，
 * 不用手动开浏览器、手动摆姿势、手动截图。
 *
 * 用法：
 *   1) 另开一个终端起服务：npm run dev
 *   2) node tools/capture-preview.mjs
 *
 * 依赖只有本机 Chrome 和 Node 18+（用内置 fetch / WebSocket 走 CDP），
 * 不装任何 npm 包。输出固定 1680×913，文件名和 preview/ 里的现有图片一一对应。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'preview');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);
const VIEWPORT = { width: 1680, height: 913 };

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function findChrome() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) throw new Error('没找到 Chrome，可用 CHROME_PATH 环境变量指定浏览器路径。');
  return found;
}

/** 极简 CDP 客户端：发命令、等回包。 */
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
    });
  }

  /** 在页面里跑一段 JS，返回值走 JSON 序列化。 */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression: `(() => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? '页面脚本执行失败');
    }
    return result.result.value;
  }

  /** 轮询页面状态，直到表达式返回真值。 */
  async waitFor(expression, { timeout = 15000, interval = 40, label = expression } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.evaluate(`return Boolean(${expression});`)) return;
      await sleep(interval);
    }
    throw new Error(`等待超时：${label}`);
  }

  async shot(fileName) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const target = join(OUT_DIR, fileName);
    writeFileSync(target, Buffer.from(data, 'base64'));
    const kb = Math.round(Buffer.from(data, 'base64').length / 1024);
    console.log(`  📸 ${fileName}（${kb} KB）`);
  }
}

async function connect(port) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((item) => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* 浏览器还没起来，继续等 */
    }
    await sleep(200);
  }
  throw new Error('连不上 Chrome 的调试端口。');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), 'code-farm-shot-'));
  const chrome = spawn(findChrome(), [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-features=Translate',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await connect(CDP_PORT);
    const socket = new WebSocket(wsUrl);
    await new Promise((done, fail) => {
      socket.addEventListener('open', done, { once: true });
      socket.addEventListener('error', () => fail(new Error('调试连接建立失败')), { once: true });
    });

    const cdp = new Cdp(socket);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      ...VIEWPORT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log(`🌾 打开 ${BASE_URL}`);
    await cdp.send('Page.navigate', { url: BASE_URL });
    await cdp.waitFor('window.__farm && document.querySelector("#canvas")', { label: '游戏挂载完成' });
    await sleep(1200); // 等精灵图和首帧画完

    // 1) 第一关初始画面
    await cdp.evaluate('localStorage.clear(); return true;');
    await cdp.send('Page.reload');
    await cdp.waitFor('window.__farm && document.querySelector("#taskText")?.textContent', { label: '关卡载入' });
    await sleep(1200);
    await cdp.shot('01-第1关.png');

    // 2) 过关结算：真跑一遍第一关，让结算弹窗自己弹出来
    await cdp.evaluate(`
      window.__farm.editor.setValue('前进');
      document.querySelector('#runBtn').click();
      return true;
    `);
    await cdp.waitFor('document.querySelector(".modal-mask")', { label: '结算弹窗' });
    await sleep(600);
    await cdp.shot('02-过关结算.png');

    // 3) 麦田劳作：跳到第 8 关（翻土 → 播种 → 浇水），跑一半时抓拍
    const stars = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`level-${i + 1}`, 3]));
    await cdp.evaluate(`
      localStorage.setItem('code-farm-progress-v1', ${JSON.stringify(JSON.stringify({
        unlocked: 25,
        stars,
        code: {},
        heroKind: 'boy',
        free: null,
        freeCode: '',
        lastMode: 'levels',
      }))});
      return true;
    `);
    await cdp.send('Page.reload');
    await cdp.waitFor('window.__farm && document.querySelector("#canvas")', { label: '游戏挂载完成' });
    await sleep(800);
    await cdp.evaluate('document.querySelector(".dot-btn[data-index=\\"7\\"]").click(); return true;');
    await sleep(500);
    await cdp.evaluate(`
      window.__farm.editor.setValue('翻土\\n播种\\n浇水');
      document.querySelector('#runBtn').click();
      return true;
    `);
    await cdp.waitFor('window.__farm.state.world.actions >= 2', { label: '第二个动作' });
    await cdp.shot('03-麦田劳作.png');

    // 4) 丰收仙女提示：等这一轮跑完、清掉弹窗，再点「提示」展开抽屉
    await cdp.waitFor('!window.__farm.state.running', { label: '本轮运行结束' });
    await cdp.evaluate(`
      document.querySelector('.modal-mask')?.remove();
      document.querySelector('.dot-btn[data-index="7"]').click();
      return true;
    `);
    await sleep(500);
    await cdp.evaluate('document.querySelector("#hintBtn").click(); return true;');
    await cdp.waitFor('!document.querySelector("#hintDrawer").hidden', { label: '提示抽屉展开' });
    await sleep(700);
    await cdp.shot('04-丰收仙女提示.png');

    // 顺手报告关键元素的尺寸，方便判断有没有被裁掉
    const layout = await cdp.evaluate(`
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      return {
        视口: { w: innerWidth, h: innerHeight },
        任务卡: box('.task-card'),
        提示抽屉: box('#hintDrawer'),
        舞台: box('.stage'),
        代码面板: box('.code-panel'),
      };
    `);
    console.log('📐 版面：', JSON.stringify(layout, null, 0));
    socket.close();
  } finally {
    chrome.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('❌ 截图失败：', error.message);
  process.exitCode = 1;
});
