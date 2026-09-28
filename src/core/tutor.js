/**
 * 教学进度控制：检查玩家有没有用「这一章还没教」的语法。
 *
 * 和《地牢围攻》一样，这里不报「语法错误」，而是给一句教学提示。
 * 比如第一章要求把每一步写清楚，偷用循环就学不到顺序执行，
 * 所以要拦住他，并告诉他下一章再学。
 */

export const FEATURE_LABEL = {
  repeat: '「重复」',
  if: '「如果」',
  else: '「否则」',
  pasture: '养鸡牧牛的指令',
  market: '集市的买卖指令',
  until: '「重复直到」',
};

export const FEATURE_HINT = {
  repeat: '先把每一步都写成一行，等第 2 章再学「重复」。',
  if: '这一关的动作是固定的，先按顺序把路线写出来，等第 3 章再学「如果」。',
  else: '先把「如果」写清楚就好，「否则」是两选一的写法，等第 6 章再学。',
  pasture: '这几关先把地种好，等第 4 章「牧场」再学喂鸡、喂牛、收鸡蛋和挤奶。',
  market: '这几关先把农活做好，等第 7 章「集市」再学卖出、买种子和买稻草。',
  until: '这几关先按数好的次数重复，「重复直到」是看情况停的写法，等第 8 章再学。',
};

/** 牧场指令：第 4 章才解锁，前面的章节先把农活练熟。 */
export const PASTURE_COMMANDS = ['喂鸡', '收鸡蛋', '喂牛', '挤奶'];

/** 集市指令：第 7 章才解锁，前面先把种地和牧场练熟。 */
export const MARKET_COMMANDS = ['卖出', '买种子', '买稻草', '买鸡', '买牛'];

/**
 * 扫描源码里是否出现了禁用语法。
 * 只做简单的文本扫描，够用且不会误伤，因为中文指令是独立的词。
 */
export function findForbiddenFeature(source, forbidden = []) {
  if (!forbidden || forbidden.length === 0) return null;

  const lines = String(source ?? '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/(\/\/|#|＃).*$/, '').trim();
    if (!line) continue;

    if (forbidden.includes('repeat') && /^重复(?:\s|\d|$)/.test(line)) {
      return { feature: 'repeat', line: i + 1, message: FEATURE_LABEL.repeat, hint: FEATURE_HINT.repeat };
    }
    if (forbidden.includes('if') && /^如果(?:\s|$)/.test(line)) {
      return { feature: 'if', line: i + 1, message: FEATURE_LABEL.if, hint: FEATURE_HINT.if };
    }
    if (forbidden.includes('until') && /^重复直到(?:\s|$)/.test(line)) {
      return { feature: 'until', line: i + 1, message: FEATURE_LABEL.until, hint: FEATURE_HINT.until };
    }
    if (forbidden.includes('else') && /^否则(?:\s|$)/.test(line)) {
      return { feature: 'else', line: i + 1, message: FEATURE_LABEL.else, hint: FEATURE_HINT.else };
    }
    if (forbidden.includes('pasture')) {
      const command = PASTURE_COMMANDS.find((name) => line.startsWith(name));
      if (command) {
        return {
          feature: 'pasture',
          line: i + 1,
          message: `「${command}」`,
          hint: FEATURE_HINT.pasture,
        };
      }
    }
    if (forbidden.includes('market')) {
      const command = MARKET_COMMANDS.find((name) => line.startsWith(name));
      if (command) {
        return {
          feature: 'market',
          line: i + 1,
          message: `「${command}」`,
          hint: FEATURE_HINT.market,
        };
      }
    }
  }

  return null;
}
