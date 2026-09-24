/**
 * 界面装配层：把编辑器、指令面板、任务卡、农场画面和运行流程拼在一起。
 * 这里只处理「怎么显示、怎么交互」，玩法规则全在 core/ 里。
 */

import { LEVELS, CHAPTERS, chapterOf, levelsOfChapter, FREE_MODE } from '../core/levels.js';
import { createWorld, checkGoal, exportWorld, restoreWorld, countChickens } from '../core/world.js';
import { runProgram } from '../core/runner.js';
import { paintFrame } from '../core/render.js';
import { FarmAnimator } from '../core/engine.js';
import { AudioManager } from '../core/audio.js';
import { loadSprites } from '../core/sprites.js';
import { TUTOR_NAME, getTutorLine } from '../core/tutor-lines.js';
import { createEditor } from './editor.js';
import { MUSIC_CREDITS, SFX_CREDITS, FREESOUND_URL } from '../core/credits.js';

const STORAGE_KEY = 'code-farm-progress-v1';

/** 指令面板：按章节逐步解锁。 */
const PALETTE = [
  { chapter: 1, label: '前进 1', insert: '前进 1' },
  { chapter: 1, label: '前进 N', insert: '前进 3' },
  { chapter: 1, label: '后退 N', insert: '后退 1' },
  { chapter: 1, label: '左转', insert: '左转' },
  { chapter: 1, label: '右转', insert: '右转' },
  { chapter: 1, label: '翻土', insert: '翻土' },
  { chapter: 1, label: '播种', insert: '播种' },
  { chapter: 1, label: '浇水', insert: '浇水' },
  { chapter: 1, label: '等待一天', insert: '等待一天' },
  { chapter: 1, label: '收获', insert: '收获' },
  { chapter: 2, label: '重复 N 次 { }', insert: '重复 3 次 {\n  \n}' },
  { chapter: 3, label: '如果 脚下是草地 { }', insert: '如果 脚下是草地 {\n  \n}' },
  { chapter: 3, label: '如果 脚下是泥土 { }', insert: '如果 脚下是泥土 {\n  \n}' },
  { chapter: 3, label: '如果 脚下有幼苗 { }', insert: '如果 脚下有幼苗 {\n  \n}' },
  { chapter: 3, label: '如果 脚下是成熟小麦 { }', insert: '如果 脚下是成熟小麦 {\n  \n}' },
  { chapter: 1, label: '喂鸡', insert: '喂鸡', free: true },
  { chapter: 1, label: '收鸡蛋', insert: '收鸡蛋', free: true },
];

const SOUND = new AudioManager();
const TUTOR_IMAGE_URL = new URL('../assets/tutor-fairy.png', import.meta.url).href;
const TUTOR_VOICE_BASE = new URL('../assets/voice/', import.meta.url);

export function mountApp(root) {
  root.className = 'app';
  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="logo">🌾</span>麦田小课堂</div>
      <div class="level-chip" id="levelChip">第 1 关</div>
      <div class="resources" id="resources"></div>
      <button class="icon-btn" id="heroBtn" title="切换小农夫形象">👦 男孩</button>
      <button class="icon-btn" id="musicBtn" title="开关背景音乐">🎵 音乐</button>
      <button class="icon-btn" id="creditBtn" title="查看音乐与音效来源">🎧 素材</button>
    </header>

    <div class="main">
      <section class="panel code-panel">
        <div class="panel-head">
          <span>📜 中文代码</span>
          <span class="sub" id="chapterLabel"></span>
        </div>
        <div class="editor-host" id="editorHost"></div>
        <div class="palette">
          <div class="palette-title">指令口袋（点一下写进代码）</div>
          <div class="chips" id="palette"></div>
        </div>
        <div class="actions">
          <button class="btn primary" id="runBtn">▶ 运行</button>
          <button class="btn ghost" id="resetBtn">↺ 重置</button>
          <button class="btn ghost" id="hintBtn">? 提示</button>
          <button class="btn ghost" id="answerBtn">看答案</button>
        </div>
      </section>

      <section class="panel stage-wrap">
        <div class="stage" id="stage">
          <canvas id="canvas"></canvas>
          <div class="task-card">
            <div class="tc-head">🎯 <span id="taskName"></span></div>
            <div class="tc-body">
              <div id="taskText"></div>
              <div class="goal-line"><span class="dot"></span><span id="goalText"></span></div>
            </div>
          </div>
          <div class="hint-drawer" id="hintDrawer" hidden></div>
          <div class="tutor-dock" id="tutorDock">
            <div class="tutor-avatar-wrap">
              <img class="tutor-avatar" src="${TUTOR_IMAGE_URL}" alt="牧场丰收仙女穗穗">
              <div class="tutor-name">
                <span>${TUTOR_NAME}</span>
                <button class="tutor-voice-btn" id="tutorVoiceBtn" title="重播穗穗的指导" aria-label="重播穗穗的指导">🔊</button>
              </div>
            </div>
            <div class="bubble" id="bubble" aria-live="polite"></div>
          </div>
        </div>
        <div class="levelbar" id="levelbar"></div>
      </section>
    </div>
  `;

  const els = {
    levelChip: root.querySelector('#levelChip'),
    chapterLabel: root.querySelector('#chapterLabel'),
    resources: root.querySelector('#resources'),
    palette: root.querySelector('#palette'),
    runBtn: root.querySelector('#runBtn'),
    resetBtn: root.querySelector('#resetBtn'),
    hintBtn: root.querySelector('#hintBtn'),
    answerBtn: root.querySelector('#answerBtn'),
    taskName: root.querySelector('#taskName'),
    taskText: root.querySelector('#taskText'),
    goalText: root.querySelector('#goalText'),
    bubble: root.querySelector('#bubble'),
    tutorDock: root.querySelector('#tutorDock'),
    tutorVoiceBtn: root.querySelector('#tutorVoiceBtn'),
    hintDrawer: root.querySelector('#hintDrawer'),
    levelbar: root.querySelector('#levelbar'),
    stage: root.querySelector('#stage'),
    canvas: root.querySelector('#canvas'),
    heroBtn: root.querySelector('#heroBtn'),
    musicBtn: root.querySelector('#musicBtn'),
    creditBtn: root.querySelector('#creditBtn'),
  };

  const state = {
    index: 0,
    mode: 'levels',
    world: null,
    animator: null,
    running: false,
    heroKind: 'boy',
    voiceKey: null,
    layout: { tile: 48, ox: 0, oy: 0 },
    progress: loadProgress(),
    lastRes: {},
  };

  const editor = createEditor(root.querySelector('#editorHost'), {
    onChange: (value) => {
      if (state.mode === 'free') state.progress.freeCode = value;
      else state.progress.code[level().id] = value;
      saveProgress(state.progress);
    },
    onSubmit: () => run(),
  });

  const ctx = els.canvas.getContext('2d');
  const tutorVoice = new Audio();
  tutorVoice.preload = 'auto';
  tutorVoice.volume = 0.96;
  loadSprites();

  tutorVoice.addEventListener('play', () => {
    els.tutorDock.classList.add('speaking');
    SOUND.setDucked(true);
  });
  tutorVoice.addEventListener('ended', stopTutorVoice);
  tutorVoice.addEventListener('pause', stopTutorVoice);
  tutorVoice.addEventListener('error', stopTutorVoice);

  /** 前两章用轻快的尤克里里，后两章换成温和钢琴，避免听腻。 */
  const musicForChapter = () => (chapterNumber(level()) <= 2 ? 'farm' : 'calm');

  // 浏览器要求先有用户操作才能播声音。
  const unlockAudio = () => {
    SOUND.unlock();
    SOUND.playMusic(musicForChapter());
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // ---------------------------------------------------------------- 存档

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          unlocked: parsed.unlocked ?? 0,
          stars: parsed.stars ?? {},
          code: parsed.code ?? {},
          heroKind: parsed.heroKind === 'girl' ? 'girl' : 'boy',
          free: parsed.free ?? null,
          freeCode: parsed.freeCode ?? '',
          lastMode: parsed.lastMode === 'free' ? 'free' : 'levels',
        };
      }
    } catch (error) {
      console.warn('进度读取失败，重新开始。', error);
    }
    return { unlocked: 0, stars: {}, code: {}, heroKind: 'boy', free: null, freeCode: '', lastMode: 'levels' };
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.warn('进度保存失败。', error);
    }
  }

  const level = () => (state.mode === 'free' ? FREE_MODE : LEVELS[state.index]);
  const chapterNumber = (levelDef) => (levelDef.mode === 'free' ? 5 : Number(levelDef.chapter.replace('ch', '')));
  const isFreeUnlocked = () => LEVELS.every((def) => (state.progress.stars[def.id] ?? 0) > 0);

  function createAnimator(world) {
    const animator = new FarmAnimator(world, SOUND);
    animator.heroKind = state.heroKind;
    animator.heroX = world.hero.x;
    animator.heroY = world.hero.y;
    return animator;
  }

  function saveFreeWorld() {
    state.progress.free = exportWorld(state.world);
    state.progress.freeCode = editor.value;
    state.progress.lastMode = 'free';
    saveProgress(state.progress);
  }

  // ---------------------------------------------------------------- 关卡装载

  function loadLevel(index, { keepCode = true } = {}) {
    state.mode = 'levels';
    state.index = Math.max(0, Math.min(LEVELS.length - 1, index));
    const def = level();

    state.world = createWorld(def);
    state.animator = createAnimator(state.world);

    const saved = state.progress.code[def.id];
    editor.setValue(keepCode && saved !== undefined ? saved : def.starter);
    editor.clearMarks();

    els.taskName.textContent = def.name;
    els.taskText.textContent = def.objective;
    els.chapterLabel.textContent = `${chapterOf(def).name} · ${def.subtitle}`;
    els.hintDrawer.hidden = true;
    els.hintDrawer.innerHTML = renderHints(def);
    els.resetBtn.textContent = '↺ 重置';
    els.answerBtn.hidden = false;
    els.tutorVoiceBtn.hidden = false;
    document.body.classList.remove('free-mode');
    state.voiceKey = def.id;
    stopTutorVoice();

    renderPalette();
    renderLevelBar();
    resize();
    renderHUD();
    setBubble(def.objective, 'info');
    SOUND.playMusic(musicForChapter());
    state.progress.lastMode = 'levels';
    saveProgress(state.progress);
  }

  function enterFreeMode({ focusEditor = false } = {}) {
    if (!isFreeUnlocked()) {
      setBubble('完成全部 26 关后，就能解锁自由农场。', 'warn');
      SOUND.play('blocked');
      return;
    }

    state.mode = 'free';
    const def = FREE_MODE;
    state.world = restoreWorld(def, state.progress.free);
    state.animator = createAnimator(state.world);

    editor.setValue(state.progress.freeCode || def.starter);
    editor.clearMarks();
    els.taskName.textContent = def.name;
    els.taskText.textContent = def.objective;
    els.chapterLabel.textContent = '第 5 章 · 自由经营';
    els.hintDrawer.hidden = true;
    els.hintDrawer.innerHTML = renderHints(def);
    els.resetBtn.textContent = '↺ 重置农场';
    els.answerBtn.hidden = true;
    els.tutorVoiceBtn.hidden = true;
    document.body.classList.add('free-mode');
    state.voiceKey = 'free';

    renderPalette();
    renderLevelBar();
    resize();
    renderHUD();
    setBubble('自由农场已经开张。种小麦、收稻草、喂鸡，再等一天收鸡蛋吧！', 'success');
    SOUND.playMusic('farm');
    saveFreeWorld();
    if (focusEditor) editor.focus();
  }

  function renderHints(def) {
    const items = def.hints.map((hint) => `<li>${hint}</li>`).join('');
    return `<h4>💡 卡住了看这里</h4><ul>${items}</ul>`;
  }

  function renderPalette() {
    const freeMode = state.mode === 'free';
    const ch = chapterNumber(level());
    els.palette.innerHTML = PALETTE.map((item) => {
      if (item.free && !freeMode) return '';
      const locked = !freeMode && item.chapter > ch;
      const isNew = freeMode
        ? Boolean(item.free)
        : (level().newCommands ?? []).some((cmd) => item.label.startsWith(cmd.split(' ')[0]) && item.chapter === ch) && item.chapter === ch;
      const cls = ['chip', locked ? 'locked' : '', isNew ? 'new' : ''].filter(Boolean).join(' ');
      const title = locked ? `第 ${item.chapter} 章解锁` : '点击插入到代码里';
      return `<button class="${cls}" data-insert="${encodeURIComponent(item.insert)}" data-locked="${locked}" title="${title}">${item.label}</button>`;
    }).join('');

    els.palette.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (chip.dataset.locked === 'true') {
          const needChapter = PALETTE.find((item) => item.label === chip.textContent)?.chapter ?? 2;
          setBubble(`这个指令要到第 ${needChapter} 章才会解锁，先用手上的指令试试。`, 'warn');
          SOUND.play('blocked');
          return;
        }
        SOUND.play('click');
        editor.insert(decodeURIComponent(chip.dataset.insert));
      });
    });
  }

  function renderLevelBar() {
    const freeUnlocked = isFreeUnlocked();
    const chapterHtml = CHAPTERS.map((chapter) => {
      const dots = levelsOfChapter(chapter.id).map((def) => {
        const index = LEVELS.indexOf(def);
        const unlocked = index <= state.progress.unlocked;
        const stars = state.progress.stars[def.id] ?? 0;
        const cls = ['dot-btn', unlocked ? '' : 'locked', state.mode === 'levels' && index === state.index ? 'current' : ''].filter(Boolean).join(' ');
        const starMark = stars > 0 ? `<span class="mini-stars">${'★'.repeat(stars)}</span>` : '';
        return `<button class="${cls}" data-index="${index}" title="${def.name}">${index + 1}${starMark}</button>`;
      }).join('');
      return `<span class="chapter-label">${chapter.name}</span><div class="level-dots">${dots}</div>`;
    }).join('');
    const freeCls = [
      'dot-btn',
      'free-entry',
      freeUnlocked ? '' : 'locked',
      state.mode === 'free' ? 'current' : '',
    ].filter(Boolean).join(' ');
    const freeHtml = `
      <span class="chapter-label">通关奖励</span>
      <div class="level-dots">
        <button class="${freeCls}" data-free="true" title="${freeUnlocked ? '进入自由农场' : '完成全部 26 关后解锁'}">🐔 自由</button>
      </div>`;

    els.levelbar.innerHTML = chapterHtml + freeHtml;
    els.levelbar.querySelectorAll('.dot-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.free === 'true') {
          if (isFreeUnlocked()) SOUND.play('click');
          enterFreeMode();
          return;
        }
        const index = Number(btn.dataset.index);
        if (index > state.progress.unlocked) {
          setBubble('这一关还没解锁，先把前面的关卡完成吧。', 'warn');
          SOUND.play('blocked');
          return;
        }
        SOUND.play('click');
        state.index = index;
        loadLevel(index);
      });
    });
  }

  // ---------------------------------------------------------------- HUD

  function renderHUD() {
    const world = state.world;
    const def = level();

    els.levelChip.textContent = def.name;

    const stars = Object.values(state.progress.stars).reduce((sum, n) => sum + n, 0);
    const items = state.mode === 'free' ? [
      { key: 'coins', icon: '🪙', label: '金币', value: world.coins },
      { key: 'wheat', icon: '🌾', label: '小麦', value: world.wheat },
      { key: 'straw', icon: '🧺', label: '稻草', value: world.straw },
      { key: 'eggs', icon: '🥚', label: '鸡蛋', value: world.eggs },
      { key: 'pendingEggs', icon: '🏠', label: '鸡舍蛋', value: world.pendingEggs },
      { key: 'chickens', icon: '🐔', label: '鸡', value: countChickens(world) },
      { key: 'seeds', icon: '🌱', label: '种子', value: world.seeds },
      { key: 'day', icon: '☀️', label: '第', value: `${world.day} 天` },
    ] : [
      { key: 'coins', icon: '🪙', label: '金币', value: world.coins },
      { key: 'wheat', icon: '🌾', label: '小麦', value: world.wheat },
      { key: 'eggs', icon: '🥚', label: '鸡蛋', value: world.eggs },
      { key: 'milk', icon: '🥛', label: '牛奶', value: world.milk },
      { key: 'seeds', icon: '🌱', label: '种子', value: world.seeds },
      { key: 'day', icon: '☀️', label: '第', value: `${world.day} 天` },
      { key: 'stars', icon: '⭐', label: '星星', value: stars },
    ];

    els.resources.innerHTML = items.map((item) => {
      const bump = state.lastRes[item.key] !== undefined && state.lastRes[item.key] !== item.value ? ' bump' : '';
      return `<div class="res${bump}"><span class="icon">${item.icon}</span>${item.label} ${item.value}</div>`;
    }).join('');
    state.lastRes = Object.fromEntries(items.map((item) => [item.key, item.value]));

    if (state.mode === 'free') {
      const chickens = countChickens(world);
      if (world.pendingEggs > 0) {
        els.goalText.textContent = `鸡舍里有 ${world.pendingEggs} 枚鸡蛋，走到鸡舍旁收起来`;
      } else if ((world.fedChickens ?? 0) > 0) {
        els.goalText.textContent = '鸡已经喂饱，写「等待一天」让它们下蛋';
      } else if (world.straw < chickens) {
        els.goalText.textContent = '稻草不够了，收获小麦可以拿稻草';
      } else {
        els.goalText.textContent = `第 ${world.day} 天 · 农场正在等你安排农活`;
      }
    } else {
      const goal = checkGoal(world);
      els.goalText.textContent = goal.text || '把这一关完成';
    }
  }

  function setBubble(message, kind = 'info') {
    els.bubble.textContent = message;
    els.bubble.className = `bubble ${kind}`;
  }

  function speakTutor(key) {
    const fallback = getTutorLine(level().id);
    const line = getTutorLine(key) ?? fallback;
    if (!line) return;
    state.voiceKey = getTutorLine(key) ? key : level().id;
    tutorVoice.pause();
    tutorVoice.currentTime = 0;
    tutorVoice.src = new URL(line.file, TUTOR_VOICE_BASE).href;
    tutorVoice.play().catch(() => {});
  }

  function stopTutorVoice() {
    els.tutorDock.classList.remove('speaking');
    SOUND.setDucked(state.running);
  }

  function renderHeroToggle() {
    const boy = state.heroKind !== 'girl';
    els.heroBtn.textContent = boy ? '👦 男孩' : '👧 女孩';
    els.heroBtn.title = `当前是${boy ? '男' : '女'}小农夫，点击切换`;
  }

  // ---------------------------------------------------------------- 画面

  function resize() {
    const world = state.world;
    const rect = els.stage.getBoundingClientRect();
    const maxW = Math.max(240, rect.width - 48);
    const maxH = Math.max(200, rect.height - 48);
    const tile = Math.max(28, Math.min(88, Math.floor(Math.min(maxW / world.width, maxH / world.height))));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = world.width * tile;
    const cssH = world.height * tile;

    els.canvas.width = Math.floor(cssW * dpr);
    els.canvas.height = Math.floor(cssH * dpr);
    els.canvas.style.width = `${cssW}px`;
    els.canvas.style.height = `${cssH}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    state.layout = { tile, ox: 0, oy: 0 };
  }

  let rafId = 0;
  function loop(now) {
    state.animator.update(now);
    paintFrame(ctx, state.world, state.layout, state.animator);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  const observer = new ResizeObserver(() => resize());
  observer.observe(els.stage);

  // ---------------------------------------------------------------- 运行

  function resetCurrentLevel({ focusEditor = false } = {}) {
    const def = level();
    if (state.mode === 'free' && !window.confirm('确定重置整个自由农场吗？土地、资源和天数都会重新开始。')) return;
    state.world = createWorld(def);
    state.animator = createAnimator(state.world);
    editor.clearMarks();
    setBubble(def.objective, 'info');
    if (state.mode === 'free') saveFreeWorld();
    renderHUD();
    if (focusEditor) editor.focus();
  }

  function setRunning(running) {
    state.running = running;
    els.runBtn.disabled = running;
    els.runBtn.textContent = running ? '⏳ 运行中…' : '▶ 运行';
  }

  async function run() {
    if (state.running) return;
    SOUND.unlock();

    // 关卡每次从干净世界运行；自由农场则把每次运行接在现有进度后面。
    if (state.mode !== 'free') {
      state.world = createWorld(level());
      state.animator = createAnimator(state.world);
    }

    editor.clearMarks();
    setRunning(true);
    SOUND.setDucked(true);
    setBubble('小农夫开始干活了…', 'info');
    renderHUD();

    let hudTick = 0;
    const result = await runProgram(state.world, editor.value, {
      onActiveLine: (line) => editor.setActiveLine(line),
      onAction: async ({ events, world }) => {
        await state.animator.play(events);
        hudTick += 1;
        if (state.mode === 'free' || hudTick % 2 === 0) renderHUD();
      },
    });

    renderHUD();
    setRunning(false);
    SOUND.setDucked(false);

    if (state.mode === 'free') {
      saveFreeWorld();
      if (result.ok) {
        SOUND.play('coin');
        setBubble(state.world.message, state.world.messageKind === 'warn' ? 'warn' : 'success');
      } else {
        if (state.world.lastError) editor.setErrorLine(state.world.lastError.line);
        SOUND.play('error');
        setBubble(state.world.message, state.world.messageKind === 'warn' ? 'warn' : 'error');
      }
      return;
    }

    if (result.ok) {
      SOUND.play('win');
      const stars = result.stars ?? 1;
      const def = level();
      setBubble(`完成啦！用了 ${state.world.actions} 步动作。`, 'success');
      state.progress.stars[def.id] = Math.max(state.progress.stars[def.id] ?? 0, stars);
      state.progress.unlocked = Math.max(state.progress.unlocked, Math.min(state.index + 1, LEVELS.length - 1));
      saveProgress(state.progress);
      renderHUD();
      renderLevelBar();
      showWinModal(stars);
      return;
    }

    if (state.world.lastError) {
      editor.setErrorLine(state.world.lastError.line);
    }
    SOUND.play('error');
    setBubble(state.world.message, state.world.messageKind === 'warn' ? 'warn' : 'error');
    speakTutor(result.reason === 'empty' ? 'empty' : 'check');
  }

  // ---------------------------------------------------------------- 弹窗

  function showWinModal(stars) {
    const def = level();
    const hasNext = state.index < LEVELS.length - 1;
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <h2>🎉 过关啦！</h2>
        <div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <p>「${def.name}」完成，用了 <b>${state.world.actions}</b> 步动作（三星线 ${def.par} 步）。<br>
        农场现在有 🪙 ${state.world.coins} 金币、🌾 ${state.world.wheat} 小麦。<br>
        ${hasNext ? '' : '全部课程完成，自由农场已经解锁！'}</p>
        <div class="actions">
          ${hasNext ? '<button class="btn primary" id="nextBtn">下一关 ▶</button>' : '<button class="btn primary" id="nextBtn">🐔 开始自由经营</button>'}
          <button class="btn ghost" id="replayBtn">再玩一次</button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);

    mask.querySelector('#replayBtn').addEventListener('click', () => {
      SOUND.play('click');
      mask.remove();
      resetCurrentLevel({ focusEditor: true });
    });
    mask.querySelector('#nextBtn').addEventListener('click', () => {
      SOUND.play('click');
      mask.remove();
      if (state.index < LEVELS.length - 1) {
        loadLevel(state.index + 1, { keepCode: false });
      } else {
        enterFreeMode({ focusEditor: true });
      }
    });
  }

  // ---------------------------------------------------------------- 按钮

  els.runBtn.addEventListener('click', () => {
    SOUND.play('click');
    run();
  });

  els.resetBtn.addEventListener('click', () => {
    SOUND.play('click');
    resetCurrentLevel();
  });

  els.hintBtn.addEventListener('click', () => {
    SOUND.play('click');
    const opening = els.hintDrawer.hidden;
    els.hintDrawer.hidden = !opening;
    if (opening) {
      setBubble(`穗穗提示：${level().hints[0] ?? level().objective}`, 'info');
      speakTutor(level().id);
    } else {
      stopTutorVoice();
    }
  });

  els.creditBtn.addEventListener('click', () => {
    SOUND.play('click');
    showCreditsModal();
  });

  els.musicBtn.addEventListener('click', () => {
    const on = SOUND.toggleMusic();
    els.musicBtn.textContent = on ? '🎵 音乐' : '🔇 音乐';
    els.musicBtn.classList.toggle('off', !on);
    if (on) SOUND.play('click');
  });

  els.heroBtn.addEventListener('click', () => {
    SOUND.play('click');
    state.heroKind = state.heroKind === 'girl' ? 'boy' : 'girl';
    state.animator.heroKind = state.heroKind;
    state.progress.heroKind = state.heroKind;
    saveProgress(state.progress);
    renderHeroToggle();
    setBubble(`已经换成${state.heroKind === 'girl' ? '女孩' : '男孩'}小农夫。`, 'info');
  });

  // 农场里偶尔来一声鸡叫或牛叫，画面就不会太安静。
  setInterval(() => {
    if (state.running || !SOUND.musicEnabled) return;
    const kinds = state.world.animals.map((animal) => animal.kind);
    if (kinds.length === 0) return;
    const pick = kinds[Math.floor(Math.random() * kinds.length)];
    SOUND.play(pick === 'chicken' ? 'chicken' : 'cow');
  }, 17000);

  els.answerBtn.addEventListener('click', () => {
    SOUND.play('click');
    editor.setValue(level().solution);
    setBubble('这是参考解。看懂以后，试着自己写一遍吧！', 'warn');
    speakTutor('answer');
  });

  els.tutorVoiceBtn.addEventListener('click', () => {
    SOUND.play('click');
    if (!tutorVoice.paused && !tutorVoice.ended) {
      tutorVoice.pause();
      return;
    }
    speakTutor(state.voiceKey ?? level().id);
  });

  function showCreditsModal() {
    const music = MUSIC_CREDITS.map((item) => `
      <li>
        <b>${item.title}</b> — ${item.author}（${item.license}，${item.note}）<br>
        <a href="${item.source}" target="_blank" rel="noreferrer">${item.source}</a>
      </li>`).join('');

    const sfx = SFX_CREDITS.map((item) => `
      <li>${item.note}：${item.name} — ${item.author}（${item.license}）
        <a href="${FREESOUND_URL(item.id)}" target="_blank" rel="noreferrer">来源</a>
      </li>`).join('');

    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal credits-modal">
        <h2>🎧 音乐与音效</h2>
        <p>全部素材来自本机统一素材库，与有声项目共用。</p>
        <div class="credit-scroll">
          <h4>背景音乐（需署名）</h4>
          <ul>${music}</ul>
          <h4>音效（CC0，免署名，仍在此致谢）</h4>
          <ul>${sfx}</ul>
        </div>
        <div class="actions"><button class="btn primary" id="closeCredits">知道啦</button></div>
      </div>
    `;
    document.body.appendChild(mask);
    mask.querySelector('#closeCredits').addEventListener('click', () => {
      SOUND.play('click');
      mask.remove();
    });
    mask.addEventListener('click', (event) => {
      if (event.target === mask) mask.remove();
    });
  }

  // 方便调试查看运行状态（不影响游戏）。
  window.__farm = { SOUND, state, editor, level, tutorVoice, speakTutor, enterFreeMode };

  // 首次进入从第一关开始；已经通关并离开自由农场时，下次继续经营。
  state.heroKind = state.progress.heroKind === 'girl' ? 'girl' : 'boy';
  renderHeroToggle();
  if (isFreeUnlocked() && state.progress.lastMode === 'free') enterFreeMode();
  else loadLevel(Math.min(state.progress.unlocked, LEVELS.length - 1), { keepCode: true });

  return { destroy: () => cancelAnimationFrame(rafId) };
}
