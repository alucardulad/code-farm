/**
 * 农场世界：与画面完全无关的纯逻辑。
 * 谁站在哪、能不能走、种子下不下得去、小麦熟了没有，全都在这里结算。
 *
 * 地图图例：
 *   ' ' 草地    '.' 草地（写作点便于对齐）   '_' 已经翻好的土
 *   's' 幼苗    'r' 成熟小麦                '@' 出生点（每关一个）
 *   '#' 栅栏    'T' 树      'R' 石头        'W' 水井
 *   'H' 小屋    'B' 谷仓（占 2×2，字符为左下角）
 *   'C' 鸡舍（占 2×1，字符为左下角）
 *   '~' 池塘
 *   'c' 小鸡    'm' 奶牛
 */

/** 地形类型，决定能不能走、能不能种。 */
export const TILE = {
  GRASS: 'grass',
  SOIL: 'soil',
  SEEDLING: 'seedling',
  WHEAT: 'wheat',
  FENCE: 'fence',
  TREE: 'tree',
  ROCK: 'rock',
  WELL: 'well',
  HOUSE: 'house',
  BARN: 'barn',
  COOP: 'coop',
  WATER: 'water',
  FLAG: 'flag',
};

/** 走不过去的地形。 */
const BLOCKING = new Set([
  TILE.FENCE,
  TILE.TREE,
  TILE.ROCK,
  TILE.WELL,
  TILE.HOUSE,
  TILE.BARN,
  TILE.COOP,
  TILE.WATER,
]);

/** 可以翻土的地形：只有草地能被开垦。 */
const TILLABLE = new Set([TILE.GRASS]);

const TILE_ALIASES = {
  ' ': TILE.GRASS,
  '.': TILE.GRASS,
  _: TILE.SOIL,
  s: TILE.SEEDLING,
  r: TILE.WHEAT,
  '#': TILE.FENCE,
  T: TILE.TREE,
  R: TILE.ROCK,
  W: TILE.WELL,
  H: TILE.HOUSE,
  B: TILE.BARN,
  C: TILE.COOP,
  '~': TILE.WATER,
  G: TILE.FLAG,
};

/** 朝向：0 上（北）1 右（东）2 下（南）3 左（西）。 */
export const DIRS = [
  { dx: 0, dy: -1, name: '上' },
  { dx: 1, dy: 0, name: '右' },
  { dx: 0, dy: 1, name: '下' },
  { dx: -1, dy: 0, name: '左' },
];

export const TILE_NAME = {
  [TILE.GRASS]: '草地',
  [TILE.SOIL]: '翻好的土',
  [TILE.SEEDLING]: '幼苗',
  [TILE.WHEAT]: '成熟小麦',
  [TILE.FENCE]: '栅栏',
  [TILE.TREE]: '大树',
  [TILE.ROCK]: '石头',
  [TILE.WELL]: '水井',
  [TILE.HOUSE]: '小屋',
  [TILE.BARN]: '谷仓',
  [TILE.COOP]: '鸡舍',
  [TILE.WATER]: '池塘',
  [TILE.FLAG]: '目标点',
};

export class WorldError extends Error {
  constructor(message, tip = '') {
    super(message);
    this.name = 'WorldError';
    this.tip = tip;
  }
}

/** 把 ASCII 地图解析成世界状态。 */
export function createWorld(level) {
  const rows = level.map;
  const height = rows.length;
  const width = rows[0].length;

  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`关卡 ${level.id} 的地图不是矩形：每行长度必须一致`);
    }
  }

  const tiles = [];
  const animals = [];
  const structures = [];
  let heroPos = null;
  let goalPos = null;

  rows.forEach((row, y) => {
    const line = [];
    for (let x = 0; x < row.length; x += 1) {
      const char = row[x];
      if (char === '@' || char === '$' || char === '%' || char === '&') {
        if (heroPos) throw new Error(`关卡 ${level.id} 出现了两个出生点`);
        heroPos = { x, y };
        // 出生点可以站在草地、泥土、幼苗或熟麦上。
        const standing = char === '$' ? TILE.SOIL : char === '%' ? TILE.SEEDLING : char === '&' ? TILE.WHEAT : TILE.GRASS;
        line.push(standing);
        continue;
      }
      if (char === 'c' || char === 'm') {
        line.push(TILE.GRASS);
        animals.push({ kind: char === 'c' ? 'chicken' : 'cow', x, y, phase: (x * 7 + y * 13) % 100 });
        continue;
      }
      if (char === 'G') {
        if (goalPos) throw new Error(`关卡 ${level.id} 出现了两个目标点`);
        goalPos = { x, y };
        line.push(TILE.GRASS);
        continue;
      }
      if (char === 'H' || char === 'B' || char === 'C') {
        const kind = char === 'H' ? TILE.HOUSE : char === 'B' ? TILE.BARN : TILE.COOP;
        const structureWidth = 2;
        const structureHeight = char === 'C' ? 1 : 2;
        const structure = { kind, x, y: y - (structureHeight - 1), width: structureWidth, height: structureHeight };
        if (structure.y < 0 || structure.x + structure.width > width || structure.y + structure.height > height) {
          throw new Error(`关卡 ${level.id} 的${TILE_NAME[kind]}超出了地图边界`);
        }
        structures.push(structure);
        line.push(TILE.GRASS);
        continue;
      }
      const tile = TILE_ALIASES[char];
      if (!tile) throw new Error(`关卡 ${level.id} 的地图里有不认识的字符「${char}」`);
      line.push(tile);
    }
    tiles.push(line);
  });

  if (!heroPos) throw new Error(`关卡 ${level.id} 没有出生点 '@'`);

  const occupied = new Set();
  for (const structure of structures) {
    for (let yy = structure.y; yy < structure.y + structure.height; yy += 1) {
      for (let xx = structure.x; xx < structure.x + structure.width; xx += 1) {
        const key = `${xx},${yy}`;
        if (occupied.has(key)) throw new Error(`关卡 ${level.id} 的多格建筑互相重叠`);
        if (tiles[yy][xx] !== TILE.GRASS) throw new Error(`关卡 ${level.id} 的多格建筑压住了地形`);
        if (animals.some((animal) => animal.x === xx && animal.y === yy)) throw new Error(`关卡 ${level.id} 的多格建筑压住了动物`);
        if (heroPos.x === xx && heroPos.y === yy) throw new Error(`关卡 ${level.id} 的多格建筑压住了出生点`);
        if (goalPos && goalPos.x === xx && goalPos.y === yy) throw new Error(`关卡 ${level.id} 的多格建筑压住了目标点`);
        occupied.add(key);
      }
    }
  }

  const counts = countTargets(level, tiles);

  return {
    level,
    width,
    height,
    tiles,
    animals,
    structures,
    goalPos,
    lastGoal: null,
    hero: { x: heroPos.x, y: heroPos.y, facing: level.startFacing ?? 1 },
    day: 1,
    coins: level.startCoins ?? 0,
    wheat: 0,
    seeds: level.startSeeds ?? 6,
    straw: level.startStraw ?? 0,
    eggs: 0,
    pendingEggs: 0,
    fedChickens: 0,
    milk: 0,
    tilled: 0,
    planted: 0,
    harvested: 0,
    watered: 0,
    counts,
    status: 'playing',
    actions: 0,
    message: level.objective,
    messageKind: 'info',
  };
}

/** 统计地图上初始有几株幼苗 / 熟麦，用于「全部收获」这类目标。 */
function countTargets(level, tiles) {
  let seedlings = 0;
  let wheat = 0;
  let grass = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile === TILE.SEEDLING) seedlings += 1;
      else if (tile === TILE.WHEAT) wheat += 1;
      else if (tile === TILE.GRASS) grass += 1;
    }
  }
  return { seedlings, wheat, grass, initialWheat: wheat };
}

export function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
  return world.tiles[y][x];
}

export function setTile(world, x, y, tile) {
  world.tiles[y][x] = tile;
}

export function animalAt(world, x, y) {
  return world.animals.find((animal) => animal.x === x && animal.y === y) ?? null;
}

/** 返回覆盖该格子的多格建筑。 */
export function structureAt(world, x, y) {
  return (world.structures ?? []).find((structure) => (
    x >= structure.x && x < structure.x + structure.width
    && y >= structure.y && y < structure.y + structure.height
  )) ?? null;
}

/** 当前农场里有几只鸡。 */
export function countChickens(world) {
  return world.animals.filter((animal) => animal.kind === 'chicken').length;
}

/** 小农夫是不是站在鸡舍的上下左右相邻格。 */
export function isNearCoop(world) {
  const { x, y } = world.hero;
  const coops = (world.structures ?? []).filter((structure) => structure.kind === TILE.COOP);
  return coops.some((coop) => {
    for (let yy = coop.y; yy < coop.y + coop.height; yy += 1) {
      for (let xx = coop.x; xx < coop.x + coop.width; xx += 1) {
        if (Math.abs(x - xx) + Math.abs(y - yy) === 1) return true;
      }
    }
    return false;
  });
}

/** 判断某个格子能不能走进去。 */
export function canWalk(world, x, y) {
  const tile = tileAt(world, x, y);
  if (tile === null) return { ok: false, reason: '前面是农场边界，出不去了' };
  const structure = structureAt(world, x, y);
  if (structure) return { ok: false, reason: `前面是${TILE_NAME[structure.kind]}，绕过去吧` };
  if (BLOCKING.has(tile)) return { ok: false, reason: `前面是${TILE_NAME[tile]}，绕过去吧` };
  const animal = animalAt(world, x, y);
  if (animal) {
    return { ok: false, reason: animal.kind === 'chicken' ? '小鸡挡在前面，换个方向吧' : '奶牛挡在前面，换个方向吧' };
  }
  return { ok: true };
}

/** 前进一格，返回事件。走不动不会报错，只提示。 */
function stepForward(world) {
  const dir = DIRS[world.hero.facing];
  const target = { x: world.hero.x + dir.dx, y: world.hero.y + dir.dy };
  const walkable = canWalk(world, target.x, target.y);
  if (!walkable.ok) return { kind: 'blocked', message: walkable.reason };
  const from = { x: world.hero.x, y: world.hero.y };
  world.hero.x = target.x;
  world.hero.y = target.y;
  return { kind: 'move', from, to: { ...target } };
}

function stepBackward(world) {
  const dir = DIRS[world.hero.facing];
  const target = { x: world.hero.x - dir.dx, y: world.hero.y - dir.dy };
  const walkable = canWalk(world, target.x, target.y);
  if (!walkable.ok) return { kind: 'blocked', message: walkable.reason };
  const from = { x: world.hero.x, y: world.hero.y };
  world.hero.x = target.x;
  world.hero.y = target.y;
  return { kind: 'move', from, to: { ...target } };
}

/**
 * 执行一条动作指令，返回这一动作产生的世界事件。
 * 事件交给渲染层变成动画，逻辑层自己不碰画面。
 */
export function applyAction(world, action) {
  world.actions += 1;
  const { x, y } = world.hero;

  switch (action.name) {
    case '前进': {
      const events = [];
      for (let i = 0; i < action.steps; i += 1) {
        const event = stepForward(world);
        events.push(event);
        if (event.kind === 'blocked') break;
      }
      return combine(world, events);
    }
    case '后退': {
      const events = [];
      for (let i = 0; i < action.steps; i += 1) {
        const event = stepBackward(world);
        events.push(event);
        if (event.kind === 'blocked') break;
      }
      return combine(world, events);
    }
    case '左转': {
      world.hero.facing = (world.hero.facing + 3) % 4;
      return [say(world, '向左转，现在面向' + DIRS[world.hero.facing].name)];
    }
    case '右转': {
      world.hero.facing = (world.hero.facing + 1) % 4;
      return [say(world, '向右转，现在面向' + DIRS[world.hero.facing].name)];
    }
    case '翻土': {
      const tile = tileAt(world, x, y);
      if (tile !== TILE.GRASS) {
        return [warn(world, `脚下是${TILE_NAME[tile] ?? '农场外'}，只能翻草地`)];
      }
      setTile(world, x, y, TILE.SOIL);
      world.tilled += 1;
      return [{ kind: 'till', x, y }, say(world, '翻好土了，可以播种')];
    }
    case '播种': {
      const tile = tileAt(world, x, y);
      if (!TILLABLE.has(tile) && tile !== TILE.SOIL) {
        if (tile === TILE.GRASS) {
          return [warn(world, '这块地还没翻过，先用「翻土」吧')];
        }
        return [warn(world, `脚下是${TILE_NAME[tile]}，种不下种子`)];
      }
      if (world.seeds <= 0) {
        return [warn(world, '种子用完了，收获小麦可以拿回 2 颗种子')];
      }
      world.seeds -= 1;
      setTile(world, x, y, TILE.SEEDLING);
      world.planted += 1;
      return [{ kind: 'plant', x, y }, say(world, '播下一颗种子，记得浇水才会长')];
    }
    case '浇水': {
      const tile = tileAt(world, x, y);
      if (tile !== TILE.SEEDLING) {
        if (tile === TILE.WHEAT) return [warn(world, '这株小麦已经熟了，直接收获吧')];
        return [warn(world, '这里没有幼苗要浇水')];
      }
      if (world.wateredTiles?.has?.(`${x},${y}`)) {
        return [say(world, '已经浇过水了，等一天就会长大')];
      }
      world.wateredTiles = world.wateredTiles ?? new Set();
      world.wateredTiles.add(`${x},${y}`);
      world.watered += 1;
      return [{ kind: 'water', x, y }, say(world, '浇完水了，等一天看看')];
    }
    case '收获': {
      const tile = tileAt(world, x, y);
      if (tile !== TILE.WHEAT) {
        if (tile === TILE.SEEDLING) return [warn(world, '幼苗还没熟，先浇水再等一天')];
        return [warn(world, '这里没有可以收获的小麦')];
      }
      setTile(world, x, y, TILE.SOIL);
      world.harvested += 1;
      world.wheat += 1;
      world.coins += 5;
      world.seeds += 2;
      if (world.level.mode === 'free') world.straw += 1;
      if (world.level.mode === 'free') {
        return [{ kind: 'harvest', x, y }, say(world, '收获一捆小麦！+5 金币，+2 颗种子，+1 捆稻草')];
      }
      return [{ kind: 'harvest', x, y }, say(world, '收获一捆小麦！+5 金币，+2 颗种子')];
    }
    case '喂鸡': {
      if (world.level.mode !== 'free') {
        return [warn(world, '「喂鸡」要在通关后的自由农场里使用')];
      }
      if (!isNearCoop(world)) {
        return [warn(world, '走到鸡舍旁边再喂鸡吧')];
      }
      const chickens = countChickens(world);
      if (chickens === 0) return [warn(world, '鸡舍里还没有鸡')];
      const alreadyFed = Math.min(world.fedChickens ?? 0, chickens);
      const hungry = chickens - alreadyFed;
      if (hungry === 0) return [say(world, '今天的鸡已经喂饱了，等明天再来吧')];
      if (world.straw < hungry) {
        return [warn(world, `稻草不够，还缺 ${hungry - world.straw} 捆。收获小麦可以得到稻草`)];
      }
      world.straw -= hungry;
      world.fedChickens = chickens;
      const coop = world.structures.find((structure) => structure.kind === TILE.COOP);
      return [
        { kind: 'feed', x: coop.x, y: coop.y, amount: hungry },
        say(world, `喂饱了 ${hungry} 只鸡。等一天后到鸡舍旁收鸡蛋`),
      ];
    }
    case '收鸡蛋': {
      if (world.level.mode !== 'free') {
        return [warn(world, '「收鸡蛋」要在通关后的自由农场里使用')];
      }
      if (!isNearCoop(world)) {
        return [warn(world, '走到鸡舍旁边再收鸡蛋吧')];
      }
      if (world.pendingEggs <= 0) {
        return [warn(world, '鸡舍里还没有鸡蛋，先喂鸡再等一天吧')];
      }
      const amount = world.pendingEggs;
      world.pendingEggs = 0;
      world.eggs += amount;
      const coop = world.structures.find((structure) => structure.kind === TILE.COOP);
      return [
        { kind: 'collectEgg', x: coop.x, y: coop.y, amount },
        say(world, `收到 ${amount} 枚鸡蛋！`),
      ];
    }
    case '等待一天': {
      return advanceDay(world);
    }
    default:
      throw new WorldError(`不认识的指令「${action.name}」`);
  }
}

/** 时间推进一天：浇过水的幼苗长成小麦，鸡下蛋，牛产奶。 */
export function advanceDay(world) {
  const events = [];
  const watered = world.wateredTiles ?? new Set();

  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (world.tiles[y][x] === TILE.SEEDLING && watered.has(`${x},${y}`)) {
        world.tiles[y][x] = TILE.WHEAT;
        watered.delete(`${x},${y}`);
        events.push({ kind: 'grow', x, y });
      }
    }
  }

  world.day += 1;
  const chickens = countChickens(world);
  const cows = world.animals.filter((animal) => animal.kind === 'cow').length;
  if (world.level.mode === 'free') {
    const fed = Math.min(world.fedChickens ?? 0, chickens);
    if (fed > 0) {
      world.pendingEggs += fed;
      const coop = world.structures.find((structure) => structure.kind === TILE.COOP);
      events.push({ kind: 'lay', x: coop?.x ?? world.hero.x, y: coop?.y ?? world.hero.y, amount: fed });
    }
    world.fedChickens = 0;
  } else if (chickens > 0) {
    world.eggs += chickens;
    events.push({ kind: 'collect', what: 'egg', amount: chickens });
  }
  if (world.level.mode !== 'free' && cows > 0) {
    world.milk += cows;
    events.push({ kind: 'collect', what: 'milk', amount: cows });
  }
  events.push({ kind: 'day' });
  events.push(say(world, `到了第 ${world.day} 天`));
  return events;
}

/** 判断条件，供「如果 ...」使用。 */
export function testCondition(world, condition) {
  const tile = tileAt(world, world.hero.x, world.hero.y);
  switch (condition) {
    case '脚下是草地':
      return tile === TILE.GRASS;
    case '脚下是泥土':
      return tile === TILE.SOIL;
    case '脚下有幼苗':
      return tile === TILE.SEEDLING;
    case '脚下是成熟小麦':
      return tile === TILE.WHEAT;
    default:
      throw new WorldError(`不认识的条件「${condition}」`);
  }
}

/** 检查关卡目标是否达成。 */
export function checkGoal(world) {
  const goal = world.level.goal;
  if (!goal) return { done: false, text: '' };

  const parts = [];
  let done = true;

  if (goal.harvest !== undefined) {
    const ok = world.harvested >= goal.harvest;
    done = done && ok;
    parts.push(`收获小麦 ${Math.min(world.harvested, goal.harvest)}/${goal.harvest}`);
  }
  if (goal.plant !== undefined) {
    const ok = world.planted >= goal.plant;
    done = done && ok;
    parts.push(`播种 ${Math.min(world.planted, goal.plant)}/${goal.plant}`);
  }
  if (goal.water !== undefined) {
    const ok = world.watered >= goal.water;
    done = done && ok;
    parts.push(`浇水 ${Math.min(world.watered, goal.water)}/${goal.water}`);
  }
  if (goal.egg !== undefined) {
    const ok = world.eggs >= goal.egg;
    done = done && ok;
    parts.push(`鸡蛋 ${Math.min(world.eggs, goal.egg)}/${goal.egg}`);
  }
  if (goal.milk !== undefined) {
    const ok = world.milk >= goal.milk;
    done = done && ok;
    parts.push(`牛奶 ${Math.min(world.milk, goal.milk)}/${goal.milk}`);
  }
  if (goal.till !== undefined) {
    const ok = world.tilled >= goal.till;
    done = done && ok;
    parts.push(`翻土 ${Math.min(world.tilled, goal.till)}/${goal.till}`);
  }
  if (goal.mature !== undefined) {
    const grown = countTile(world, TILE.WHEAT);
    const ok = grown >= goal.mature;
    done = done && ok;
    parts.push(`成熟小麦 ${Math.min(grown, goal.mature)}/${goal.mature}`);
  }

  const target = goal.reach ?? world.goalPos;
  if (target) {
    const ok = world.hero.x === target.x && world.hero.y === target.y;
    done = done && ok;
    parts.push(ok ? '已到达目标点' : '还没走到旗子那里');
  }

  return { done, text: parts.join(' · ') };
}

/** 根据行动数算星星：三星线之内满星。 */
export function scoreStars(world) {
  const par = world.level.par ?? 99;
  if (world.actions <= par) return 3;
  if (world.actions <= Math.ceil(par * 1.6)) return 2;
  return 1;
}

/** 数一数地图上某种地块的数量。 */
export function countTile(world, tile) {
  let total = 0;
  for (const row of world.tiles) {
    for (const cell of row) if (cell === tile) total += 1;
  }
  return total;
}

const SNAPSHOT_NUMBERS = [
  'day', 'coins', 'wheat', 'seeds', 'straw', 'eggs', 'pendingEggs',
  'fedChickens', 'milk', 'tilled', 'planted', 'harvested', 'watered',
];

/** 把自由农场转成可以放进 localStorage 的普通数据。 */
export function exportWorld(world) {
  const snapshot = {
    version: 1,
    tiles: world.tiles.map((row) => [...row]),
    animals: world.animals.map((animal) => ({ ...animal })),
    hero: { ...world.hero },
    wateredTiles: [...(world.wateredTiles ?? [])],
  };
  for (const key of SNAPSHOT_NUMBERS) snapshot[key] = world[key];
  return snapshot;
}

/** 从存档恢复自由农场；存档损坏时安全退回一张新地图。 */
export function restoreWorld(level, snapshot) {
  const fresh = createWorld(level);
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.tiles)) return fresh;
  if (snapshot.tiles.length !== fresh.height) return fresh;
  if (!snapshot.tiles.every((row) => Array.isArray(row) && row.length === fresh.width)) return fresh;

  const world = createWorld(level);
  world.tiles = snapshot.tiles.map((row) => [...row]);
  if (Array.isArray(snapshot.animals)) {
    world.animals = snapshot.animals
      .filter((animal) => (
        animal
        && Number.isFinite(animal.x) && Number.isFinite(animal.y)
        && animal.x >= 0 && animal.x < world.width
        && animal.y >= 0 && animal.y < world.height
      ))
      .map((animal) => ({ ...animal }));
  }
  if (
    snapshot.hero
    && Number.isFinite(snapshot.hero.x) && Number.isFinite(snapshot.hero.y)
    && snapshot.hero.x >= 0 && snapshot.hero.x < world.width
    && snapshot.hero.y >= 0 && snapshot.hero.y < world.height
  ) {
    const facing = Number.isFinite(snapshot.hero.facing) ? Math.trunc(snapshot.hero.facing) : fresh.hero.facing;
    world.hero = {
      x: snapshot.hero.x,
      y: snapshot.hero.y,
      facing: ((facing % 4) + 4) % 4,
    };
  }
  world.wateredTiles = new Set(Array.isArray(snapshot.wateredTiles) ? snapshot.wateredTiles : []);
  for (const key of SNAPSHOT_NUMBERS) {
    if (Number.isFinite(snapshot[key])) world[key] = snapshot[key];
  }
  return world;
}

function say(world, message) {
  world.message = message;
  world.messageKind = 'info';
  return { kind: 'say', message };
}

function warn(world, message) {
  world.message = message;
  world.messageKind = 'warn';
  return { kind: 'warn', message };
}

function combine(world, events) {
  const last = events[events.length - 1];
  if (last?.kind === 'blocked') warn(world, last.message);
  else if (last?.kind === 'move') {
    const tile = tileAt(world, last.to.x, last.to.y);
    world.message = `走到${TILE_NAME[tile] ?? '农场'}`;
    world.messageKind = 'info';
  }
  return events;
}
