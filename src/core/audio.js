/**
 * 音频管理：真实录音优先，WebAudio 合成音兜底。
 *
 * 素材全部来自本机统一素材库（音效库 / 音乐库），
 * 由本地开发服务器通过 /media/sfx、/media/music 映射出去，
 * 项目里不另建音效目录，保证和有声项目共用同一套素材库。
 *
 * 如果素材取不到（例如直接双击打开 html），会自动退回合成音，
 * 游戏照样有声音反馈，不会报错、不会静音。
 *
 * 音乐：Chapter 1~2 用轻快 ukulele，Chapter 3~4 换成温和钢琴；
 * 另叠一层很轻的鸟鸣环境音。
 */

/** 合成音兜底：素材没加载好时使用。 */
const FALLBACK_NOTES = {
  till: [{ f: 180, d: 0.08, type: 'square' }, { f: 120, d: 0.1, type: 'square' }],
  plant: [{ f: 660, d: 0.06 }, { f: 880, d: 0.08 }],
  water: [{ f: 900, d: 0.05, type: 'sine' }, { f: 1200, d: 0.07, type: 'sine' }],
  harvest: [{ f: 523, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.14 }],
  move: [{ f: 420, d: 0.04, type: 'triangle' }],
  turn: [{ f: 520, d: 0.05, type: 'triangle' }, { f: 640, d: 0.05, type: 'triangle' }],
  blocked: [{ f: 200, d: 0.1, type: 'sawtooth' }, { f: 150, d: 0.12, type: 'sawtooth' }],
  grow: [{ f: 700, d: 0.06 }, { f: 980, d: 0.1 }, { f: 1300, d: 0.12 }],
  win: [{ f: 523, d: 0.1 }, { f: 659, d: 0.1 }, { f: 784, d: 0.1 }, { f: 1046, d: 0.26 }],
  error: [{ f: 260, d: 0.12, type: 'sawtooth' }, { f: 200, d: 0.16, type: 'sawtooth' }],
  click: [{ f: 620, d: 0.03, type: 'triangle' }],
};

/** 音效表：一个事件可以叠多段声音（比如收获 = 拔麦 + 金币）。 */
const SFX = {
  click: [{ file: '448080_Wet_Click.mp3', volume: 0.3, rate: 1.15 }],
  move: [{ file: '384865_Left_Grass_Grassy_Footstep_6.mp3', volume: 0.22, rate: 1.5 }],
  turn: [{ file: '220191_Space_Swoosh_-_brighter.mp3', volume: 0.22, rate: 1.5 }],
  till: [{ file: '849840_shoveling-dirt.mp3', volume: 0.5 }],
  plant: [{ file: '516249_Planting_Seeds.mp3', volume: 0.45, rate: 1.1 }],
  water: [{ file: '207781_Pouring_Liquid.mp3', volume: 0.4, rate: 1.1 }],
  grow: [
    { file: '683102_water_drop.mp3', volume: 0.35 },
    { file: '842513_Triple_Ping_Notification_Sound_Mobile_Optimized.mp3', volume: 0.18, delay: 0.05 },
  ],
  harvest: [
    { file: '387083_Pull_Plant.mp3', volume: 0.5 },
    { file: '402067_Retro_Coin_01.mp3', volume: 0.32, delay: 0.08 },
  ],
  coin: [{ file: '402067_Retro_Coin_01.mp3', volume: 0.4 }],
  day: [{ file: '435508_Rooster_Crow_1.mp3', volume: 0.42 }],
  chicken: [{ file: '668803_Chicken_clucking_3.mp3', volume: 0.3 }],
  cow: [{ file: '59245_z-moo01.mp3', volume: 0.32 }],
  blocked: [{ file: '447910_Plop.mp3', volume: 0.42 }],
  error: [{ file: '493163_Buzzer_sounds_Wrong_answer_Error.mp3', volume: 0.22, rate: 1.1 }],
  success: [{ file: '717771_victory_chime.mp3', volume: 0.5 }],
  win: [
    { file: '220184_Win_Spacey.mp3', volume: 0.55 },
    { file: '717771_victory_chime.mp3', volume: 0.35, delay: 0.12 },
  ],
};

/** 背景音乐与环境音。 */
const MUSIC = {
  farm: '/media/music/2269002_Happy_Coconuts_60s_Edit.mp3',
  calm: '/media/music/1540325_An_Easy_Step_of_Luck.mp3',
};

const AMBIENCE = '/media/sfx/266832_Bird_chirping.mp3';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.failed = new Set();
    this.ready = false;
    this.enabled = true;
    this.musicEnabled = true;
    this.musicVolume = 0.32;
    this.sfxVolume = 0.9;
    this.musicEls = new Map();
    this.currentMusic = null;
    this.ambienceEl = null;
    this.ducked = false;
  }

  /** 浏览器要求先有用户操作才能出声，所以第一次点击时再初始化。 */
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) {
        this.enabled = false;
        return;
      }
      this.ctx = new Ctor();
      this.ctx.onstatechange = () => this.ctx?.resume?.();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.ready) {
      this.ready = true;
      this.preload();
    }
    if (this.musicEnabled && this.currentMusic) this.playMusic(this.currentMusic);
  }

  /** 预加载全部音效，失败的不影响其它音效。 */
  preload() {
    const files = new Set();
    for (const group of Object.values(SFX)) for (const item of group) files.add(item.file);

    for (const file of files) {
      if (this.buffers.has(file) || this.failed.has(file)) continue;
      fetch(`/media/sfx/${encodeURIComponent(file)}`)
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.arrayBuffer();
        })
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buffer) => this.buffers.set(file, buffer))
        .catch(() => this.failed.add(file));
    }
  }

  /** 播放一个音效；素材没准备好就用合成音兜底。 */
  play(name) {
    const group = SFX[name];
    if (!group) return;
    this.unlock();
    if (!this.ctx) return;

    let played = false;
    for (const item of group) {
      const buffer = this.buffers.get(item.file);
      if (!buffer) continue;
      played = true;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      if (item.rate) source.playbackRate.value = item.rate;
      const gain = this.ctx.createGain();
      const when = this.ctx.currentTime + (item.delay ?? 0);
      const target = (item.volume ?? 0.5) * this.sfxVolume;
      gain.gain.setValueAtTime(target, when);
      source.connect(gain).connect(this.ctx.destination);
      source.start(when);
    }

    if (!played) this.playSynth(name);
  }

  playSynth(name) {
    const notes = FALLBACK_NOTES[name];
    if (!notes || !this.ctx) return;
    let t = this.ctx.currentTime;
    for (const note of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = note.type ?? 'square';
      osc.frequency.setValueAtTime(note.f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.06 * this.sfxVolume, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.d);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + note.d + 0.02);
      t += note.d * 0.85;
    }
  }

  // ------------------------------------------------------------ 背景音乐

  getMusicEl(url) {
    if (this.musicEls.has(url)) return this.musicEls.get(url);
    const el = new Audio(url);
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.crossOrigin = 'anonymous';
    this.musicEls.set(url, el);
    return el;
  }

  /** 切换背景音乐（交叉淡入淡出）。 */
  playMusic(name) {
    const url = MUSIC[name];
    if (!url) return;
    this.currentMusic = name;

    for (const [key, el] of this.musicEls) {
      if (key !== url) this.fade(el, 0, 600);
    }

    const el = this.getMusicEl(url);
    if (this.musicEnabled) {
      el.play().catch(() => {});
      this.fade(el, this.musicVolume * (this.ducked ? 0.55 : 1), 900);
    }
    this.startAmbience();
  }

  startAmbience() {
    if (!this.musicEnabled || this.ambienceEl) return;
    const el = new Audio(AMBIENCE);
    el.loop = true;
    el.volume = 0;
    el.play().catch(() => {});
    this.ambienceEl = el;
    this.fade(el, 0.05, 1400);
  }

  /** 运行代码时把音乐压低一点，别盖住音效。 */
  setDucked(ducked) {
    this.ducked = ducked;
    const url = MUSIC[this.currentMusic];
    if (!url) return;
    const el = this.getMusicEl(url);
    this.fade(el, this.musicEnabled ? this.musicVolume * (ducked ? 0.45 : 1) : 0, 500);
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    const url = MUSIC[this.currentMusic];
    if (this.musicEnabled) {
      this.unlock();
      if (url) {
        const el = this.getMusicEl(url);
        el.play().catch(() => {});
        this.fade(el, this.musicVolume * (this.ducked ? 0.45 : 1), 700);
      }
      this.startAmbience();
    } else {
      for (const el of this.musicEls.values()) this.fade(el, 0, 400);
      if (this.ambienceEl) this.fade(this.ambienceEl, 0, 400);
    }
    return this.musicEnabled;
  }

  fade(el, target, ms) {
    if (el.__fadeTimer) clearInterval(el.__fadeTimer);
    const start = el.volume;
    const t0 = performance.now();
    el.__fadeTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      el.volume = Math.max(0, Math.min(1, start + (target - start) * p));
      if (p >= 1) {
        clearInterval(el.__fadeTimer);
        el.__fadeTimer = null;
        if (target === 0) el.pause();
      }
    }, 40);
  }

  /** 调试面板用。 */
  stats() {
    return {
      ready: this.ready,
      sfxLoaded: this.buffers.size,
      sfxFailed: this.failed.size,
      music: this.currentMusic,
      musicOn: this.musicEnabled,
      ducked: this.ducked,
    };
  }
}
