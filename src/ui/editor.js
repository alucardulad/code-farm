/**
 * 中文代码编辑器。
 *
 * 做法参考《地牢围攻》：底下一层负责语法高亮（只读），
 * 上面盖一层透明的 textarea 负责输入和光标。
 * 两层字体、行高、内边距完全一致，所以光标位置能对齐。
 */

const KEYWORDS = ['等待一天', '收鸡蛋', '前进', '后退', '左转', '右转', '翻土', '播种', '浇水', '收获', '喂鸡', '重复', '次', '如果'];
const CONDITIONS = ['脚下是草地', '脚下是泥土', '脚下有幼苗', '脚下是成熟小麦'];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const escapeHtml = (text) => text.replace(/[&<>]/g, (c) => ESCAPES[c]);

/** 把一行高亮成带 span 的 HTML。 */
function highlightLine(line) {
  if (!line) return '';
  const commentAt = line.search(/(\/\/|#|＃)/);
  const code = commentAt >= 0 ? line.slice(0, commentAt) : line;
  const comment = commentAt >= 0 ? line.slice(commentAt) : '';

  let html = '';
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      html += `<span class="tok-plain">${escapeHtml(buffer)}</span>`;
      buffer = '';
    }
  };

  const matchAt = (words) => {
    for (const word of words) {
      if (code.startsWith(word, i)) return word;
    }
    return null;
  };

  while (i < code.length) {
    const char = code[i];
    if (char === '{' || char === '}') {
      flush();
      html += `<span class="tok-brace">${char}</span>`;
      i += 1;
      continue;
    }
    if (/\d/.test(char)) {
      flush();
      let num = '';
      while (i < code.length && /\d/.test(code[i])) num += code[i++];
      html += `<span class="tok-number">${num}</span>`;
      continue;
    }
    if (/[\u4e00-\u9fa5]/.test(char)) {
      const cond = matchAt(CONDITIONS);
      if (cond) {
        flush();
        html += `<span class="tok-cond">${cond}</span>`;
        i += cond.length;
        continue;
      }
      const keyword = matchAt(KEYWORDS);
      if (keyword) {
        flush();
        html += `<span class="tok-keyword">${keyword}</span>`;
        i += keyword.length;
        continue;
      }
      // 条件是由「脚下是草地」这类固定短语组成，逐字读出来即可。
      let word = '';
      while (i < code.length && /[\u4e00-\u9fa5]/.test(code[i])) word += code[i++];
      buffer += word;
      continue;
    }
    buffer += char;
    i += 1;
  }

  flush();
  if (comment) html += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
  return html;
}

export function createEditor(root, options = {}) {
  root.classList.add('editor-wrap');
  root.innerHTML = `
    <div class="gutter"></div>
    <div class="code-area">
      <div class="line-marks"></div>
      <pre class="highlight-layer" aria-hidden="true"></pre>
      <textarea class="code-input" spellcheck="false" autocapitalize="off"
        autocorrect="off" wrap="off" aria-label="中文代码编辑器"></textarea>
    </div>
  `;

  const gutter = root.querySelector('.gutter');
  const highlight = root.querySelector('.highlight-layer');
  const input = root.querySelector('.code-input');
  const marks = root.querySelector('.line-marks');

  let activeLine = -1;
  let errorLine = -1;

  function paintMarks() {
    const lines = input.value.split('\n').length;
    const parts = [];
    for (let i = 1; i <= lines; i += 1) {
      let cls = 'line-mark';
      if (i === activeLine) cls += ' active';
      if (i === errorLine) cls += ' error';
      parts.push(`<div class="${cls}" style="top: calc(12px + ${i - 1} * var(--line-height))"></div>`);
    }
    marks.innerHTML = parts.join('');
  }

  function sync() {
    const value = input.value;
    const lines = value.split('\n');
    gutter.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
    highlight.innerHTML = lines.map(highlightLine).join('\n') + '\n';
    gutter.scrollTop = input.scrollTop;
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  }

  input.addEventListener('input', () => {
    sync();
    options.onChange?.(input.value);
  });

  input.addEventListener('scroll', () => {
    gutter.scrollTop = input.scrollTop;
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  });

  // 按 Tab 插入两个空格，而不是把焦点切走。
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.slice(0, start) + '  ' + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start + 2;
      sync();
      options.onChange?.(input.value);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      options.onSubmit?.();
    }
  });

  const api = {
    get value() {
      return input.value;
    },
    setValue(text, { focus = false } = {}) {
      input.value = text;
      sync();
      paintMarks();
      if (focus) input.focus();
    },
    /** 在光标处插入一段代码（指令面板点击时用）。 */
    insert(text) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      const needsNewline = before.length > 0 && !before.endsWith('\n');
      const insertText = (needsNewline ? '\n' : '') + text;
      input.value = before + insertText + after;
      const caret = start + insertText.length;
      input.selectionStart = input.selectionEnd = caret;
      sync();
      options.onChange?.(input.value);
      input.focus();
    },
    setActiveLine(line) {
      activeLine = line;
      paintMarks();
    },
    setErrorLine(line) {
      errorLine = line;
      paintMarks();
    },
    clearMarks() {
      activeLine = -1;
      errorLine = -1;
      paintMarks();
    },
    focus() {
      input.focus();
    },
  };

  sync();
  paintMarks();
  return api;
}
