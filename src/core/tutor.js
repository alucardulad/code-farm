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
};

export const FEATURE_HINT = {
  repeat: '先把每一步都写成一行，等第 2 章再学「重复」。',
  if: '这一关的动作是固定的，先按顺序把路线写出来，等第 3 章再学「如果」。',
};

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
  }

  return null;
}
