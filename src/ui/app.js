/**
 * 界面装配层：把编辑器、指令面板、任务卡、农场画面和运行流程拼在一起。
 * 这里只处理「怎么显示、怎么交互」，玩法规则全在 core/ 里。
 */

import { LEVELS, CHAPTERS, chapterOf, levelsOfChapter, FREE_MODE } from '../core/levels.js';
import {
  createWorld, checkGoal, exportWorld, restoreWorld,
  countChickens, countCows, readyCowsNear, countHungryChickens, countHungryCows,
  isNearMarket, hasEnoughStraw, MARKET_PRICES,
} from '../core/world.js';
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
  { chapter: 5, label: '如果 奶牛可以挤奶 { }', insert: '如果 奶牛可以挤奶 {\n  \n}' },
  { chapter: 5, label: '如果 鸡舍里有鸡蛋 { }', insert: '如果 鸡舍里有鸡蛋 {\n  \n}' },
  { chapter: 7, label: '如果 稻草足够 { }', insert: '如果 稻草足够 {\n  \n}' },
  { chapter: 8, label: '重复直到…{ }', insert: '重复直到 前方是成熟小麦 {\n  \n}' },
  { chapter: 8, label: '重复直到 到旗子了', insert: '重复直到 到旗子了 {\n  前进\n}' },
  { chapter: 7, label: '卖出', insert: '卖出' },
  { chapter: 7, label: '买种子', insert: '买种子' },
  { chapter: 7, label: '买稻草', insert: '买稻草' },
  { chapter: 7, label: '买鸡', insert: '买鸡' },
  { chapter: 7, label: '买牛', insert: '买牛' },
  { chapter: 6, label: '否则 { }', insert: '否则 {\n  \n}' },
  { chapter: 6, label: '如果…否则… 模板', insert: '如果 脚下是成熟小麦 {\n  收获\n}\n否则 {\n  翻土\n}' },
  { chapter: 4, label: '喂鸡', insert: '喂鸡' },
  { chapter: 4, label: '收鸡蛋', insert: '收鸡蛋' },
  { chapter: 4, label: '喂牛', insert: '喂牛' },
  { chapter: 4, label: '挤奶', insert: '挤奶' },
];

const SOUND = new AudioManager();
const TUTOR_IMAGE_URL = new URL('../assets/tutor-fairy.png', import.meta.url).href;
const TUTOR_VOICE_BASE = new URL('../assets/voice/', import.meta.url);
const HERO_BOY_IMAGE_URL = new URL('../assets/hero-boy.png', import.meta.url).href;
const HERO_GIRL_IMAGE_URL = new URL('../assets/hero-girl.png', import.meta.url).href;

export function mountApp(root) {
  root.className = 'app';
  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="logo">🌾</span>麦田小课堂</div>
      <div class="level-chip" id="levelChip">第 1 关</div>
      <div class="player-chip" id="playerChip">👦 小农夫</div>
      <div class="resources" id="resources"></div>
      <button class="icon-btn" id="modeBtn" title="切换教学模式和自由模式">🧭 模式</button>
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

    <div class="mode-gate" id="modeGate" hidden>
      <section class="mode-dialog" role="dialog" aria-modal="true" aria-labelledby="modeTitle">
        <div class="mode-brand"><span>🌾</span> 麦田小课堂</div>
        <div class="onboarding-progress" aria-label="开篇流程">
          <span class="onboarding-dot" data-step="opening"></span>
          <span class="onboarding-dot" data-step="profile"></span>
          <span class="onboarding-dot" data-step="mode"></span>
        </div>

        <div class="onboarding-step opening-step" id="openingStep">
          <p class="opening-kicker">🌱 一片会听懂中文代码的农田</p>
          <h2>麦田小课堂</h2>
          <p class="opening-lead">写下简单的农活指令，让小农夫替你翻土、播种、浇水、收获，<br>再去喂鸡、喂牛、收鸡蛋、挤牛奶，把整座农场经营起来。</p>
          <div class="opening-features">
            <span>🧱 顺序</span>
            <span>🔁 重复</span>
            <span>🧭 判断</span>
            <span>🌾 种地</span>
            <span>🐔 养鸡</span>
            <span>🐄 牧牛</span>
          </div>
          <button class="btn primary onboarding-primary" id="openingStartBtn" type="button">开始旅程 ▶</button>
          <p class="onboarding-tip">下一站：创建你的小农夫</p>
        </div>

        <div class="onboarding-step profile-step" id="profileStep" hidden>
          <h2>创建你的小农夫</h2>
          <p class="mode-lead">选择男孩或女孩，再写下一个名字。这个名字会显示在游戏顶栏。</p>
          <div class="gender-options" role="group" aria-label="选择小农夫性别">
            <button class="gender-choice" id="boyChoice" data-hero="boy" type="button">
              <span class="gender-portrait" style="--hero-image: url('${HERO_BOY_IMAGE_URL}')"></span>
              <strong>男孩</strong>
            </button>
            <button class="gender-choice" id="girlChoice" data-hero="girl" type="button">
              <span class="gender-portrait" style="--hero-image: url('${HERO_GIRL_IMAGE_URL}')"></span>
              <strong>女孩</strong>
            </button>
          </div>
          <label class="name-field" for="playerNameInput">
            <span>人物姓名</span>
            <input id="playerNameInput" name="playerName" type="text" maxlength="8" autocomplete="off"
              placeholder="例如：小明" aria-describedby="nameHint">
          </label>
          <p class="name-hint" id="nameHint">最多 8 个字，可以随时回来修改。</p>
          <div class="onboarding-actions">
            <button class="btn ghost" id="profileBackBtn" type="button">← 上一步</button>
            <button class="btn primary" id="profileContinueBtn" type="button" disabled>下一步：选择模式 ▶</button>
          </div>
        </div>

        <div class="onboarding-step mode-step" id="modeStep" hidden>
          <h2 id="modeTitle">选择你的玩法</h2>
          <p class="mode-lead" id="modeGreeting">两种模式各有独立进度，随时都能从右上角的「模式」按钮回来切换。</p>
          <div class="mode-options">
            <button class="mode-card teach-mode" id="teachModeBtn" type="button">
              <span class="mode-card-head">
                <span class="mode-icon">📚</span>
                <strong>教学模式</strong>
                <span class="mode-badge" id="teachLastBadge" hidden>上次选择</span>
              </span>
              <span class="mode-description" id="teachModeDesc">从第 1 关开始学习中文代码</span>
              <span class="mode-foot">32 关 · 顺序 / 重复 / 判断 / 牧场</span>
            </button>
            <button class="mode-card free-mode" id="freeModeBtn" type="button">
              <span class="mode-card-head">
                <span class="mode-icon">🐔</span>
                <strong>自由模式</strong>
                <span class="mode-badge" id="freeLastBadge" hidden>上次选择</span>
              </span>
              <span class="mode-description" id="freeModeDesc">无需通关，直接开始种田、养鸡、牧牛</span>
              <span class="mode-foot">种植 · 喂鸡喂牛 · 收蛋挤奶</span>
            </button>
          </div>
          <button class="profile-edit-btn" id="editProfileBtn" type="button">👦👧 修改角色和姓名</button>
        </div>
      </section>
    </div>
  `;

  const els = {
    levelChip: root.querySelector('#levelChip'),
    playerChip: root.querySelector('#playerChip'),
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
    modeBtn: root.querySelector('#modeBtn'),
    heroBtn: root.querySelector('#heroBtn'),
    musicBtn: root.querySelector('#musicBtn'),
    creditBtn: root.querySelector('#creditBtn'),
    modeGate: root.querySelector('#modeGate'),
    teachModeBtn: root.querySelector('#teachModeBtn'),
    freeModeBtn: root.querySelector('#freeModeBtn'),
    teachModeDesc: root.querySelector('#teachModeDesc'),
    freeModeDesc: root.querySelector('#freeModeDesc'),
    teachLastBadge: root.querySelector('#teachLastBadge'),
    freeLastBadge: root.querySelector('#freeLastBadge'),
    onboardingDots: root.querySelectorAll('.onboarding-dot'),
    openingStep: root.querySelector('#openingStep'),
    profileStep: root.querySelector('#profileStep'),
    modeStep: root.querySelector('#modeStep'),
    openingStartBtn: root.querySelector('#openingStartBtn'),
    profileBackBtn: root.querySelector('#profileBackBtn'),
    profileContinueBtn: root.querySelector('#profileContinueBtn'),
    playerNameInput: root.querySelector('#playerNameInput'),
    boyChoice: root.querySelector('#boyChoice'),
    girlChoice: root.querySelector('#girlChoice'),
    modeGreeting: root.querySelector('#modeGreeting'),
    editProfileBtn: root.querySelector('#editProfileBtn'),
  };

  const state = {
    index: 0,
    mode: 'levels',
    world: null,
    animator: null,
    running: false,
    heroKind: 'boy',
    chapterView: 'ch1',
    profileReturnStep: 'opening',
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

  /** 全场统一一首背景音乐，不随章节切换，孩子不会因为换曲分心。 */
  const THEME_MUSIC = 'farm';

  // 浏览器要求先有用户操作才能播声音。
  const unlockAudio = () => {
    SOUND.unlock();
    SOUND.playMusic(THEME_MUSIC);
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
          playerName: typeof parsed.playerName === 'string' ? parsed.playerName : '',
          free: parsed.free ?? null,
          freeCode: parsed.freeCode ?? '',
          lastMode: parsed.lastMode === 'free' ? 'free' : 'levels',
        };
      }
    } catch (error) {
      console.warn('进度读取失败，重新开始。', error);
    }
    return {
      unlocked: 0,
      stars: {},
      code: {},
      heroKind: 'boy',
      playerName: '',
      free: null,
      freeCode: '',
      lastMode: 'levels',
    };
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.warn('进度保存失败。', error);
    }
  }

  const level = () => (state.mode === 'free' ? FREE_MODE : LEVELS[state.index]);
  // 自由模式排在最后一章之后，指令口袋里的东西全部解锁。
  const chapterNumber = (levelDef) => (levelDef.mode === 'free' ? 9 : Number(levelDef.chapter.replace('ch', '')));
  const resumeLevelIndex = () => Math.min(state.progress.unlocked, LEVELS.length - 1);

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

  function setOnboardingStep(step) {
    const steps = {
      opening: els.openingStep,
      profile: els.profileStep,
      mode: els.modeStep,
    };
    const order = ['opening', 'profile', 'mode'];
    const activeIndex = order.indexOf(step);
    for (const [name, element] of Object.entries(steps)) element.hidden = name !== step;
    els.onboardingDots.forEach((dot) => {
      const index = order.indexOf(dot.dataset.step);
      dot.classList.toggle('active', index === activeIndex);
      dot.classList.toggle('done', index < activeIndex);
    });
  }

  function updateGenderChoices() {
    const boy = state.heroKind !== 'girl';
    els.boyChoice.classList.toggle('selected', boy);
    els.girlChoice.classList.toggle('selected', !boy);
    els.boyChoice.setAttribute('aria-pressed', String(boy));
    els.girlChoice.setAttribute('aria-pressed', String(!boy));
  }

  function updateProfileContinue() {
    els.profileContinueBtn.disabled = els.playerNameInput.value.trim().length === 0;
  }

  function showOpening() {
    els.modeGate.hidden = false;
    setOnboardingStep('opening');
  }

  function showProfile({ returnTo = 'opening' } = {}) {
    state.profileReturnStep = returnTo;
    els.playerNameInput.value = state.progress.playerName || '';
    els.profileBackBtn.textContent = returnTo === 'mode' ? '← 返回模式' : '← 上一步';
    updateGenderChoices();
    updateProfileContinue();
    els.modeGate.hidden = false;
    setOnboardingStep('profile');
    window.setTimeout(() => els.playerNameInput.focus(), 80);
  }

  function showModeGate() {
    const completed = LEVELS.filter((def) => (state.progress.stars[def.id] ?? 0) > 0).length;
    const stars = Object.values(state.progress.stars).reduce((sum, value) => sum + value, 0);
    if (completed === LEVELS.length) {
      els.teachModeDesc.textContent = `32 关已全部完成 · 已获得 ${stars} 颗星`;
    } else if (completed === 0) {
      els.teachModeDesc.textContent = '从第 1 关开始，学习中文代码指令';
    } else {
      els.teachModeDesc.textContent = `继续第 ${resumeLevelIndex() + 1} 关 · 已通过 ${completed} 关`;
    }

    const saved = state.progress.free;
    if (saved) {
      const chickens = Array.isArray(saved.animals)
        ? saved.animals.filter((animal) => animal.kind === 'chicken').length
        : 0;
      els.freeModeDesc.textContent = `继续第 ${saved.day ?? 1} 天 · ${chickens} 只鸡 · ${saved.pendingEggs ?? 0} 枚待收蛋`;
    } else {
      els.freeModeDesc.textContent = '无需通关，直接开始种田、养鸡、牧牛';
    }

    const playerName = state.progress.playerName || '小农夫';
    els.modeGreeting.textContent = `${playerName}，选择这次想玩的模式吧。两种模式各有独立进度，右上角的「模式」按钮可以随时切换。`;
    els.teachLastBadge.hidden = state.progress.lastMode !== 'levels';
    els.freeLastBadge.hidden = state.progress.lastMode !== 'free';
    els.modeGate.hidden = false;
    setOnboardingStep('mode');
  }

  function saveProfile() {
    const playerName = els.playerNameInput.value.trim();
    if (!playerName) return;
    state.progress.playerName = playerName;
    state.progress.heroKind = state.heroKind;
    saveProgress(state.progress);
    if (state.animator) state.animator.heroKind = state.heroKind;
    renderHeroToggle();
    showModeGate();
  }

  function chooseMode(mode) {
    els.modeGate.hidden = true;
    if (mode === 'free') {
      if (state.mode !== 'free') enterFreeMode();
      return;
    }
    if (state.mode !== 'levels') loadLevel(resumeLevelIndex(), { keepCode: true });
  }

  // ---------------------------------------------------------------- 关卡装载

  function loadLevel(index, { keepCode = true } = {}) {
    state.mode = 'levels';
    state.index = Math.max(0, Math.min(LEVELS.length - 1, index));
    const def = level();
    state.chapterView = def.chapter;

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
    SOUND.playMusic(THEME_MUSIC);
    state.progress.lastMode = 'levels';
    saveProgress(state.progress);
  }

  function enterFreeMode({ focusEditor = false } = {}) {
    state.mode = 'free';
    const def = FREE_MODE;
    state.world = restoreWorld(def, state.progress.free);
    state.animator = createAnimator(state.world);

    editor.setValue(state.progress.freeCode || def.starter);
    editor.clearMarks();
    els.taskName.textContent = def.name;
    els.taskText.textContent = def.objective;
    els.chapterLabel.textContent = '第 9 章 · 自由经营';
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
    setBubble('自由农场已经开张。种小麦换稻草，用稻草喂鸡喂牛，收鸡蛋、挤牛奶，慢慢把农场做大吧！', 'success');
    SOUND.playMusic(THEME_MUSIC);
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
    const fresh = level().newCommands ?? [];
    els.palette.innerHTML = PALETTE.map((item) => {
      const locked = !freeMode && item.chapter > ch;
      const isNew = fresh.some((cmd) => item.label.startsWith(cmd.split(' ')[0])) && item.chapter === ch;
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

  /** 关卡条：先选章节，再选这一章里的关卡，36 关也不会挤成一条。 */
  function renderLevelBar() {
    // 自由模式没有关卡概念，只留「回到关卡」和「自由农场」，不让圆点挤占空间。
    if (state.mode === 'free') {
      els.levelbar.innerHTML = `
        <button class="dot-btn back-to-levels" id="backToLevels" title="回到教学关卡">📚 回到关卡</button>
        <button class="dot-btn free-entry current" data-free="true" title="你正在自由农场">🐔 自由农场</button>`;
      els.levelbar.querySelector('#backToLevels').addEventListener('click', () => {
        SOUND.play('click');
        loadLevel(Math.min(state.progress.unlocked, LEVELS.length - 1));
      });
      return;
    }

    const activeChapter = level().chapter;
    const tabs = CHAPTERS.map((chapter) => {
      const defs = levelsOfChapter(chapter.id);
      const cleared = defs.filter((def) => (state.progress.stars[def.id] ?? 0) > 0).length;
      const opened = defs.some((def) => LEVELS.indexOf(def) <= state.progress.unlocked);
      const cls = [
        'chapter-tab',
        chapter.id === activeChapter ? 'current' : '',
        cleared === defs.length ? 'cleared' : '',
        opened ? '' : 'locked',
      ].filter(Boolean).join(' ');
      const range = `${LEVELS.indexOf(defs[0]) + 1}~${LEVELS.indexOf(defs[defs.length - 1]) + 1}`;
      return `<button class="${cls}" data-chapter="${chapter.id}" title="${chapter.goal}">
        <span class="ct-name">${chapter.name}</span>
        <span class="ct-meta">${range} 关 · 已过 ${cleared}/${defs.length}</span>
      </button>`;
    }).join('');

    const shown = CHAPTERS.find((chapter) => chapter.id === activeChapter) ?? CHAPTERS[0];
    const dots = levelsOfChapter(shown.id).map((def) => {
      const index = LEVELS.indexOf(def);
      const unlocked = index <= state.progress.unlocked;
      const stars = state.progress.stars[def.id] ?? 0;
      const cls = ['dot-btn', unlocked ? '' : 'locked', state.mode === 'levels' && index === state.index ? 'current' : ''].filter(Boolean).join(' ');
      const starMark = stars > 0 ? `<span class="mini-stars">${'★'.repeat(stars)}</span>` : '';
      return `<button class="${cls}" data-index="${index}" title="${def.name}">${index + 1}${starMark}</button>`;
    }).join('');

    const freeCls = ['dot-btn', 'free-entry', state.mode === 'free' ? 'current' : ''].filter(Boolean).join(' ');
    els.levelbar.innerHTML = `
      <div class="chapter-tabs" role="tablist">${tabs}</div>
      <div class="level-dots" id="levelDots">${dots}</div>
      <button class="${freeCls}" data-free="true" title="进入自由农场">🐔 自由农场</button>`;

    els.levelbar.querySelectorAll('.chapter-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const defs = levelsOfChapter(tab.dataset.chapter);
        const firstUnlocked = defs.find((def) => LEVELS.indexOf(def) <= state.progress.unlocked);
        if (!firstUnlocked) {
          setBubble(`${tab.querySelector('.ct-name').textContent}还没解锁，先把前面的关卡完成吧。`, 'warn');
          SOUND.play('blocked');
          return;
        }
        SOUND.play('click');
        state.chapterView = tab.dataset.chapter;
        // 点的是当前这一章就只翻页；换章则跳到那一章第一关能玩的位置。
        if (state.mode === 'levels' && defs[0].chapter === level().chapter) renderLevelBar();
        else loadLevel(LEVELS.indexOf(firstUnlocked));
      });
    });

    els.levelbar.querySelectorAll('.dot-btn, .free-entry').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.free === 'true') {
          SOUND.play('click');
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
      { key: 'milk', icon: '🥛', label: '牛奶', value: world.milk },
      { key: 'pendingEggs', icon: '🏠', label: '鸡舍蛋', value: world.pendingEggs },
      { key: 'hungryChickens', icon: '🐔', label: '鸡', value: `${countHungryChickens(world)}/${countChickens(world)}` },
      { key: 'cows', icon: '🐄', label: '牛', value: `${countHungryCows(world)}/${countCows(world)}` },
      { key: 'readyCows', icon: '🥛', label: '可挤', value: world.animals.filter((a) => a.kind === 'cow' && a.milkReady !== false).length },
      { key: 'seeds', icon: '🌱', label: '种子', value: world.seeds },
      { key: 'day', icon: '☀️', label: '第', value: `${world.day} 天` },
      { key: 'sellable', icon: '🏪', label: '可卖', value: (world.eggs ?? 0) + (world.milk ?? 0) + (world.wheat ?? 0) },
    ] : [
      { key: 'coins', icon: '🪙', label: '金币', value: world.coins },
      { key: 'wheat', icon: '🌾', label: '小麦', value: world.wheat },
      { key: 'straw', icon: '🧺', label: '稻草', value: world.straw },
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
      els.goalText.textContent = freeTaskHint(world);
    } else {
      const goal = checkGoal(world);
      els.goalText.textContent = goal.text || '把这一关完成';
    }
  }

  /** 经营账本：抽出一组可以对比的经营数字。 */
  function snapshotLedger(world) {
    return {
      harvested: world.harvested ?? 0,
      till: world.tilled ?? 0,
      plant: world.planted ?? 0,
      eggs: world.eggs ?? 0,
      milk: world.milk ?? 0,
      wheat: world.wheat ?? 0,
      coins: world.coins ?? 0,
      day: world.day ?? 1,
    };
  }

  /** 算这一轮干活的增量。 */
  function diffLedger(before, world) {
    const after = snapshotLedger(world);
    return {
      harvest: after.harvested - before.harvested,
      eggs: after.eggs - before.eggs,
      milk: after.milk - before.milk,
      coins: after.coins - before.coins,
      days: after.day - before.day,
      total: after,
    };
  }

  /** 把一轮经营的成果拼成一句人话。 */
  function buildDayReport(ledger, world) {
    const gains = [];
    if (ledger.harvest > 0) gains.push(`收获 ${ledger.harvest} 株小麦`);
    if (ledger.eggs > 0) gains.push(`收到 ${ledger.eggs} 枚鸡蛋`);
    if (ledger.milk > 0) gains.push(`挤了 ${ledger.milk} 瓶牛奶`);

    const tail = `账本：🌾 ${world.wheat} 小麦 · 🥚 ${world.eggs} 鸡蛋 · 🥛 ${world.milk} 牛奶 · 🪙 ${world.coins} 金币`;
    if (gains.length === 0) return `这一轮没添新收成。${tail}`;
    return `这一轮${gains.join('、')}。${tail}`;
  }

  /** 自由模式每日农活清单：按最要紧的事给一句提示。 */
  function freeTaskHint(world) {
    const chickens = countChickens(world);
    const cows = countCows(world);
    const hungryChickens = countHungryChickens(world);
    const hungryCows = countHungryCows(world);
    const ready = readyCowsNear(world).length;
    const day = `第 ${world.day} 天`;

    if (world.pendingEggs > 0) {
      return `${day} · 鸡舍里有 ${world.pendingEggs} 枚鸡蛋，走到鸡舍旁收起来`;
    }
    if (ready > 0) {
      return `${day} · 身边有 ${ready} 头奶牛可以挤奶，写「挤奶」`;
    }

    const sellable = (world.eggs ?? 0) + (world.milk ?? 0) + (world.wheat ?? 0);
    const strawShort = !hasEnoughStraw(world) && (hungryChickens + hungryCows) > 0;
    const canAffordStraw = world.coins >= MARKET_PRICES.strawCost;

    const wantsFeed = hungryChickens + hungryCows;
    if (wantsFeed > 0 && world.straw >= wantsFeed) {
      const parts = [];
      if (hungryChickens > 0) parts.push(`${hungryChickens} 只鸡`);
      if (hungryCows > 0) parts.push(`${hungryCows} 头牛`);
      return `${day} · ${parts.join('、')}还没喂，稻草够用，走过去写「喂鸡 / 喂牛」`;
    }
    // 有小麦可收就先收，没收的就先种 —— 提示要说玩家下一步真能做的事。
    const wheatReady = world.tiles.some((row) => row.includes('wheat'));
    const strawPlan = wheatReady ? '先收获小麦' : '先种小麦，收了就有稻草';

    if (wantsFeed > 0 && strawShort && canAffordStraw) {
      return `${day} · 有 ${world.coins} 金币，走到集市旁写「买稻草」，再回来喂饱动物`;
    }
    if (wantsFeed > 0 && world.straw > 0) {
      return `${day} · 稻草只剩 ${world.straw} 捆，还不够喂饱所有动物，${strawPlan}`;
    }
    if (wantsFeed > 0) {
      return `${day} · 动物还饿着，稻草用完了，${strawPlan}`;
    }
    if (sellable > 0) {
      return `${day} · 背包里有 ${sellable} 件农产品，走到集市旁写「卖出」换金币`;
    }
    if (chickens > 0 || cows > 0) {
      return `${day} · 动物都喂饱了，写「等待一天」让鸡下蛋、牛产奶`;
    }
    return `${day} · 农场正在等你安排农活`;
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
    els.playerChip.textContent = `${boy ? '👦' : '👧'} ${state.progress.playerName || '小农夫'}`;
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

    // 自由农场：记下这一轮开始前的账本，跑完算一份「当日结算」。
    const before = state.mode === 'free' ? snapshotLedger(state.world) : null;

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
        const ledger = diffLedger(before, state.world);
        state.lastLedger = ledger;
        setBubble(buildDayReport(ledger, state.world), 'success');
        renderHUD();
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
        农场现在有 🪙 ${state.world.coins} 金币、🌾 ${state.world.wheat} 小麦、🧺 ${state.world.straw} 稻草、<br>
        🥚 ${state.world.eggs} 鸡蛋、🥛 ${state.world.milk} 牛奶。<br>
        ${hasNext ? '' : '全部课程完成！可以回关继续刷星，也可以去自由模式慢慢经营农场。'}</p>
        <div class="actions">
          ${hasNext ? '<button class="btn primary" id="nextBtn">下一关 ▶</button>' : '<button class="btn primary" id="nextBtn">🐔 进入自由模式</button>'}
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

  els.modeBtn.addEventListener('click', () => {
    if (state.running) return;
    SOUND.play('click');
    showModeGate();
  });

  els.openingStartBtn.addEventListener('click', () => {
    SOUND.play('click');
    showProfile({ returnTo: 'opening' });
  });

  els.profileBackBtn.addEventListener('click', () => {
    SOUND.play('click');
    if (state.profileReturnStep === 'mode') showModeGate();
    else showOpening();
  });

  els.profileContinueBtn.addEventListener('click', () => {
    SOUND.play('click');
    saveProfile();
  });

  els.playerNameInput.addEventListener('input', updateProfileContinue);
  els.playerNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !els.profileContinueBtn.disabled) saveProfile();
  });

  els.boyChoice.addEventListener('click', () => {
    SOUND.play('click');
    state.heroKind = 'boy';
    updateGenderChoices();
  });

  els.girlChoice.addEventListener('click', () => {
    SOUND.play('click');
    state.heroKind = 'girl';
    updateGenderChoices();
  });

  els.editProfileBtn.addEventListener('click', () => {
    SOUND.play('click');
    showProfile({ returnTo: 'mode' });
  });

  els.teachModeBtn.addEventListener('click', () => {
    SOUND.play('click');
    chooseMode('levels');
  });

  els.freeModeBtn.addEventListener('click', () => {
    SOUND.play('click');
    chooseMode('free');
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
  window.__farm = {
    SOUND,
    state,
    editor,
    level,
    tutorVoice,
    speakTutor,
    enterFreeMode,
    showOpening,
    showProfile,
    showModeGate,
    chooseMode,
  };

  // 先在后台恢复上次模式，再从游戏开篇进入角色创建和模式选择。
  state.heroKind = state.progress.heroKind === 'girl' ? 'girl' : 'boy';
  renderHeroToggle();
  if (state.progress.lastMode === 'free') enterFreeMode();
  else loadLevel(resumeLevelIndex(), { keepCode: true });
  showOpening();

  return { destroy: () => cancelAnimationFrame(rafId) };
}
