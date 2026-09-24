/**
 * 把「解释器」和「农场世界」接起来：玩家点运行时，真正发生的事都在这里。
 *
 * 运行流程：
 *   1. 检查本章有没有用禁用语法（教学拦截）；
 *   2. 词法 / 语法分析，出错就在第 N 行标红；
 *   3. 逐条执行，每条动作先结算世界，再把事件交给动画；
 *   4. 每步之后检查目标，达成了就抛 HaltSignal，整条调用栈立刻停下。
 */

import { parseScript, execute, CodeError } from './interpreter.js';
import { applyAction, testCondition, checkGoal, WorldError } from './world.js';
import { findForbiddenFeature } from './tutor.js';
import { chapterOf } from './levels.js';
import { HaltSignal } from './signal.js';

/**
 * 运行一段中文代码。
 *
 * @param {object} world        createWorld 创建的世界状态
 * @param {string} source       玩家写的代码
 * @param {object} handlers     渲染层回调：onAction / onEvent / onActiveLine / onGoal
 * @returns {Promise<{ok: boolean, stars?: number, reason?: string}>}
 */
export async function runProgram(world, source, handlers = {}) {
  world.status = 'playing';
  world.actions = 0;
  world.lastError = null;
  world.messageKind = 'info';

  // 1. 教学拦截
  const chapter = chapterOf(world.level);
  const violation = findForbiddenFeature(source, world.level.forbidden ?? chapter?.forbidden ?? []);
  if (violation) {
    const error = new CodeError(violation.hint, violation.line, violation.hint);
    world.lastError = { line: violation.line, message: violation.hint };
    world.message = `${violation.message}这一章还用不了。${violation.hint}`;
    world.messageKind = 'warn';
    return { ok: false, reason: 'forbidden', error };
  }

  // 2. 语法分析
  let program;
  try {
    program = parseScript(source);
  } catch (error) {
    const line = error.line ?? 1;
    world.lastError = { line, message: error.message };
    world.message = error.message;
    world.messageKind = 'error';
    return { ok: false, reason: 'syntax', error };
  }

  if (program.length === 0) {
    world.message = '代码是空的，先写一条指令试试。';
    world.messageKind = 'warn';
    return { ok: false, reason: 'empty' };
  }

  // 3. 逐条执行
  const api = {
    setActiveLine: (line) => handlers.onActiveLine?.(line),
    test: (condition) => testCondition(world, condition),
    run: async (node) => {
      let events;
      try {
        events = applyAction(world, node);
      } catch (error) {
        if (error instanceof WorldError) {
          const codeError = new CodeError(error.message, node.line, error.tip);
          world.lastError = { line: node.line, message: error.message };
          world.message = error.message;
          world.messageKind = 'error';
          throw codeError;
        }
        throw error;
      }

      // 把事件交给渲染层播动画；没有渲染层（测试）时直接跳过。
      await handlers.onAction?.({ node, events, world });

      // 4. 每步检查目标
      const goal = checkGoal(world);
      if (goal.done) {
        world.status = 'win';
        throw new HaltSignal({ stars: world.level, goal: goal.text });
      }
    },
  };

  try {
    await execute(program, api);
  } catch (error) {
    if (error instanceof HaltSignal) {
      handlers.onGoal?.(world);
      return { ok: true, stars: countStars(world) };
    }
    if (error instanceof CodeError) {
      world.lastError = { line: error.line, message: error.message };
      world.message = error.message;
      world.messageKind = 'error';
      return { ok: false, reason: 'runtime', error };
    }
    throw error;
  }

  world.status = 'playing';
  if (world.level.mode === 'free') {
    if (world.messageKind !== 'warn') {
      world.message = '这一轮农活做完了。';
      world.messageKind = 'success';
    }
    return { ok: true, reason: 'free' };
  }
  const goal = checkGoal(world);
  world.message = goal.done ? '完成啦！' : `还差一点：${goal.text}`;
  world.messageKind = goal.done ? 'success' : 'warn';
  return { ok: goal.done, reason: goal.done ? undefined : 'unfinished' };
}

function countStars(world) {
  const par = world.level.par ?? 99;
  if (world.actions <= par) return 3;
  if (world.actions <= Math.ceil(par * 1.6)) return 2;
  return 1;
}
