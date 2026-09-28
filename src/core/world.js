/**
 * 农场世界：与画面完全无关的纯逻辑。
 * 谁站在哪、能不能走、种子下不下得去、小麦熟了没有，全都在这里结算。
 *
 * 地图图例：
 *   ' ' 草地    '.' 草地（写作点便于对齐）   '_' 已经翻好的土
 *   's' 幼苗    'r' 成熟小麦                '@' 出生点（每关一个）
 *   '#' 栅栏    'T' 树      'R' 石头        'W' 水井
 *   'H' 小屋    'B' 谷仓（占 2×2，字符为左下角）
 *   'C' 鸡舍（占 2×1，字符为左下角）   'M' 集市（占 2×2，字符为左下角）
 *   '~' 池塘
 *   'c' 小鸡    'm' 奶牛（开局有奶）   'n' 奶牛（今天没奶，挤过或开局就没奶）
 *
 * 农场的产出链：
 *   小麦田 → 收获 → 小麦 + 稻草；
 *   稻草喂鸡 → 等一天 → 鸡舍下蛋 → 收鸡蛋；
 *   稻草喂牛 → 等一天 → 奶牛产奶 → 挤奶（每头牛每天一瓶）；
 *   鸡蛋 / 牛奶 / 小麦 → 集市卖掉 → 金币 → 买种子、买稻草 → 再种一轮。
 *
 * 稻草是鸡和牛共同的口粮，金币是让农场继续转下去的燃料。
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
  MARKET: 'market',
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
  TILE.MARKET,
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
  M: TILE.MARKET,
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
  [TILE.MARKET]: '集市',
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
      if (char === 'c' || char === 'm' || char === 'n') {
        line.push(TILE.GRASS);
        const isCow = char !== 'c';
        animals.push({
          kind: isCow ? 'cow' : 'chicken',
          x,
          y,
          phase: (x * 7 + y * 13) % 100,
          // 奶牛每天有一瓶奶；挤完要喂它吃稻草、等一天才会再有。
          // 'n' 表示这头牛今天没奶（例如已经挤过）。
          fedToday: false,
          ...(isCow ? {
            milkReady: char === 'n' ? false : (level.startMilkReady ?? true),
          } : {}),
        });
        continue;
      }
      if (char === 'G') {
        if (goalPos) throw new Error(`关卡 ${level.id} 出现了两个目标点`);
        goalPos = { x, y };
        line.push(TILE.GRASS);
        continue;
      }
      if (char === 'H' || char === 'B' || char === 'C' || char === 'M') {
        const kind = char === 'H' ? TILE.HOUSE
          : char === 'B' ? TILE.BARN
            : char === 'C' ? TILE.COOP
              : TILE.MARKET;
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
    pendingEggs: level.startPendingEggs ?? 0,
    fedChickens: level.startFedChickens ?? 0,
    fedCows: level.startFedCows ?? 0,
    fedChickensTotal: 0,
    fedCowsTotal: 0,
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

/**
 * 集市价目表：想调经济就改这里。
 * 卖价略高于买价，孩子跑一圈才有赚头。
 */
export const MARKET_PRICES = {
  sellEgg: 3,
  sellMilk: 5,
  sellWheat: 2,
  seedCost: 3,
  seedAmount: 2,
  strawCost: 4,
  strawAmount: 1,
  chickenCost: 12,
  cowCost: 20,
};

/** 新动物放在谁旁边：鸡找鸡舍，牛找同伴。 */
function findAnimalSpot(world, kind) {
  const anchors = kind === 'chicken'
    ? (world.structures ?? []).filter((structure) => structure.kind === TILE.COOP)
      .flatMap((coop) => {
        const cells = [];
        for (let yy = coop.y; yy < coop.y + coop.height; yy += 1) {
          for (let xx = coop.x; xx < coop.x + coop.width; xx += 1) cells.push({ x: xx, y: yy });
        }
        return cells;
      })
    : world.animals.filter((animal) => animal.kind === 'cow').map((animal) => ({ x: animal.x, y: animal.y }));
  if (anchors.length === 0) return null;

  const candidates = [];
  for (const anchor of anchors) {
    for (const dir of DIRS) {
      const x = anchor.x + dir.dx;
      const y = anchor.y + dir.dy;
      if (candidates.some((cell) => cell.x === x && cell.y === y)) continue;
      candidates.push({ x, y });
    }
  }
  return candidates.find((cell) => canWalk(world, cell.x, cell.y).ok) ?? null;
}

/** 小农夫是不是站在集市的上下左右相邻格。 */
export function isNearMarket(world) {
  const { x, y } = world.hero;
  const markets = (world.structures ?? []).filter((structure) => structure.kind === TILE.MARKET);
  return markets.some((market) => {
    for (let yy = market.y; yy < market.y + market.height; yy += 1) {
      for (let xx = market.x; xx < market.x + market.width; xx += 1) {
        if (Math.abs(x - xx) + Math.abs(y - yy) === 1) return true;
      }
    }
    return false;
  });
}

/** 今天饿着的鸡 + 牛总数：判断稻草够不够。 */
export function hungryAnimalCount(world) {
  return countHungryChickens(world) + countHungryCows(world);
}

/** 稻草够不够喂饱今天饿着的动物（没有动物饿着也算够）。 */
export function hasEnoughStraw(world) {
  return (world.straw ?? 0) >= hungryAnimalCount(world);
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

/** 当前农场里有几头奶牛。 */
export function countCows(world) {
  return world.animals.filter((animal) => animal.kind === 'cow').length;
}

/** 小农夫上下左右相邻格子里的奶牛。 */
export function cowsNear(world) {
  const { x, y } = world.hero;
  return world.animals.filter(
    (animal) => animal.kind === 'cow' && Math.abs(animal.x - x) + Math.abs(animal.y - y) === 1,
  );
}

/** 站在旁边、今天还没挤过奶的奶牛。 */
export function readyCowsNear(world) {
  return cowsNear(world).filter((cow) => cow.milkReady !== false);
}

/** 小农夫是不是站在奶牛旁边。 */
export function isNearCow(world) {
  return cowsNear(world).length > 0;
}

/** 站在旁边、今天还没喂过的奶牛。 */
export function hungryCowsNear(world) {
  return cowsNear(world).filter((cow) => cow.fedToday !== true);
}

/** 农场里今天还没喂过的奶牛。 */
export function countHungryCows(world) {
  return world.animals.filter((animal) => animal.kind === 'cow' && animal.fedToday !== true).length;
}

/** 农场里今天还没喂过的鸡。 */
export function countHungryChickens(world) {
  return world.animals.filter((animal) => animal.kind === 'chicken' && animal.fedToday !== true).length;
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
      world.straw += 1;
      return [
        { kind: 'harvest', x, y, coins: 5 },
        say(world, '收获一捆小麦！+5 金币，+2 颗种子，+1 捆稻草'),
      ];
    }
    case '喂鸡': {
      if (!isNearCoop(world)) {
        return [warn(world, '走到鸡舍旁边再喂鸡吧')];
      }
      const chickens = countChickens(world);
      if (chickens === 0) return [warn(world, '鸡舍里还没有鸡')];
      const hungryBirds = world.animals.filter((animal) => animal.kind === 'chicken' && animal.fedToday !== true);
      if (hungryBirds.length === 0) return [say(world, '今天的鸡已经喂饱了，等明天再来吧')];
      if (world.straw < hungryBirds.length) {
        return [warn(world, `稻草不够，还缺 ${hungryBirds.length - world.straw} 捆。收获小麦可以得到稻草`)];
      }
      for (const bird of hungryBirds) {
        bird.fedToday = true;
        world.straw -= 1;
      }
      world.fedChickens = (world.fedChickens ?? 0) + hungryBirds.length;
      world.fedChickensTotal = (world.fedChickensTotal ?? 0) + hungryBirds.length;
      const coop = world.structures.find((structure) => structure.kind === TILE.COOP);
      return [
        { kind: 'feed', x: coop.x, y: coop.y, amount: hungryBirds.length },
        say(world, `喂饱了 ${hungryBirds.length} 只鸡。等一天后到鸡舍旁收鸡蛋`),
      ];
    }
    case '收鸡蛋': {
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
    case '挤奶': {
      const ready = readyCowsNear(world);
      if (ready.length === 0) {
        if (cowsNear(world).length > 0) {
          const hungry = hungryCowsNear(world).length;
          if (hungry > 0) {
            return [warn(world, '这头牛今天没奶。先喂它吃稻草，再等一天吧')];
          }
          return [say(world, '这头牛今天已经喂饱了，等一天就有新牛奶')];
        }
        return [warn(world, '走到奶牛旁边再挤奶吧')];
      }
      const events = [];
      for (const cow of ready) {
        cow.milkReady = false;
        world.milk += 1;
        events.push({ kind: 'milk', x: cow.x, y: cow.y, amount: 1 });
      }
      events.push(say(world, `挤了 ${ready.length} 瓶牛奶，装进奶罐里`));
      return events;
    }
    case '喂牛': {
      const hungry = hungryCowsNear(world);
      if (hungry.length === 0) {
        if (cowsNear(world).length > 0) {
          return [say(world, '这几头牛今天已经喂饱了，等一天再看')];
        }
        return [warn(world, '走到奶牛旁边再喂牛吧')];
      }
      if (world.straw < hungry.length) {
        return [warn(world, `稻草不够，还缺 ${hungry.length - world.straw} 捆。收获小麦可以得到稻草`)];
      }
      const events = [];
      for (const cow of hungry) {
        cow.fedToday = true;
        world.straw -= 1;
        world.fedCows = (world.fedCows ?? 0) + 1;
        world.fedCowsTotal = (world.fedCowsTotal ?? 0) + 1;
        events.push({ kind: 'feedCow', x: cow.x, y: cow.y, amount: 1 });
      }
      events.push(say(world, `喂饱了 ${hungry.length} 头牛。等一天后就能挤奶了`));
      return events;
    }
    case '卖出': {
      if (!isNearMarket(world)) {
        return [warn(world, '走到集市旁边再卖东西吧')];
      }
      const eggs = world.eggs ?? 0;
      const milk = world.milk ?? 0;
      const wheat = world.wheat ?? 0;
      if (eggs === 0 && milk === 0 && wheat === 0) {
        return [warn(world, '背包里没有可以卖的东西，先去收鸡蛋、挤牛奶或收小麦')];
      }
      const coins = eggs * MARKET_PRICES.sellEgg
        + milk * MARKET_PRICES.sellMilk
        + wheat * MARKET_PRICES.sellWheat;
      world.eggs = 0;
      world.milk = 0;
      world.wheat = 0;
      world.coins += coins;
      world.soldCoins = (world.soldCoins ?? 0) + coins;
      const parts = [];
      if (eggs > 0) parts.push(`${eggs} 枚鸡蛋`);
      if (milk > 0) parts.push(`${milk} 瓶牛奶`);
      if (wheat > 0) parts.push(`${wheat} 袋小麦`);
      const market = world.structures.find((structure) => structure.kind === TILE.MARKET);
      return [
        { kind: 'sell', x: market.x, y: market.y, amount: coins },
        say(world, `卖掉${parts.join('、')}，收到 ${coins} 金币`),
      ];
    }
    case '买种子': {
      if (!isNearMarket(world)) {
        return [warn(world, '走到集市旁边再买种子吧')];
      }
      const cost = MARKET_PRICES.seedCost;
      if (world.coins < cost) {
        return [warn(world, `金币不够，买种子要 ${cost} 金币，还差 ${cost - world.coins}`)];
      }
      world.coins -= cost;
      world.seeds += MARKET_PRICES.seedAmount;
      const market = world.structures.find((structure) => structure.kind === TILE.MARKET);
      return [
        { kind: 'buy', x: market.x, y: market.y, amount: MARKET_PRICES.seedAmount, label: '种子' },
        say(world, `花 ${cost} 金币买了 ${MARKET_PRICES.seedAmount} 颗种子`),
      ];
    }
    case '买稻草': {
      if (!isNearMarket(world)) {
        return [warn(world, '走到集市旁边再买稻草吧')];
      }
      const cost = MARKET_PRICES.strawCost;
      if (world.coins < cost) {
        return [warn(world, `金币不够，买稻草要 ${cost} 金币，还差 ${cost - world.coins}`)];
      }
      world.coins -= cost;
      world.straw += MARKET_PRICES.strawAmount;
      const market = world.structures.find((structure) => structure.kind === TILE.MARKET);
      return [
        { kind: 'buy', x: market.x, y: market.y, amount: MARKET_PRICES.strawAmount, label: '稻草' },
        say(world, `花 ${cost} 金币买了 ${MARKET_PRICES.strawAmount} 捆稻草`),
      ];
    }
    case '买鸡': {
      if (!isNearMarket(world)) {
        return [warn(world, '走到集市旁边再买鸡吧')];
      }
      const cost = MARKET_PRICES.chickenCost;
      if (world.coins < cost) {
        return [warn(world, `金币不够，买鸡要 ${cost} 金币，还差 ${cost - world.coins}`)];
      }
      const spot = findAnimalSpot(world, 'chicken');
      if (!spot) {
        return [warn(world, '鸡舍旁边没有空地了，先把周围的活干完再来')];
      }
      world.coins -= cost;
      world.animals.push({ kind: 'chicken', x: spot.x, y: spot.y, phase: (spot.x * 7 + spot.y * 13) % 100, fedToday: false });
      const market = world.structures.find((structure) => structure.kind === TILE.MARKET);
      return [
        { kind: 'buy', x: market.x, y: market.y, amount: 1, label: '鸡' },
        { kind: 'newAnimal', x: spot.x, y: spot.y, label: '新鸡' },
        say(world, `花 ${cost} 金币买了一只鸡，现在有 ${countChickens(world)} 只`),
      ];
    }
    case '买牛': {
      if (!isNearMarket(world)) {
        return [warn(world, '走到集市旁边再买牛吧')];
      }
      const cost = MARKET_PRICES.cowCost;
      if (world.coins < cost) {
        return [warn(world, `金币不够，买牛要 ${cost} 金币，还差 ${cost - world.coins}`)];
      }
      const spot = findAnimalSpot(world, 'cow');
      if (!spot) {
        return [warn(world, '奶牛周围没有空地了，先把周围的活干完再来')];
      }
      world.coins -= cost;
      world.animals.push({
        kind: 'cow', x: spot.x, y: spot.y, phase: (spot.x * 7 + spot.y * 13) % 100,
        fedToday: false, milkReady: true,
      });
      const market = world.structures.find((structure) => structure.kind === TILE.MARKET);
      return [
        { kind: 'buy', x: market.x, y: market.y, amount: 1, label: '牛' },
        { kind: 'newAnimal', x: spot.x, y: spot.y, label: '新牛' },
        say(world, `花 ${cost} 金币买了一头牛，现在有 ${countCows(world)} 头`),
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

  // 喂饱的鸡在鸡舍里下蛋，攒着等小农夫来收；没喂的就空着。
  const chickens = countChickens(world);
  const fed = Math.min(world.fedChickens ?? 0, chickens);
  if (fed > 0) {
    world.pendingEggs += fed;
    const coop = world.structures.find((structure) => structure.kind === TILE.COOP);
    events.push({ kind: 'lay', x: coop?.x ?? world.hero.x, y: coop?.y ?? world.hero.y, amount: fed });
  }
  for (const animal of world.animals) {
    if (animal.kind === 'chicken') animal.fedToday = false;
  }
  world.fedChickens = 0;

  // 新的一天：昨天喂饱的牛才有新奶；饿着的牛继续没奶。
  for (const animal of world.animals) {
    if (animal.kind !== 'cow') continue;
    if (animal.fedToday === true) {
      animal.milkReady = true;
      events.push({ kind: 'milkReady', x: animal.x, y: animal.y });
    }
    animal.fedToday = false;
  }
  world.fedCows = 0;

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
    case '奶牛可以挤奶':
      return readyCowsNear(world).length > 0;
    case '鸡舍里有鸡蛋':
      return isNearCoop(world) && (world.pendingEggs ?? 0) > 0;
    case '稻草足够':
      return hasEnoughStraw(world);
    case '前方是成熟小麦': {
      const dir = DIRS[world.hero.facing];
      const front = tileAt(world, world.hero.x + dir.dx, world.hero.y + dir.dy);
      return front === TILE.WHEAT;
    }
    case '到旗子了':
      return Boolean(world.goalPos
        && world.hero.x === world.goalPos.x
        && world.hero.y === world.goalPos.y);
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
  if (goal.sold !== undefined) {
    const ok = (world.soldCoins ?? 0) >= goal.sold;
    done = done && ok;
    parts.push(`卖出得金币 ${Math.min(world.soldCoins ?? 0, goal.sold)}/${goal.sold}`);
  }
  if (goal.coins !== undefined) {
    const ok = world.coins >= goal.coins;
    done = done && ok;
    parts.push(`金币 ${Math.min(world.coins, goal.coins)}/${goal.coins}`);
  }
  if (goal.feedCow !== undefined) {
    const fed = world.fedCowsTotal ?? 0;
    const ok = fed >= goal.feedCow;
    done = done && ok;
    parts.push(`喂饱牛 ${Math.min(fed, goal.feedCow)}/${goal.feedCow}`);
  }
  if (goal.feed !== undefined) {
    const fed = world.fedChickensTotal ?? 0;
    const ok = fed >= goal.feed;
    done = done && ok;
    parts.push(`喂饱鸡 ${Math.min(fed, goal.feed)}/${goal.feed}`);
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
  'fedChickens', 'fedCows', 'fedChickensTotal', 'fedCowsTotal', 'soldCoins',
  'milk', 'tilled', 'planted', 'harvested', 'watered',
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
