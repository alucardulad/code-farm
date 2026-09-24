/**
 * 关卡自检：把每个关卡的参考解真正跑一遍。
 * 参照《地牢围攻》的做法——设计出来的关卡必须能过，否则直接测试失败。
 *
 * 运行：node tests/levels.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, CHAPTERS, FREE_MODE } from '../src/core/levels.js';
import {
  createWorld,
  checkGoal,
  countChickens,
  exportWorld,
  restoreWorld,
} from '../src/core/world.js';
import { runProgram } from '../src/core/runner.js';
import { TUTOR_LINES, TUTOR_VOICE } from '../src/core/tutor-lines.js';

const VOICE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'voice');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`✗ ${name}\n    ${error.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`✗ ${name}\n    ${error.message}`);
  }
}

// ------------------------------------------------------------ 结构检查

check('关卡数量是 26', () => assert.equal(LEVELS.length, 26));
check('章节数量是 4', () => assert.equal(CHAPTERS.length, 4));
check('关卡 id 不重复', () => {
  const ids = new Set(LEVELS.map((level) => level.id));
  assert.equal(ids.size, LEVELS.length);
});

for (const level of LEVELS) {
  check(`${level.id} 的关卡字段完整`, () => {
    assert.ok(level.name, '缺少 name');
    assert.ok(level.objective, '缺少 objective');
    assert.ok(Array.isArray(level.hints) && level.hints.length > 0, '缺少 hints');
    assert.ok(level.map.length > 0, '缺少 map');
    assert.ok(level.starter !== undefined, '缺少 starter');
    assert.ok(level.solution, '缺少 solution');
    assert.ok(Number.isFinite(level.par), '缺少 par');
  });

  check(`${level.id} 的地图是矩形`, () => {
    const width = level.map[0].length;
    for (const row of level.map) assert.equal(row.length, width, `有长度不一致的行：${row}`);
  });

  check(`${level.id} 只有一个出生点`, () => {
    const count = (level.map.join('').match(/[@$%&]/g) ?? []).length;
    assert.equal(count, 1);
  });

  check(`${level.id} 属于一个存在的章节`, () => {
    assert.ok(CHAPTERS.some((chapter) => chapter.id === level.chapter));
  });

  check(`${level.id} 的初始代码不是完整答案`, () => {
    if (level.id === 'level-1') return; // 第 1 关故意留一行示范
    const starter = level.starter.replace(/(\/\/|#|＃).*$/gm, '').replace(/\s/g, '');
    const solution = level.solution.replace(/\s/g, '');
    assert.notEqual(starter, solution, 'starter 和 solution 完全一样，玩家没得写');
  });

  check(`${level.id} 有丰收仙女配音`, () => {
    const line = TUTOR_LINES[level.id];
    assert.ok(line?.text, '缺少配音台词');
    assert.match(line.text, /穗穗/);
    const file = join(VOICE_DIR, line.file);
    assert.ok(existsSync(file), `缺少配音文件 ${line.file}`);
    assert.ok(statSync(file).size > 4096, `配音文件过小：${line.file}`);
  });

}

check('丰收仙女使用坎蒂丝音色', () => assert.equal(TUTOR_VOICE.speaker, '坎蒂丝'));

// ------------------------------------------------------------ 一关只教一个概念

check('一关最多一个新概念', () => {
  const seen = new Set();
  for (const level of LEVELS) {
    const fresh = (level.newCommands ?? []).filter((command) => !seen.has(command));
    assert.ok(fresh.length <= 1, `${level.id} 一次引入了 ${fresh.length} 个新概念：${fresh.join('、')}`);
    for (const command of fresh) seen.add(command);
  }
});

// ------------------------------------------------------------ 参考解必须能通关

for (const level of LEVELS) {
  await checkAsync(`${level.id} 参考解可以通关`, async () => {
    const world = createWorld(level);
    const result = await runProgram(world, level.solution, {});
    assert.ok(result.ok, `没能通关，卡在：${world.message}`);
    const goal = checkGoal(world);
    assert.ok(goal.done, `目标未达成：${goal.text}`);
  });

  await checkAsync(`${level.id} 参考解拿到三星`, async () => {
    const world = createWorld(level);
    const result = await runProgram(world, level.solution, {});
    assert.equal(result.stars, 3, `行动 ${world.actions} 次，三星线是 ${level.par}`);
  });
}

// ------------------------------------------------------------ 教学拦截

await checkAsync('第一章拦住「重复」并给出教学提示', async () => {
  const level = LEVELS.find((item) => item.id === 'level-2');
  const world = createWorld(level);
  const result = await runProgram(world, '重复 9 次 {\n  前进\n}', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  assert.match(world.lastError.message, /第 2 章/);
});

await checkAsync('第二章拦住「如果」并给出教学提示', async () => {
  const level = LEVELS.find((item) => item.id === 'level-11');
  const world = createWorld(level);
  const result = await runProgram(world, '重复 9 次 {\n  如果 脚下是草地 {\n    翻土\n  }\n}', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
});

await checkAsync('语法错误能定位到行号', async () => {
  const level = LEVELS.find((item) => item.id === 'level-1');
  const world = createWorld(level);
  const result = await runProgram(world, '飞翔', {});
  assert.equal(result.ok, false);
  assert.equal(world.lastError.line, 1);
  assert.match(world.lastError.message, /不认识的指令/);
});

await checkAsync('没写代码时给出温和提示', async () => {
  const level = LEVELS.find((item) => item.id === 'level-1');
  const world = createWorld(level);
  const result = await runProgram(world, '// 还没写\n', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty');
});

await checkAsync('循环次数过大时被拦住', async () => {
  const level = LEVELS.find((item) => item.id === 'level-11');
  const world = createWorld(level);
  const result = await runProgram(world, '重复 99 次 {\n  前进\n}', {});
  assert.equal(result.ok, false);
  assert.match(world.lastError.message, /最多重复/);
});

// ------------------------------------------------------------ 通关后的自由农场

check('自由农场地图和初始鸡群有效', () => {
  const world = createWorld(FREE_MODE);
  const width = FREE_MODE.map[0].length;
  assert.ok(FREE_MODE.map.every((row) => row.length === width), '自由农场地图不是矩形');
  assert.equal(countChickens(world), 2);
  assert.ok(world.structures.some((structure) => structure.kind === 'coop'), '缺少鸡舍');
  assert.equal(world.straw, 0);
  assert.equal(world.pendingEggs, 0);
});

await checkAsync('自由农场没有过关目标也能正常结束', async () => {
  const world = createWorld(FREE_MODE);
  const result = await runProgram(world, '左转', {});
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'free');
});

await checkAsync('自由农场收获小麦会得到稻草', async () => {
  const world = createWorld(FREE_MODE);
  world.hero.x = 1;
  world.hero.y = 1;
  const result = await runProgram(world, '翻土\n播种\n浇水\n等待一天\n收获', {});
  assert.equal(result.ok, true);
  assert.equal(world.harvested, 1);
  assert.equal(world.wheat, 1);
  assert.equal(world.straw, 1);
});

await checkAsync('自由农场可以喂鸡、下蛋并收鸡蛋', async () => {
  const world = createWorld(FREE_MODE);
  const coop = world.structures.find((structure) => structure.kind === 'coop');
  world.hero.x = coop.x;
  world.hero.y = coop.y + 1;
  world.straw = countChickens(world);
  const result = await runProgram(world, '喂鸡\n等待一天\n收鸡蛋', {});
  assert.equal(result.ok, true);
  assert.equal(world.straw, 0);
  assert.equal(world.fedChickens, 0);
  assert.equal(world.pendingEggs, 0);
  assert.equal(world.eggs, 2);
  assert.equal(world.day, 2);
});

await checkAsync('自由农场完整种植养鸡闭环可用', async () => {
  const world = createWorld(FREE_MODE);
  const program = `翻土
播种
浇水
前进
翻土
播种
浇水
等待一天
后退
收获
前进
收获
前进 3
右转
前进 4
左转
前进
右转
前进 2
右转
前进
喂鸡
等待一天
收鸡蛋`;
  const result = await runProgram(world, program, {});
  assert.equal(result.ok, true);
  assert.equal(world.wheat, 2);
  assert.equal(world.straw, 0);
  assert.equal(world.eggs, 2);
  assert.equal(world.pendingEggs, 0);
  assert.equal(world.day, 3);
});

await checkAsync('自由农场没喂鸡就不会下蛋', async () => {
  const world = createWorld(FREE_MODE);
  const coop = world.structures.find((structure) => structure.kind === 'coop');
  world.hero.x = coop.x;
  world.hero.y = coop.y + 1;
  const result = await runProgram(world, '等待一天\n收鸡蛋', {});
  assert.equal(result.ok, true);
  assert.equal(world.pendingEggs, 0);
  assert.equal(world.eggs, 0);
  assert.match(world.message, /还没有鸡蛋/);
});

check('自由农场状态可以保存并恢复', () => {
  const world = createWorld(FREE_MODE);
  world.day = 7;
  world.straw = 3;
  world.pendingEggs = 2;
  world.tiles[1][1] = 'soil';
  world.wateredTiles = new Set(['1,1']);
  const restored = restoreWorld(FREE_MODE, exportWorld(world));
  assert.equal(restored.day, 7);
  assert.equal(restored.straw, 3);
  assert.equal(restored.pendingEggs, 2);
  assert.equal(restored.tiles[1][1], 'soil');
  assert.equal(restored.wateredTiles.has('1,1'), true);
  assert.equal(countChickens(restored), 2);
});

check('损坏的自由农场存档会安全重建', () => {
  const restored = restoreWorld(FREE_MODE, { tiles: [['坏数据']] });
  assert.equal(restored.height, FREE_MODE.map.length);
  assert.equal(countChickens(restored), 2);
  assert.equal(restored.day, 1);
});

// ------------------------------------------------------------ 结果

console.log(`\n通过 ${passed} 项，失败 ${failed} 项。`);
if (failures.length > 0) {
  console.log('\n' + failures.join('\n\n'));
  process.exitCode = 1;
}
