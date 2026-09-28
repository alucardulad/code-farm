/**
 * 牧场丰收仙女的台词与配音清单。
 *
 * 每关预生成“关卡名 + 第一条精确提示”的短语音；屏幕上的提示抽屉仍然
 * 展示该关全部文字提示，兼顾即时反馈和不同阅读节奏。
 */

import { LEVELS } from './levels.js';

export const TUTOR_NAME = '穗穗 · 丰收仙女';
export const TUTOR_VOICE = {
  speaker: '坎蒂丝',
  speed: 1.02,
  language: 'ZH',
};

const levelLine = (def) => [
  `我是穗穗，陪你完成${def.name}。`,
  `给你一个小提示：${def.hints[0]}`,
].join('');

export const TUTOR_LINES = {
  answer: {
    file: 'answer.mp3',
    text: '这是参考解。先看懂每一步为什么这样写，再把代码清空，靠自己写一遍。',
  },
  empty: {
    file: 'empty.mp3',
    text: '代码还是空的。先在左边写一条指令，再点运行。',
  },
  check: {
    file: 'check.mp3',
    text: '先别急，穗穗陪你再检查一次。看看标红的那一行，确认指令、方向和步数，再运行一次。',
  },
  ...Object.fromEntries(LEVELS.map((def) => [
    def.id,
    { file: `${def.id}.mp3`, text: levelLine(def) },
  ])),
};

export function getTutorLine(key) {
  return TUTOR_LINES[key] ?? null;
}

/**
 * 台词的简易指纹（FNV-1a 十六进制）。
 * 配音生成脚本用它判断「台词改了但 mp3 还是旧的」，避免提示和录音对不上。
 */
export function tutorLineHash(text) {
  let h = 0x811c9dc5;
  const str = String(text ?? '');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 全部台词当前的指纹表：{ 键: 指纹 }。 */
export function tutorLineHashes() {
  return Object.fromEntries(
    Object.entries(TUTOR_LINES).map(([key, line]) => [key, tutorLineHash(line.text)]),
  );
}
