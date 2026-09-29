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

/**
 * 章前小课堂：每进一个新章节，先用穗穗的声音把这一章的大概念说一遍，
 * 再放孩子进去写代码。孩子不认识新指令，比不认识错字更需要引导。
 */
export const CHAPTER_INTRO = {
  ch1: {
    title: '什么是「顺序」？',
    body: '小农夫做事一步接一步：先写哪一行，就先做哪行。写错了不要紧，改一改再运行就好。',
    sample: '前进 → 他往前走一格',
    voice: '新的一章开始啦。这一章叫顺序：小农夫做事一步接一步，先写哪一行，就先做哪一行。',
  },
  ch2: {
    title: '什么是「重复」？',
    body: '同一件事要做很多遍的时候，不用写很多行，用「重复」把它包起来就行。',
    sample: '重复 9 次 { 前进 }',
    voice: '新的一章开始啦。这一章叫重复：同一件事要做很多遍，用「重复」包起来，写一次就能做好多遍。',
  },
  ch3: {
    title: '什么是「判断」？',
    body: '先看看脚下是什么，再决定这件事要不要做。条件说对了才做，说不对就跳过。',
    sample: '如果 脚下是草地 { 翻土 }',
    voice: '新的一章开始啦。这一章叫判断：先看看脚下是什么，条件说对了才做这件事，说不对就跳过。',
  },
  ch4: {
    title: '新朋友：小鸡和小牛',
    body: '小麦收下来会变成稻草，稻草能喂鸡、喂牛。喂饱了等一天，就有鸡蛋和牛奶。',
    sample: '喂鸡 → 在鸡舍旁喂饱鸡',
    voice: '新的一章开始啦。这一章有两位新朋友：小鸡和小牛。小麦收下来会变成稻草，稻草能喂鸡、喂牛，喂饱了等一天，就有鸡蛋和牛奶。',
  },
  ch5: {
    title: '把两个本领合起来',
    body: '「重复」里面可以放「如果」：一边走，一边看情况决定做什么。',
    sample: '重复 6 次 { 前进 如果 脚下是草地 { 翻土 } }',
    voice: '新的一章开始啦。这一章把重复和判断合起来用：一边走，一边看情况决定做什么。',
  },
  ch6: {
    title: '什么是「否则」？',
    body: '一件事有两种做法的时候用它：条件对了走上面那条路，条件不对就走「否则」这条。',
    sample: '如果 脚下是成熟小麦 { 收获 } 否则 { 翻土 }',
    voice: '新的一章开始啦。这一章学「否则」：一件事有两种做法时，条件对了走上面，条件不对就走否则这条。',
  },
  ch7: {
    title: '去集市做买卖',
    body: '农场里的东西能换钱：「卖出」把收成换成金币，再用金币买种子、买稻草。',
    sample: '卖出 → 鸡蛋、牛奶、小麦换成金币',
    voice: '新的一章开始啦。这一章去集市做买卖：「卖出」把收成换成金币，再用金币买种子、买稻草。',
  },
  ch8: {
    title: '什么是「重复直到」？',
    body: '不知道要做几遍的时候，让条件来喊停：条件没成立就一直做，成立了就停。',
    sample: '重复直到 到旗子了 { 前进 }',
    voice: '新的一章开始啦。这一章学「重复直到」：不知道要做几遍的时候，让条件来喊停，条件成立了就停。',
  },
};

export const TUTOR_LINES = {
  answer: {
    file: 'answer.mp3',
    text: '这是参考解。先看懂每一步为什么这样写，再把代码清空，靠自己写一遍。',
  },
  empty: {
    file: 'empty.mp3',
    text: '代码框还是空的。点下面的指令口袋，先放一条指令进去吧。',
  },
  check: {
    file: 'check.mp3',
    text: '先别急，穗穗陪你再检查一次。看看标红的那一行，确认指令、方向和步数，再运行一次。',
  },
  ...Object.fromEntries(LEVELS.map((def) => [
    def.id,
    { file: `${def.id}.mp3`, text: levelLine(def) },
  ])),
  ...Object.fromEntries(Object.entries(CHAPTER_INTRO).map(([key, intro]) => [
    `chapter-${key}`,
    { file: `chapter-${key}.mp3`, text: intro.voice },
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
