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
