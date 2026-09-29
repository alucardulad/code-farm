/**
 * 关卡自检：把每个关卡的参考解真正跑一遍。
 * 参照《地牢围攻》的做法——设计出来的关卡必须能过，否则直接测试失败。
 *
 * 运行：node tests/levels.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, CHAPTERS, FREE_MODE } from '../src/core/levels.js';
import {
  createWorld,
  checkGoal,
  countChickens,
  countCows,
  readyCowsNear,
  exportWorld,
  restoreWorld,
  isNearMarket,
  hasEnoughStraw,
  canWalk,
  testCondition,
  MARKET_PRICES,
} from '../src/core/world.js';
import { runProgram } from '../src/core/runner.js';
import { paintFrame } from '../src/core/render.js';
import { TUTOR_LINES, TUTOR_VOICE, CHAPTER_INTRO, tutorLineHashes } from '../src/core/tutor-lines.js';

const VOICE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'voice');
const VOICE_MANIFEST = join(VOICE_DIR, 'voice-manifest.json');

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

check('关卡数量是 44', () => assert.equal(LEVELS.length, 44));
check('章节数量是 8', () => assert.equal(CHAPTERS.length, 8));
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

check('配音和关卡提示保持同步（指纹清单）', () => {
  assert.ok(existsSync(VOICE_MANIFEST), '缺少 voice-manifest.json，请运行：node tools/generate_tutor_voice.mjs');
  const manifest = JSON.parse(readFileSync(VOICE_MANIFEST, 'utf8'));
  const current = tutorLineHashes();
  const stale = Object.entries(current)
    .filter(([key, hash]) => manifest[key] !== hash)
    .map(([key]) => key);
  assert.equal(
    stale.length, 0,
    `这些提示改了但配音没重新生成：${stale.join('、')}。请运行：node tools/generate_tutor_voice.mjs --only=${stale.join(',')}`,
  );
});

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

await checkAsync('第一章拦住「挤奶」并引导到第 4 章', async () => {
  const level = LEVELS.find((item) => item.id === 'level-1');
  const world = createWorld(level);
  const result = await runProgram(world, '挤奶', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  assert.match(world.lastError.message, /第 4 章/);
});

await checkAsync('第二章拦住「喂鸡」并引导到第 4 章', async () => {
  const level = LEVELS.find((item) => item.id === 'level-11');
  const world = createWorld(level);
  const result = await runProgram(world, '喂鸡', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  assert.match(world.lastError.message, /第 4 章/);
});

await checkAsync('第三章拦住「收鸡蛋」并引导到第 4 章', async () => {
  const level = LEVELS.find((item) => item.id === 'level-17');
  const world = createWorld(level);
  const result = await runProgram(world, '收鸡蛋', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  assert.match(world.lastError.message, /第 4 章/);
});

await checkAsync('第二章拦住「如果」并给出教学提示', async () => {
  const level = LEVELS.find((item) => item.id === 'level-11');
  const world = createWorld(level);
  const result = await runProgram(world, '重复 9 次 {\n  如果 脚下是草地 {\n    翻土\n  }\n}', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
});

await checkAsync('「否则」条件不成立时走另一条路', async () => {
  const level = LEVELS.find((item) => item.id === 'level-33');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.tilled, 1, '脚下不是熟麦，应该走「否则」翻土');
  assert.equal(world.harvested, 0);
});

await checkAsync('「否则」条件成立时只走「如果」那条路', async () => {
  const level = LEVELS.find((item) => item.id === 'level-33');
  const wheatLevel = {
    ...level,
    goal: { harvest: 1 },
    map: level.map.map((row, y) => (y === 1 ? row.replace('@', '&') : row)),
  };
  const world = createWorld(wheatLevel);
  const result = await runProgram(world, '如果 脚下是成熟小麦 {\n  收获\n}\n否则 {\n  翻土\n}', {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.harvested, 1, '脚下是熟麦，应该走「如果」收获');
  assert.equal(world.tilled, 0, '条件成立时不该走「否则」');
});

await checkAsync('「否则」没跟在「如果」后面会报错', async () => {
  const level = LEVELS.find((item) => item.id === 'level-33');
  const world = createWorld(level);
  const result = await runProgram(world, '否则 {\n  翻土\n}', {});
  assert.equal(result.ok, false);
  assert.match(world.lastError.message, /否则/);
});

await checkAsync('前面几章用「否则」会被教学拦截', async () => {
  const level = LEVELS.find((item) => item.id === 'level-20');
  const world = createWorld(level);
  const result = await runProgram(world, '如果 脚下是成熟小麦 {\n  收获\n}\n否则 {\n  翻土\n}', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  assert.match(world.message, /第 6 章/);
});

await checkAsync('第 36 关大农场收官能一把过', async () => {
  const level = LEVELS.find((item) => item.id === 'level-36');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.eggs, 2);
  assert.equal(world.milk, 1);
  assert.equal(world.straw, 0, '稻草应该刚好喂完');
});

check('集市建筑会挡住去路，但旁边可以买卖', () => {
  const level = LEVELS.find((item) => item.id === 'level-37');
  const world = createWorld(level);
  const market = world.structures.find((structure) => structure.kind === 'market');
  assert.ok(market, '第 37 关应该有集市');
  world.hero.x = market.x;
  world.hero.y = market.y + market.height;
  assert.equal(isNearMarket(world), true, '站在集市旁边应该能买卖');
  world.hero.x = 1;
  world.hero.y = 1;
  assert.equal(isNearMarket(world), false, '离得远就不能买卖');
});

await checkAsync('「卖出」把鸡蛋牛奶小麦换成金币', async () => {
  const world = createWorld(FREE_MODE);
  const market = world.structures.find((structure) => structure.kind === 'market');
  world.hero.x = market.x;
  world.hero.y = market.y + market.height;
  world.eggs = 3;
  world.milk = 2;
  world.wheat = 4;
  const coins = world.coins;
  const result = await runProgram(world, '卖出', {});
  assert.equal(result.ok, true, world.message);
  const expected = 3 * MARKET_PRICES.sellEgg + 2 * MARKET_PRICES.sellMilk + 4 * MARKET_PRICES.sellWheat;
  assert.equal(world.coins - coins, expected);
  assert.equal(world.eggs, 0);
  assert.equal(world.milk, 0);
  assert.equal(world.wheat, 0);
});

await checkAsync('背包空空的「卖出」会被拦住', async () => {
  const world = createWorld(FREE_MODE);
  const market = world.structures.find((structure) => structure.kind === 'market');
  world.hero.x = market.x;
  world.hero.y = market.y + market.height;
  world.eggs = 0;
  world.milk = 0;
  world.wheat = 0;
  const result = await runProgram(world, '卖出', {});
  assert.equal(result.ok, true, world.message);
  assert.match(world.message, /没有可以卖的东西/);
});

await checkAsync('「买种子」花金币换种子，钱不够会被拦住', async () => {
  const world = createWorld(FREE_MODE);
  const market = world.structures.find((structure) => structure.kind === 'market');
  world.hero.x = market.x;
  world.hero.y = market.y + market.height;
  world.coins = 10;
  world.seeds = 0;
  const result = await runProgram(world, '买种子', {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.coins, 10 - MARKET_PRICES.seedCost);
  assert.equal(world.seeds, MARKET_PRICES.seedAmount);

  world.coins = 1;
  const before = world.seeds;
  const poor = await runProgram(world, '买种子', {});
  assert.equal(poor.ok, true);
  assert.equal(world.seeds, before, '金币不够时不该拿到种子');
  assert.match(world.message, /金币不够/);
});

await checkAsync('「买稻草」花金币换稻草', async () => {
  const world = createWorld(FREE_MODE);
  const market = world.structures.find((structure) => structure.kind === 'market');
  world.hero.x = market.x;
  world.hero.y = market.y + market.height;
  world.coins = 8;
  world.straw = 0;
  const result = await runProgram(world, '买稻草', {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.coins, 8 - MARKET_PRICES.strawCost);
  assert.equal(world.straw, MARKET_PRICES.strawAmount);
});

await checkAsync('离集市太远时买卖会被拦住', async () => {
  const world = createWorld(FREE_MODE);
  world.hero.x = 1;
  world.hero.y = 1;
  const result = await runProgram(world, '卖出', {});
  assert.equal(result.ok, true, world.message);
  assert.match(world.message, /走到集市旁边/);
});

check('「稻草足够」按饿着的动物数量判断', () => {
  const world = createWorld(FREE_MODE);
  // 自由农场 3 鸡 + 3 牛，开局全都没喂
  world.straw = 0;
  assert.equal(hasEnoughStraw(world), false);
  world.straw = 6;
  assert.equal(hasEnoughStraw(world), true, '6 捆刚好够 3 鸡 + 3 牛');
  world.straw = 5;
  assert.equal(hasEnoughStraw(world), false);
  for (const animal of world.animals) animal.fedToday = true;
  assert.equal(hasEnoughStraw(world), true, '都喂饱了，0 捆也算够');
});

await checkAsync('「稻草足够」条件能走两条不同的路', async () => {
  const level = LEVELS.find((item) => item.id === 'level-40');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.fedChickensTotal, 3, '稻草不够时先去集市买，再喂鸡');
  assert.equal(world.eggs, 3);
});

await checkAsync('前六章用集市指令会被教学拦截', async () => {
  const level = LEVELS.find((item) => item.id === 'level-20');
  const world = createWorld(level);
  const result = await runProgram(world, '卖出', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  assert.match(world.message, /第 7 章/);
});

await checkAsync('第 37 关收蛋卖钱能达标', async () => {
  const level = LEVELS.find((item) => item.id === 'level-37');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.soldCoins, 12);
  assert.equal(world.eggs, 0, '鸡蛋应该都卖掉了');
});

// ------------------------------------------------------------ 重复直到

await checkAsync('「重复直到」条件一开始成立就一次也不做', async () => {
  const level = LEVELS.find((item) => item.id === 'level-41');
  const world = createWorld(level);
  // 让人站到熟麦那一格（x=4）：脚下是成熟小麦，条件一开始就成立
  world.hero.x = 4;
  world.hero.y = 1;
  const result = await runProgram(world, '重复直到 脚下是成熟小麦 {\n  左转\n}', {});
  assert.equal(world.lastError, null, '条件已经成立，不该报错');
  assert.equal(world.actions, 0, '条件成立时循环体一次都不该执行');
  assert.equal(result.reason, 'unfinished', '循环没干活，关卡目标自然还没达成');
});

await checkAsync('「重复直到」条件中途成立就停下来', async () => {
  const level = LEVELS.find((item) => item.id === 'level-41');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.harvested, 1);
  assert.equal(world.hero.x, 4, '应该正好停在熟麦那一格');
});

await checkAsync('「重复直到 到旗子了」走到旗子就停', async () => {
  const level = LEVELS.find((item) => item.id === 'level-42');
  const world = createWorld(level);
  const result = await runProgram(world, '重复直到 到旗子了 {\n  前进\n}', {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.hero.x, 5);
  assert.equal(world.hero.y, 1);
});

await checkAsync('条件永不成立时「重复直到」会被防死循环拦住', async () => {
  const level = LEVELS.find((item) => item.id === 'level-42');
  const world = createWorld(level);
  const result = await runProgram(world, '重复直到 脚下是成熟小麦 {\n  左转\n}', {});
  assert.equal(result.ok, false);
  assert.match(world.lastError.message, /条件还是一直没成立/);
});

await checkAsync('第 43 关「等到鸡下蛋」不用自己数天数', async () => {
  const level = LEVELS.find((item) => item.id === 'level-43');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.eggs, 2);
  assert.equal(world.day, 2, '条件一成立就停，不该白等好几天');
});

await checkAsync('第 44 关用循环把稻草买够就停', async () => {
  const level = LEVELS.find((item) => item.id === 'level-44');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.straw, 0, '买够 3 捆、喂完 3 只动物，正好用完');
  assert.equal(world.milk, 1);
});

await checkAsync('前七章用「重复直到」会被教学拦截', async () => {
  const level = LEVELS.find((item) => item.id === 'level-20');
  const world = createWorld(level);
  const result = await runProgram(world, '重复直到 脚下是草地 {\n  左转\n}', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  assert.match(world.message, /第 8 章/);
});

await checkAsync('第 1~7 章每一章都拦得住「重复直到」', async () => {
  // 第 5、6 章曾漏配 until，这里按章节逐个把关，防止以后再漏。
  for (const chapter of CHAPTERS.filter((item) => item.id !== 'ch8')) {
    const level = LEVELS.find((item) => item.chapter === chapter.id);
    const world = createWorld(level);
    const result = await runProgram(world, '重复直到 脚下是草地 {\n  左转\n}', {});
    assert.equal(result.reason, 'forbidden', `${chapter.id} 没拦住「重复直到」`);
    assert.match(world.message, /第 8 章/, `${chapter.id} 的提示没指向第 8 章`);
  }
});

check('「前方是成熟小麦」只看正前方一格', () => {
  const level = LEVELS.find((item) => item.id === 'level-41');
  const world = createWorld(level);
  // 地图第 1 行是「@..r」，熟麦在 x=4
  world.hero.x = 1;
  world.hero.y = 1;
  world.hero.facing = 1; // 朝右，正前方 x=2 是草地
  assert.equal(testCondition(world, '前方是成熟小麦'), false);
  world.hero.x = 3; // 正前方 x=4 就是熟麦
  assert.equal(testCondition(world, '前方是成熟小麦'), true);
  world.hero.facing = 3; // 转过身看左边（草地）
  assert.equal(testCondition(world, '前方是成熟小麦'), false);
});

// ------------------------------------------------------------ 自由农场买动物

await checkAsync('自由农场能买鸡买牛扩大规模', async () => {
  const world = createWorld(FREE_MODE);
  const marketSpot = findMarketSpot(world);
  world.hero.x = marketSpot.x;
  world.hero.y = marketSpot.y;
  world.coins = 100;
  const chickens = countChickens(world);
  const cows = countCows(world);
  const result = await runProgram(world, '买鸡\n买牛', {});
  assert.equal(result.ok, true, world.message);
  assert.equal(countChickens(world), chickens + 1);
  assert.equal(countCows(world), cows + 1);
  assert.equal(world.coins, 100 - MARKET_PRICES.chickenCost - MARKET_PRICES.cowCost);
});

await checkAsync('新买的动物也要吃饭，稻草足够会跟着变', async () => {
  const world = createWorld(FREE_MODE);
  const marketSpot = findMarketSpot(world);
  world.hero.x = marketSpot.x;
  world.hero.y = marketSpot.y;
  world.coins = 100;
  world.straw = 6; // 够原来的 3 鸡 + 3 牛
  assert.equal(hasEnoughStraw(world), true);
  await runProgram(world, '买鸡', {});
  assert.equal(hasEnoughStraw(world), false, '多一张嘴，同样多的稻草就不够了');
});

await checkAsync('金币不够时买不了鸡，也不会扣钱', async () => {
  const world = createWorld(FREE_MODE);
  const marketSpot = findMarketSpot(world);
  world.hero.x = marketSpot.x;
  world.hero.y = marketSpot.y;
  world.coins = 1;
  const chickens = countChickens(world);
  const result = await runProgram(world, '买鸡', {});
  assert.equal(result.ok, true, world.message);
  assert.equal(countChickens(world), chickens, '钱不够不该多出鸡');
  assert.equal(world.coins, 1, '钱不够不该扣金币');
  assert.match(world.message, /金币不够/);
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

// ------------------------------------------------------------ 自由模式

// ------------------------------------------------------------ 渲染冒烟

/**
 * 用桩 context 把每张地图都画一帧。
 * 以前「集市」这种新建筑少写一个参数，会让整帧渲染直接抛异常、
 * 画面只剩天空，而所有逻辑测试都照样通过——所以这里必须画一遍。
 */
check('每张地图都能画出一帧（渲染冒烟）', () => {
  const noop = () => {};
  const makeCtx = () => ({
    canvas: { width: 800, height: 600 },
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop, ellipse: noop, rect: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop,
    drawImage: noop, translate: noop, rotate: noop, scale: noop, clip: noop, setTransform: noop,
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: [] }), putImageData: noop, createPattern: () => null,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, globalCompositeOperation: 'source-over',
  });

  for (const level of [...LEVELS, FREE_MODE]) {
    const world = createWorld(level);
    const anim = {
      heroX: world.hero.x, heroY: world.hero.y, walking: false,
      time: 0, now: 0, effects: [], heroKind: 'boy',
    };
    assert.doesNotThrow(
      () => paintFrame(makeCtx(), world, { tile: 48, ox: 0, oy: 0 }, anim),
      `${level.id} 渲染失败`,
    );
  }
});

/** 找一个满足条件的可走格子，避免测试写死坐标。 */
function findSpot(world, { nearCoop = false, nearKind = null, nearMarket = false } = {}) {
  const coop = (world.structures ?? []).find((structure) => structure.kind === 'coop');
  const market = (world.structures ?? []).find((structure) => structure.kind === 'market');
  const near = (structure, x, y) => {
    if (!structure) return false;
    for (let yy = structure.y; yy < structure.y + structure.height; yy += 1) {
      for (let xx = structure.x; xx < structure.x + structure.width; xx += 1) {
        if (Math.abs(x - xx) + Math.abs(y - yy) === 1) return true;
      }
    }
    return false;
  };
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (!canWalk(world, x, y).ok) continue;
      if (nearCoop && !near(coop, x, y)) continue;
      if (nearMarket && !near(market, x, y)) continue;
      if (nearKind && !world.animals.some((a) => a.kind === nearKind && Math.abs(a.x - x) + Math.abs(a.y - y) === 1)) continue;
      return { x, y };
    }
  }
  return null;
}

function findMarketSpot(world) {
  return findSpot(world, { nearMarket: true });
}

check('自由农场地图和初始鸡群有效', () => {
  const world = createWorld(FREE_MODE);
  const width = FREE_MODE.map[0].length;
  assert.ok(FREE_MODE.map.every((row) => row.length === width), '自由农场地图不是矩形');
  assert.equal(countChickens(world), 3);
  assert.equal(countCows(world), 3);
  assert.ok(world.structures.some((structure) => structure.kind === 'coop'), '缺少鸡舍');
  assert.equal(world.straw, 0);
  assert.equal(world.pendingEggs, 0);
  assert.equal(
    world.animals.filter((a) => a.kind === 'cow' && a.milkReady === false).length, 1,
    '自由农场应该留一头今天没奶的牛，方便试「喂牛」',
  );
});

check('牧场章节的教学关卡配好了鸡群与奶牛', () => {
  const pasture = LEVELS.filter((level) => level.chapter === 'ch4');
  assert.equal(pasture.length, 6, '第 4 章应该是 6 关');
  const withChicken = pasture.filter((level) => createWorld(level).animals.some((a) => a.kind === 'chicken'));
  assert.ok(withChicken.length >= 4, '多数牧场关卡应该有鸡');
  const withCow = pasture.filter((level) => createWorld(level).animals.some((a) => a.kind === 'cow'));
  assert.ok(withCow.length >= 3, '多数牧场关卡应该有奶牛');
});

check('牧场指令在第 4 章才解锁', () => {
  const pasture = LEVELS.filter((level) => level.chapter === 'ch4');
  const commands = new Set(pasture.flatMap((level) => level.newCommands ?? []));
  for (const name of ['喂鸡', '收鸡蛋', '喂牛', '挤奶']) {
    assert.ok(commands.has(name), `第 4 章应该教「${name}」`);
  }
  const pastureCommands = ['喂鸡', '收鸡蛋', '喂牛', '挤奶'];
  for (const level of LEVELS) {
    if (level.chapter === 'ch4' || level.chapter === 'ch5' || level.chapter === 'ch6' || level.mode === 'free') continue;
    assert.ok(
      !(level.newCommands ?? []).some((name) => pastureCommands.includes(name)),
      `${level.id} 不该提前教牧场指令`,
    );
  }
});

await checkAsync('前三章拦住「喂牛」并引导到第 4 章', async () => {
  const level = LEVELS.find((item) => item.id === 'level-9');
  const world = createWorld(level);
  const result = await runProgram(world, '喂牛', {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'forbidden');
  assert.match(world.message, /牧场/);
});

check('奶牛每天只有一瓶奶', () => {
  const world = createWorld(FREE_MODE);
  const cow = world.animals.find((animal) => animal.kind === 'cow');
  world.hero.x = cow.x;
  world.hero.y = cow.y + 1;
  assert.equal(readyCowsNear(world).length, 1);
  world.animals.forEach((animal) => { if (animal.kind === 'cow') animal.milkReady = false; });
  assert.equal(readyCowsNear(world).length, 0);
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
  assert.equal(world.eggs, 3);
  assert.equal(world.day, 2);
});

await checkAsync('自由农场完整农牧闭环可用', async () => {
  // 种四格小麦 → 收成换稻草 → 喂鸡喂牛 → 等一天 → 收鸡蛋、挤奶
  const world = createWorld(FREE_MODE);
  const farmSpot = findSpot(world, { nearCoop: true, nearKind: 'cow' });
  const program = `重复 4 次 {
  翻土
  播种
  浇水
  前进
}
等待一天
后退 4
重复 4 次 {
  收获
  前进
}
后退 3
右转
前进 2
喂鸡
喂牛
等待一天
收鸡蛋
挤奶`;
  const result = await runProgram(world, program, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.day, 3);
  assert.ok(world.wheat >= 3, `应该收到至少 3 株小麦，实际 ${world.wheat}`);
  assert.ok(world.eggs >= 3, `3 只鸡应该下 3 枚蛋，实际 ${world.eggs}`);
  assert.ok(farmSpot, '自由农场应该有同时挨着鸡舍和牛的格子');
});

await checkAsync('自由农场能在集市把收成换成金币', async () => {
  const world = createWorld(FREE_MODE);
  const marketSpot = findMarketSpot(world);
  world.hero.x = marketSpot.x;
  world.hero.y = marketSpot.y;
  world.eggs = 4;
  world.milk = 2;
  const before = world.coins;
  const result = await runProgram(world, '卖出\n买稻草', {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.coins, before + 4 * MARKET_PRICES.sellEgg + 2 * MARKET_PRICES.sellMilk - MARKET_PRICES.strawCost);
  assert.equal(world.straw, MARKET_PRICES.strawAmount);
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

await checkAsync('自由农场没走近奶牛挤不出奶', async () => {
  const world = createWorld(FREE_MODE);
  const result = await runProgram(world, '挤奶', {});
  assert.equal(result.ok, true);
  assert.equal(world.milk, 0);
  assert.match(world.message, /走到奶牛旁边/);
});

await checkAsync('教学关也能喂鸡，稻草不再只在自由模式产出', async () => {
  const level = LEVELS.find((item) => item.id === 'level-23');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true);
  assert.equal(world.straw, 0, '稻草应该都喂给鸡了');
  assert.equal(world.fedChickens, 1);
  assert.equal(world.harvested, 1);
});

await checkAsync('挤奶指令能挤到牛奶', async () => {
  const level = LEVELS.find((item) => item.id === 'level-25');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true);
  assert.equal(world.milk, 2);
  assert.ok(world.animals.filter((animal) => animal.kind === 'cow').every((cow) => cow.milkReady === false));
  assert.match(world.message, /牛奶/);
});

await checkAsync('挤过的牛要喂饱并等一天才有新奶', async () => {
  const world = createWorld(FREE_MODE);
  const cow = world.animals.find((animal) => animal.kind === 'cow');
  world.hero.x = cow.x;
  world.hero.y = cow.y + 1;
  world.straw = 4;
  const result = await runProgram(world, '挤奶\n等待一天\n挤奶', {});
  assert.equal(result.ok, true);
  assert.equal(world.milk, 1, '没喂稻草，第二天不会有新奶');
});

await checkAsync('喂牛之后等一天就有新奶', async () => {
  const world = createWorld(FREE_MODE);
  const cow = world.animals.find((animal) => animal.kind === 'cow');
  world.hero.x = cow.x;
  world.hero.y = cow.y + 1;
  world.straw = 4;
  const result = await runProgram(world, '挤奶\n喂牛\n等待一天\n挤奶', {});
  assert.equal(result.ok, true);
  assert.equal(world.milk, 2, '喂饱的牛第二天应该有一瓶新奶');
  assert.equal(world.straw, 3, '一头牛吃掉 1 捆稻草');
});

await checkAsync('稻草不够时喂牛被拦住', async () => {
  const world = createWorld(FREE_MODE);
  const cow = world.animals.find((animal) => animal.kind === 'cow');
  world.hero.x = cow.x;
  world.hero.y = cow.y + 1;
  world.straw = 0;
  const result = await runProgram(world, '喂牛', {});
  assert.equal(result.ok, true);
  assert.equal(world.fedCowsTotal ?? 0, 0);
  assert.match(world.message, /稻草不够/);
});

await checkAsync('「奶牛可以挤奶」条件能判断真假', async () => {
  const world = createWorld(FREE_MODE);
  const cow = world.animals.find((animal) => animal.kind === 'cow');
  world.hero.x = cow.x;
  world.hero.y = cow.y + 1;
  const result = await runProgram(world, '如果 奶牛可以挤奶 {\n  挤奶\n}', {});
  assert.equal(result.ok, true);
  assert.equal(world.milk, 1, '牛有奶时条件为真');
  world.animals.forEach((animal) => { if (animal.kind === 'cow') animal.milkReady = false; });
  const again = await runProgram(world, '如果 奶牛可以挤奶 {\n  挤奶\n}', {});
  assert.equal(again.ok, true);
  assert.equal(world.milk, 1, '牛没奶时条件为假，不会挤奶');
});

await checkAsync('「鸡舍里有鸡蛋」条件能判断真假', async () => {
  const world = createWorld(FREE_MODE);
  const coop = world.structures.find((structure) => structure.kind === 'coop');
  world.hero.x = coop.x;
  world.hero.y = coop.y + 1;
  world.pendingEggs = 2;
  const result = await runProgram(world, '如果 鸡舍里有鸡蛋 {\n  收鸡蛋\n}', {});
  assert.equal(result.ok, true);
  assert.equal(world.eggs, 2, '有蛋时条件为真');
  const again = await runProgram(world, '如果 鸡舍里有鸡蛋 {\n  收鸡蛋\n}', {});
  assert.equal(again.ok, true);
  assert.equal(world.eggs, 2, '没蛋时条件为假，不会收');
});

await checkAsync('第 26 关能完成「喂牛 → 等一天 → 挤奶」闭环', async () => {
  const level = LEVELS.find((item) => item.id === 'level-26');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.fedCowsTotal, 1);
  assert.equal(world.milk, 1);
});

await checkAsync('第 31 关用判断跳过了没奶的牛', async () => {
  const level = LEVELS.find((item) => item.id === 'level-31');
  const world = createWorld(level);
  const result = await runProgram(world, level.solution, {});
  assert.equal(result.ok, true, world.message);
  assert.equal(world.milk, 2, '三头牛里只有两头有奶');
});

await checkAsync('教学关的鸡没喂饱就不下新蛋', async () => {
  const level = LEVELS.find((item) => item.id === 'level-24');
  const world = createWorld(level);
  assert.equal(world.pendingEggs, 3, '这一关预置了 3 枚蛋');
  const result = await runProgram(world, '等待一天', {});
  assert.equal(result.ok, false);
  assert.equal(world.pendingEggs, 3, '没喂鸡就不会攒下新蛋');
  assert.equal(world.eggs, 0, '鸡蛋还留在鸡舍里，没走近就收不了');
  assert.equal(world.day, 2);
});

check('自由农场状态可以保存并恢复', () => {
  const world = createWorld(FREE_MODE);
  world.day = 7;
  world.straw = 3;
  world.pendingEggs = 2;
  world.milk = 4;
  world.tiles[1][1] = 'soil';
  world.wateredTiles = new Set(['1,1']);
  const restored = restoreWorld(FREE_MODE, exportWorld(world));
  assert.equal(restored.day, 7);
  assert.equal(restored.straw, 3);
  assert.equal(restored.pendingEggs, 2);
  assert.equal(restored.milk, 4);
  assert.equal(restored.tiles[1][1], 'soil');
  assert.equal(restored.wateredTiles.has('1,1'), true);
  assert.equal(countChickens(restored), 3);
  assert.equal(countCows(restored), 3);
});

check('损坏的自由农场存档会安全重建', () => {
  const restored = restoreWorld(FREE_MODE, { tiles: [['坏数据']] });
  assert.equal(restored.height, FREE_MODE.map.length);
  assert.equal(countChickens(restored), 3);
  assert.equal(restored.day, 1);
});

// ------------------------------------------------------------ 引导文案一致性

/** 关卡文案里可能出现的指令词，长的排前面，避免「重复直到」被「重复」抢先匹配。 */
const CMD_TOKENS = [
  '重复直到', '收鸡蛋', '等待一天', '稻草足够', '买稻草', '买种子', '买鸡', '买牛',
  '前进', '后退', '左转', '右转', '翻土', '播种', '浇水', '收获',
  '喂鸡', '喂牛', '挤奶', '卖出', '否则', '重复', '如果',
];

/** 每个指令第一次被教的关卡下标：{ 指令: 关卡下标 }。 */
const commandIntro = new Map();
LEVELS.forEach((level, index) => {
  for (const command of level.newCommands ?? []) {
    const token = CMD_TOKENS.find((candidate) => command.includes(candidate));
    if (token && !commandIntro.has(token)) commandIntro.set(token, index);
  }
});

check('关卡文案不会提前提到还没教过的指令', () => {
  const bad = [];
  LEVELS.forEach((level, index) => {
    const text = [level.name, level.subtitle, level.objective, ...(level.hints ?? [])].join('\n');
    for (const token of CMD_TOKENS) {
      if (!text.includes(token)) continue;
      const intro = commandIntro.get(token);
      if (intro === undefined || intro > index) {
        bad.push(`${level.id} 提到了还没教的「${token}」（第一次教在第 ${intro === undefined ? '？' : intro + 1} 关）`);
      }
    }
  });
  assert.equal(bad.length, 0, bad.join('\n'));
});

check('关卡文案提到的建筑和动物，地图上真的存在', () => {
  const REQUIRED = [
    { word: '小屋', chars: ['H'] },
    { word: '集市', chars: ['M'] },
    { word: '鸡舍', chars: ['C'] },
    { word: '谷仓', chars: ['B'] },
    { word: '水井', chars: ['W'] },
    { word: '池塘', chars: ['~'] },
    { word: '奶牛', chars: ['m', 'n'] },
  ];
  const bad = [];
  for (const level of [...LEVELS, FREE_MODE]) {
    const text = [level.name, level.subtitle, level.objective, ...(level.hints ?? [])].join('\n');
    const mapText = level.map.join('');
    for (const { word, chars } of REQUIRED) {
      if (!text.includes(word)) continue;
      if (!chars.some((char) => mapText.includes(char))) {
        bad.push(`${level.id} 的文案提到「${word}」，但地图上没有`);
      }
    }
  }
  assert.equal(bad.length, 0, bad.join('\n'));
});

check('数格提示口径一致：从脚下开始数，走一步数 1', () => {
  // 曾经写过「和旗子之间隔了几格」——那比实际步数少 1，孩子照着写就会差一格。
  const AMBIGUOUS = ['隔了几格', '之间有几格空地', '隔的格数'];
  const bad = [];
  for (const level of LEVELS) {
    const text = [level.objective, ...(level.hints ?? [])].join('\n');
    for (const phrase of AMBIGUOUS) {
      if (text.includes(phrase)) bad.push(`${level.id} 用了容易数错的说法「${phrase}」`);
    }
  }
  assert.equal(bad.length, 0, bad.join('\n'));
});

check('单步移动关的步数等于地图上的真实距离', () => {
  const HERO_CHARS = ['@', '$', '%', '&'];
  const bad = [];
  for (const level of LEVELS) {
    const code = level.solution.replace(/(\/\/|#|＃).*$/gm, '').trim();
    const single = code.match(/^(前进|后退)\s*(\d*)$/);
    if (!single) continue;

    let hero = null;
    let goal = null;
    level.map.forEach((row, y) => {
      [...row].forEach((char, x) => {
        if (HERO_CHARS.includes(char)) hero = { x, y };
        if (char === 'G') goal = { x, y };
      });
    });
    if (!hero || !goal) continue;

    const steps = single[2] ? Number(single[2]) : 1;
    const distance = Math.abs(hero.x - goal.x) + Math.abs(hero.y - goal.y);
    const straight = hero.x === goal.x || hero.y === goal.y;
    if (!straight) bad.push(`${level.id} 不是直线，却只写了一行移动`);
    else if (steps !== distance) bad.push(`${level.id} 写了 ${single[1]} ${steps}，但地图上要走 ${distance} 格`);
  }
  assert.equal(bad.length, 0, bad.join('\n'));
});

check('每个章节都有章前小课堂文案', () => {
  for (const chapter of CHAPTERS) {
    const intro = CHAPTER_INTRO[chapter.id];
    assert.ok(intro, `${chapter.id} 缺少章前小课堂`);
    assert.ok(intro.title && intro.body && intro.sample, `${chapter.id} 的章前小课堂字段不完整`);
    assert.ok(TUTOR_LINES[`chapter-${chapter.id}`]?.text, `${chapter.id} 缺少章前小课堂配音台词`);
  }
});

// ------------------------------------------------------------ 结果

console.log(`\n通过 ${passed} 项，失败 ${failed} 项。`);
if (failures.length > 0) {
  console.log('\n' + failures.join('\n\n'));
  process.exitCode = 1;
}
