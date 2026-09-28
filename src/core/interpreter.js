/**
 * 中文代码解释器：词法分析 → 语法分析 → 逐行执行。
 *
 * 为什么不用 eval / new Function：
 *   1. 教学场景必须有步数上限，原生 JS 拦不住写不完的循环；
 *   2. 需要知道现在执行到第几行，才能在编辑器里高亮、出错时定位；
 *   3. 报错要翻译成孩子看得懂的中文，并告诉他下一步怎么改。
 *
 * 支持的写法（一行一条，分号可有可无）：
 *   前进 3          后退 2        左转        右转
 *   翻土            播种          浇水        收获
 *   喂鸡            收鸡蛋        喂牛        挤奶
 *   卖出            买种子        买稻草
 *   重复 3 次 { ... }
 *   重复直到 前方是成熟小麦 { ... }      条件不成立就一直做，成立就停
 *   如果 脚下是草地 { ... }
 *   如果 奶牛可以挤奶 { ... }    如果 鸡舍里有鸡蛋 { ... }
 *   如果 脚下是成熟小麦 { ... } 否则 { ... }
 */

export class CodeError extends Error {
  constructor(message, line = 1, tip = '') {
    super(message);
    this.name = 'CodeError';
    this.line = line;
    this.tip = tip;
  }
}

/** 所有可以直接使用的动作指令。 */
export const ACTIONS = [
  '前进', '后退', '左转', '右转', '翻土', '播种', '浇水', '收获', '等待一天',
  '喂鸡', '收鸡蛋', '喂牛', '挤奶',
  '卖出', '买种子', '买稻草', '买鸡', '买牛',
];

/** 判断语句里可以使用的条件。 */
export const CONDITIONS = [
  '脚下是草地', '脚下是泥土', '脚下有幼苗', '脚下是成熟小麦',
  '奶牛可以挤奶', '鸡舍里有鸡蛋', '稻草足够',
  '前方是成熟小麦', '到旗子了',
];

/**
 * 「重复直到」单条最多跑多少遍。
 * 条件写反了就会一直转下去，孩子看不出来，所以必须有个上限兜住，
 * 超了就告诉他条件一直没成立，而不是让浏览器卡死。
 */
export const MAX_UNTIL = 100;

/** 每关最多执行的语句数，兜住「重复 50 次」这类写法。 */
export const DEFAULT_MAX_STEPS = 600;

const COMMENT_RE = /(\/\/|#|＃).*$/;
const MAX_REPEAT = 50;
const MAX_MOVE = 30;

/** 去掉注释，方便后面按行处理。 */
function stripComments(source) {
  return String(source ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(COMMENT_RE, ''))
    .join('\n');
}

/**
 * 词法分析：把源码切成一串记号。
 * 换行是重要分隔符，大括号单独成记号，数字和「词」分开，
 * 这样「前进3」和「前进 3」都能被识别。
 */
function tokenize(source) {
  const text = stripComments(source);
  const tokens = [];
  const re = /\r?\n|\{|\}|\d+|[^\s{}0-9]+/g;
  let line = 1;
  let match = re.exec(text);
  while (match !== null) {
    const raw = match[0];
    if (raw === '\n' || raw === '\r\n') {
      // 换行必须保留：中文代码是一行一条指令，靠换行区分语句。
      tokens.push({ type: 'newline', value: '\n', line });
      line += 1;
    } else if (raw === '{' || raw === '}') {
      tokens.push({ type: 'brace', value: raw, line });
    } else if (/^\d+$/.test(raw)) {
      tokens.push({ type: 'number', value: Number(raw), line });
    } else {
      tokens.push({ type: 'word', value: raw, line });
    }
    match = re.exec(text);
  }
  return tokens;
}

/** 把一段记号流解析成语句数组（按行组织，支持嵌套大括号）。 */
function parseBlock(tokens, start) {
  const body = [];
  let i = start;

  const skipNewlines = () => {
    while (i < tokens.length && tokens[i].type === 'newline') i += 1;
  };

  while (i < tokens.length) {
    skipNewlines();
    if (i >= tokens.length) break;

    const token = tokens[i];

    // 遇到「}」：把这一层交还给上一层。
    if (token.type === 'brace' && token.value === '}') {
      return { body, pos: i + 1, closed: true };
    }

    if (token.type === 'brace' && token.value === '{') {
      throw new CodeError('这里多了一个「{」', token.line, '「{」要写在「重复」或者「如果」那一行的末尾。');
    }

    const line = token.line;
    const parts = [];

    // 收集这一行的记号，遇到大括号或者换行就停。
    while (i < tokens.length && tokens[i].type !== 'newline' && tokens[i].type !== 'brace') {
      parts.push(tokens[i]);
      i += 1;
    }

    const opensBlock = i < tokens.length && tokens[i].type === 'brace' && tokens[i].value === '{';

    if (opensBlock) {
      i += 1; // 跳过「{」
      const inner = parseBlock(tokens, i);
      if (!inner.closed) {
        throw new CodeError('大括号没有关上', line, '数一数「{」和「}」，在最后补一个「}」。');
      }
      i = inner.pos;
      const node = makeControlNode(parts, line, inner.body);
      if (node.kind === 'else') {
        // 「否则」不单独成句，挂在前面那个「如果」上。
        const prev = body[body.length - 1];
        if (!prev || prev.kind !== 'if' || prev.altBody) {
          throw new CodeError('「否则」要跟在「如果」后面', line, '先写「如果 ... { ... }」，再写「否则 { ... }」。');
        }
        prev.altBody = inner.body;
      } else {
        body.push(node);
      }
    } else {
      if (parts.length === 0) {
        // 只可能是孤立的大括号，上面已经拦过；这里兜底。
        i += 1;
        continue;
      }
      body.push(makeActionNode(parts, line));
    }
  }

  return { body, pos: i, closed: false };
}

function makeControlNode(parts, line, body) {
  const head = parts[0].value;

  if (head === '否则') {
    if (parts.length > 1) {
      throw new CodeError('「否则」后面不用写别的', line, '直接写「否则 {」，把另一条路写在里面。');
    }
    return { kind: 'else', line, body };
  }

  if (head === '重复') {
    const count = parts.find((part) => part.type === 'number');
    if (!count) {
      throw new CodeError('「重复」后面要写次数', line, '比如：重复 3 次 {');
    }
    if (count.value < 1) {
      throw new CodeError('重复的次数要比 0 大', line, '比如：重复 3 次 {');
    }
    if (count.value > MAX_REPEAT) {
      throw new CodeError(`一次最多重复 ${MAX_REPEAT} 遍`, line, '次数写小一点，分几次做完。');
    }
    return { kind: 'repeat', times: count.value, line, body };
  }

  if (head === '如果' || head === '重复直到') {
    const condition = parts
      .slice(1)
      .map((part) => String(part.value))
      .join('');
    if (head === '如果' && parts.length === 1) {
      throw new CodeError('「如果」后面要写条件', line, '比如：如果 脚下是草地 {');
    }
    if (head === '重复直到' && parts.length === 1) {
      throw new CodeError('「重复直到」后面要写条件', line, '比如：重复直到 前方是成熟小麦 {');
    }
    if (!CONDITIONS.includes(condition)) {
      throw new CodeError(
        `不认识这个条件「${condition || '（空的）'}」`,
        line,
        `可以写：${CONDITIONS.join('、')}`,
      );
    }
    return { kind: head === '如果' ? 'if' : 'until', condition, line, body };
  }

  throw new CodeError(
    `「${head}」后面跟了一个「{」`,
    line,
    '只有「重复」「重复直到」和「如果」需要大括号。',
  );
}

function makeActionNode(parts, line) {
  const name = parts[0].value;
  if (!ACTIONS.includes(name)) {
    throw new CodeError(
      `不认识的指令「${name}」`,
      line,
      `现在会用的指令有：${ACTIONS.join('、')}`,
    );
  }

  const args = parts.slice(1);
  const numbers = args.filter((part) => part.type === 'number').map((part) => part.value);

  if (name === '前进' || name === '后退') {
    const steps = numbers.length > 0 ? numbers[0] : 1;
    if (steps < 1) {
      throw new CodeError(`「${name}」的步数要比 0 大`, line, `比如：${name} 3`);
    }
    if (steps > MAX_MOVE) {
      throw new CodeError(`「${name}」一次最多走 ${MAX_MOVE} 步`, line, '分开写几行，或者用「重复」。');
    }
    return { kind: 'action', name, steps, line };
  }

  if (numbers.length > 0) {
    throw new CodeError(`「${name}」后面不用写数字`, line, `直接写「${name}」就好。`);
  }
  return { kind: 'action', name, steps: 1, line };
}

/** 语法分析：源码 → 语句树。 */
export function parseScript(source) {
  const tokens = tokenize(source);
  const root = parseBlock(tokens, 0);
  if (root.closed) {
    throw new CodeError('多了一个「}」', 1, '「}」要和前面的「{」配成一对。');
  }
  return root.body;
}

/**
 * 执行语句树。
 * api 需要提供：run(node)、test(condition)，以及可选的 setActiveLine(line)。
 */
export async function execute(program, api, options = {}) {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const state = { steps: 0 };
  await runBody(program, api, state, maxSteps);
}

async function runBody(body, api, state, maxSteps) {
  for (const node of body) {
    if (state.steps >= maxSteps) {
      throw new CodeError(
        `代码跑了 ${maxSteps} 步还没结束`,
        node.line,
        '检查一下循环次数是不是写得太多了。',
      );
    }

    api.setActiveLine?.(node.line);

    if (node.kind === 'action') {
      state.steps += 1;
      await api.run(node);
    } else if (node.kind === 'repeat') {
      for (let i = 0; i < node.times; i += 1) {
        state.steps += 1;
        api.setActiveLine?.(node.line);
        await runBody(node.body, api, state, maxSteps);
      }
    } else if (node.kind === 'if') {
      state.steps += 1;
      if (api.test(node.condition)) {
        await runBody(node.body, api, state, maxSteps);
      } else if (node.altBody) {
        await runBody(node.altBody, api, state, maxSteps);
      }
    } else if (node.kind === 'until') {
      // 先看条件：成立就一次都不做；不成立就做一遍，再看一次。
      let rounds = 0;
      while (!api.test(node.condition)) {
        if (rounds >= MAX_UNTIL) {
          throw new CodeError(
            `「重复直到」跑了 ${MAX_UNTIL} 遍，条件还是一直没成立`,
            node.line,
            '检查条件是不是写反了，或者先在循环外面手动做一步。',
          );
        }
        rounds += 1;
        state.steps += 1;
        if (state.steps >= maxSteps) {
          throw new CodeError(
            `代码跑了 ${maxSteps} 步还没结束`,
            node.line,
            '检查一下循环次数是不是写得太多了。',
          );
        }
        api.setActiveLine?.(node.line);
        await runBody(node.body, api, state, maxSteps);
      }
    }
  }
}
