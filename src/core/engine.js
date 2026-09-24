/**
 * 动画引擎：把世界事件变成看得见的动作。
 *
 * 世界层算完之后会吐出一串事件（移动、翻土、浇水、生长、收获……），
 * 这里负责把它们排成一串动画，并返回一个 Promise，
 * 让解释器 await 到动画播完再执行下一行——代码推进和画面推进天然同步。
 */

const MOVE_MS = 190;
const ACTION_MS = 260;
const TURN_MS = 170;

/** 用 requestAnimationFrame 做一个简单的补间。 */
function tween(duration, onUpdate) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) * (1 - p);
      onUpdate(eased, p);
      if (p < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class FarmAnimator {
  constructor(world, sound) {
    this.world = world;
    this.sound = sound;
    this.heroX = world.hero.x;
    this.heroY = world.hero.y;
    this.effects = [];
    this.walking = false;
    this.time = 0;
    this.now = performance.now();
    this.instant = false;
  }

  /** 每帧调用，推进全局时间（草叶摆动、水波都靠它）。 */
  update(now) {
    this.time = now / 1000;
    this.now = now;
    this.effects = this.effects.filter((effect) => now - effect.t0 < effect.dur);
  }

  addEffect(kind, x, y, dur = 520, text = '') {
    if (this.instant) return;
    this.effects.push({ kind, x, y, t0: performance.now(), dur, text });
  }

  /** 播放一次动作产生的所有事件。 */
  async play(events) {
    if (this.instant) {
      this.heroX = this.world.hero.x;
      this.heroY = this.world.hero.y;
      return;
    }

    for (const event of events) {
      await this.playOne(event);
    }
  }

  async playOne(event) {
    switch (event.kind) {
      case 'move': {
        this.sound?.play('move');
        this.walking = true;
        const fromX = event.from.x;
        const fromY = event.from.y;
        await tween(MOVE_MS, (eased) => {
          this.heroX = fromX + (event.to.x - fromX) * eased;
          this.heroY = fromY + (event.to.y - fromY) * eased;
        });
        this.heroX = event.to.x;
        this.heroY = event.to.y;
        this.walking = false;
        break;
      }
      case 'till':
        this.sound?.play('till');
        this.addEffect('dust', event.x, event.y);
        await wait(ACTION_MS);
        break;
      case 'plant':
        this.sound?.play('plant');
        this.addEffect('grow', event.x, event.y, 420);
        await wait(ACTION_MS);
        break;
      case 'water':
        this.sound?.play('water');
        this.addEffect('water', event.x, event.y, 560);
        await wait(ACTION_MS);
        break;
      case 'grow':
        this.sound?.play('grow');
        this.addEffect('sparkle', event.x, event.y, 700);
        await wait(ACTION_MS);
        break;
      case 'harvest':
        this.sound?.play('harvest');
        this.addEffect('sparkle', event.x, event.y, 700, '+5 金币');
        await wait(ACTION_MS + 80);
        break;
      case 'blocked':
        this.sound?.play('blocked');
        this.addEffect('dust', event.x ?? this.world.hero.x, event.y ?? this.world.hero.y, 320);
        await wait(200);
        break;
      case 'warn':
        this.sound?.play('blocked');
        await wait(180);
        break;
      case 'say':
        await wait(120);
        break;
      case 'turn':
        this.sound?.play('turn');
        await wait(TURN_MS);
        break;
      case 'day':
        this.sound?.play('day');
        await wait(600);
        break;
      case 'collect':
        this.sound?.play('coin');
        await wait(200);
        break;
      case 'feed':
        this.sound?.play('chicken');
        this.addEffect('sparkle', event.x, event.y, 650, '吃饱啦');
        await wait(520);
        break;
      case 'lay':
        this.sound?.play('chicken');
        this.addEffect('egg', event.x, event.y, 780, `+${event.amount} 枚蛋`);
        await wait(600);
        break;
      case 'collectEgg':
        this.sound?.play('coin');
        this.addEffect('sparkle', event.x, event.y, 760, `+${event.amount} 鸡蛋`);
        await wait(520);
        break;
      default:
        await wait(120);
    }

    // 走动之后再对齐一次逻辑坐标，避免长时间累积误差。
    this.heroX = this.world.hero.x;
    this.heroY = this.world.hero.y;
  }
}
