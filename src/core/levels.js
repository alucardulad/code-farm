/**
 * 关卡数据：8 个章节、共 44 关。
 *
 * 分段原则（每一章只解锁一类新语法，参照《地牢围攻》的关卡设计规范）：
 *   第 1 章 顺序编程：把动作一行一行写清楚，不许写循环和判断
 *   第 2 章 重复：     发现重复，用「重复 N 次 { ... }」收起来
 *   第 3 章 判断：     看脚下是什么，再决定做不做
 *   第 4 章 牧场：     收稻草喂鸡喂牛、收鸡蛋、挤牛奶，学会照看动物
 *   第 5 章 综合：     循环里套判断，完成真正的农活
 *   第 6 章 经营：     两选一判断「否则」+ 多动物经营，管好一座大农场
 *   第 7 章 集市：     把农产品卖掉换金币，再用金币买种子和稻草
 *   第 8 章 自动农活： 用「重复直到」看情况循环，次数不用事先数
 *
 * 铁律：一关只教一个新东西。starter 必须是空的（第 1 关留一行示范），
 * objective 和 hints 里不许提前提到还没教过的指令。
 *
 * 地图图例（见 world.js）：
 *   '.' 草地   '_' 翻好的土   's' 幼苗   'r' 成熟小麦
 *   '#' 栅栏   'T' 树   'W' 水井   'R' 石头
 *   'H' 小屋   'B' 谷仓（占 2×2，字符为左下角）   'M' 集市（占 2×2）
 *   'C' 鸡舍（占 2×1，字符为左下角）   '~' 池塘
 *   'c' 小鸡   'm' 奶牛（开局有奶）   'n' 奶牛（今天没奶，要先喂）
 *   'G' 目标旗子
 *   '@' 站在草地上的小农夫   '$' 站在泥土上
 *   '%' 站在幼苗上           '&' 站在成熟小麦上
 */

/** 地图统一宽度（含左右栅栏）。 */
const WIDTH = 14;

/**
 * 把「内容行」补成带栅栏的完整地图。
 * 只写有意义的格子，右边自动用草地补齐，保证每行等长。
 */
function field(interiorRows, width = WIDTH) {
  const innerWidth = width - 2;
  const rows = interiorRows.map((row) => {
    const text = String(row);
    if (text.length > innerWidth) {
      throw new Error(`关卡地图一行太长了：${text}（最多 ${innerWidth} 个字符）`);
    }
    return '#' + text.padEnd(innerWidth, '.') + '#';
  });
  const fence = '#'.repeat(width);
  return [fence, ...rows, fence];
}

/** 常用的农场装饰行，放在最下面一排，不挡路。 */
const DECOR = {
  treeAndWell: '..T.c.W...T.',
  barnAndHouse: '..cB....H.m.',
  coopAndPond: '..C...~.c...',
  treeAndRock: '..T...R...m.',
};

export const CHAPTERS = [
  {
    id: 'ch1',
    name: '第 1 章 · 顺序',
    subtitle: '第 1~10 关',
    goal: '把想做的事按顺序写成一行一行，让指令一步一步执行',
    allow: ['前进', '后退', '左转', '右转', '翻土', '播种', '浇水', '等待一天', '收获'],
    forbidden: ['repeat', 'else', 'pasture', 'market', 'until'],
  },
  {
    id: 'ch2',
    name: '第 2 章 · 重复',
    subtitle: '第 11~16 关',
    goal: '发现重复的动作，用「重复」把一长串代码收起来',
    allow: ['重复 N 次 { ... }'],
    forbidden: ['if', 'else', 'pasture', 'market', 'until'],
  },
  {
    id: 'ch3',
    name: '第 3 章 · 判断',
    subtitle: '第 17~22 关',
    goal: '先看看脚下是什么，再决定要不要做这件事',
    allow: ['如果 脚下是... { ... }', '脚下是草地 / 泥土 / 幼苗 / 成熟小麦'],
    forbidden: ['else', 'pasture', 'market', 'until'],
  },
  {
    id: 'ch4',
    name: '第 4 章 · 牧场',
    subtitle: '第 23~28 关',
    goal: '用稻草喂鸡、喂牛，收鸡蛋、挤牛奶，把整座牧场照顾起来',
    allow: ['喂鸡', '收鸡蛋', '喂牛', '挤奶'],
    forbidden: ['else', 'market', 'until'],
  },
  {
    id: 'ch5',
    name: '第 5 章 · 综合',
    subtitle: '第 29~32 关',
    goal: '把循环和判断都用起来，一个人管好整片农田',
    allow: ['全部指令', '重复里套如果'],
    forbidden: ['else', 'market', 'until'],
  },
  {
    id: 'ch6',
    name: '第 6 章 · 经营',
    subtitle: '第 33~36 关',
    goal: '学会「否则」两选一，把种地、养鸡、牧牛安排成一整天的经营',
    allow: ['全部指令', '如果 ... 否则 ...'],
    forbidden: ['market', 'until'],
  },
  {
    id: 'ch7',
    name: '第 7 章 · 集市',
    subtitle: '第 37~40 关',
    goal: '把鸡蛋、牛奶、小麦卖成金币，再用金币买种子和稻草，让农场转起来',
    allow: ['全部指令', '卖出', '买种子', '买稻草', '稻草足够'],
    forbidden: ['until'],
  },
  {
    id: 'ch8',
    name: '第 8 章 · 自动农活',
    subtitle: '第 41~44 关',
    goal: '用「重复直到」看情况循环：不知道要做几遍的时候，就让条件来决定',
    allow: ['全部指令', '重复直到', '前方是成熟小麦', '到旗子了'],
    forbidden: [],
  },
];

/** 第 1 章 · 顺序 */
const CH1 = [
  {
    id: 'level-1',
    chapter: 'ch1',
    name: '第 1 关 · 向前一步',
    subtitle: '第一条指令',
    objective: '旗子就在小农夫前面一格。写一行「前进」，让他走过去。',
    hints: [
      '代码是一行一行往下执行的：写一行「前进」，小农夫就走一格。',
      '数一数他和旗子之间隔了几格，就写几行。',
    ],
    newCommands: ['前进'],
    par: 1,
    map: field(['@G', '.', '.', DECOR.treeAndWell]),
    goal: { reach: { x: 2, y: 1 } },
    starter: '// 让小农夫走到旗子那里\n前进\n',
    solution: '前进',
  },
  {
    id: 'level-2',
    chapter: 'ch1',
    name: '第 2 关 · 走远一点',
    subtitle: '给指令写个数',
    objective: '旗子在很远的地方。在「前进」后面写上步数，一步就走到。',
    hints: [
      '「前进 9」表示一次往前走 9 格，比写 9 行短多了。',
      '数一数小农夫和旗子之间有几格空地，就写几步。',
    ],
    newCommands: ['前进 N'],
    par: 1,
    map: field(['@........G', '.', '.', DECOR.treeAndWell]),
    goal: { reach: { x: 10, y: 1 } },
    starter: '// 数一数要走几格，写在「前进」后面\n',
    solution: '前进 9',
  },
  {
    id: 'level-3',
    chapter: 'ch1',
    name: '第 3 关 · 向右转',
    subtitle: '换个方向走',
    objective: '旗子在小农夫的正下方。「右转」之后，他才会朝下走。',
    hints: [
      '小农夫一开始朝右，「右转」一次就变成朝下。',
      '转好方向再写「前进」，步数就是他和旗子之间隔的格数。',
    ],
    newCommands: ['右转'],
    par: 2,
    map: field(['@', '.', '.', 'G', '.', DECOR.treeAndWell]),
    goal: { reach: { x: 1, y: 4 } },
    starter: '// 先转身，再往前走\n',
    solution: '右转\n前进 3',
  },
  {
    id: 'level-4',
    chapter: 'ch1',
    name: '第 4 关 · 向左转',
    subtitle: '反方向转身',
    objective: '旗子在小农夫的斜上方。先向上走，再向右走。',
    hints: [
      '「左转」和「右转」相反：朝右的时候写「左转」就变成朝上。',
      '走到最上面那一行之后，再转回右边往前走。',
    ],
    newCommands: ['左转'],
    par: 4,
    map: field(['.....G', '.', '.', '@', '.', DECOR.treeAndWell]),
    goal: { reach: { x: 6, y: 1 } },
    starter: '// 先向上走，再向右走\n',
    solution: '左转\n前进 3\n右转\n前进 5',
  },
  {
    id: 'level-5',
    chapter: 'ch1',
    name: '第 5 关 · 后退',
    subtitle: '不倒车也能退',
    objective: '旗子在小农夫身后。不用转身，写「后退」就能退到旗子那里。',
    hints: ['「后退」是朝后背对着的方向走一格，方向不会变。'],
    newCommands: ['后退'],
    par: 1,
    map: field(['.', 'G@', '.', DECOR.treeAndWell]),
    goal: { reach: { x: 1, y: 2 } },
    starter: '// 旗子在身后\n',
    solution: '后退',
  },
  {
    id: 'level-6',
    chapter: 'ch1',
    name: '第 6 关 · 翻土',
    subtitle: '第一次干活',
    objective: '种东西之前要先把草地翻成松软的土。站在草地上写「翻土」试试。',
    hints: ['「翻土」翻的是小农夫脚下的这一格，不是前面那一格。'],
    newCommands: ['翻土'],
    par: 1,
    map: field(['@', '.', '.', DECOR.treeAndWell]),
    goal: { till: 1 },
    starter: '// 把脚下的草地翻成土\n',
    solution: '翻土',
  },
  {
    id: 'level-7',
    chapter: 'ch1',
    name: '第 7 关 · 播种',
    subtitle: '撒下种子',
    objective: '翻好土以后播下一颗种子。种子要种在翻好的土上。',
    hints: [
      '「播种」只能种在翻好的土上，所以要先把「翻土」写好。',
      '两步都站在同一格完成，不用走动。',
    ],
    newCommands: ['播种'],
    par: 2,
    map: field(['@', '.', '.', DECOR.treeAndWell]),
    goal: { plant: 1 },
    starter: '// 先翻土，再播种\n',
    solution: '翻土\n播种',
  },
  {
    id: 'level-8',
    chapter: 'ch1',
    name: '第 8 关 · 浇水',
    subtitle: '给幼苗喝水',
    objective: '种子不会自己长大。翻土、播种，再给幼苗浇点水。',
    hints: ['「浇水」只对幼苗有用，浇完还要等一天才会长大。'],
    newCommands: ['浇水'],
    par: 3,
    map: field(['@', '.', '.', DECOR.coopAndPond]),
    goal: { water: 1 },
    starter: '// 翻土、播种、浇水\n',
    solution: '翻土\n播种\n浇水',
  },
  {
    id: 'level-9',
    chapter: 'ch1',
    name: '第 9 关 · 等待一天',
    subtitle: '让时间往前走',
    objective: '浇过水的幼苗要睡一晚才会长大。写「等待一天」，看看田里有什么变化。',
    hints: [
      '「等待一天」会让整片农田都过一天：浇过水的幼苗会变成成熟小麦。',
      '没浇水的幼苗不会长大，别忘了先浇水。',
    ],
    newCommands: ['等待一天'],
    par: 4,
    map: field(['@', '.', '.', DECOR.barnAndHouse]),
    goal: { mature: 1 },
    starter: '// 种下种子、浇好水，再等一天\n',
    solution: '翻土\n播种\n浇水\n等待一天',
  },
  {
    id: 'level-10',
    chapter: 'ch1',
    name: '第 10 关 · 收获',
    subtitle: '收下第一捆小麦',
    objective: '小麦熟了就可以收。收获会拿到金币，还能拿回两颗种子。',
    hints: ['「收获」也只看脚下这一格，站在熟麦上再写。'],
    newCommands: ['收获'],
    par: 5,
    map: field(['@', '.', '.', DECOR.barnAndHouse]),
    goal: { harvest: 1 },
    starter: '// 从翻土一直做到收获\n',
    solution: '翻土\n播种\n浇水\n等待一天\n收获',
  },
];

/** 第 2 章 · 重复 */
const CH2 = [
  {
    id: 'level-11',
    chapter: 'ch2',
    name: '第 11 关 · 重复',
    subtitle: '把重复的收起来',
    objective: '要往前走 9 格。用「重复 9 次 { 前进 }」代替写 9 行。',
    hints: [
      '「重复 N 次 {」开头，把要做的事写在中间，最后用「}」收尾。',
      '大括号里的每一行都会重复执行 N 遍。',
    ],
    newCommands: ['重复 N 次 { ... }'],
    par: 9,
    map: field(['@........G', '.', '.', DECOR.treeAndWell]),
    goal: { reach: { x: 10, y: 1 } },
    starter: '// 重复 9 次「前进」\n重复 9 次 {\n  \n}\n',
    solution: '重复 9 次 {\n  前进\n}',
  },
  {
    id: 'level-12',
    chapter: 'ch2',
    name: '第 12 关 · 重复里写多行',
    subtitle: '一次种一行',
    objective: '大括号里可以写好幾行。翻土、播种、前进，连着做完三格。',
    hints: [
      '大括号里写三行：翻土、播种、前进。',
      '重复 3 次就能种下 3 颗种子。',
    ],
    newCommands: [],
    par: 9,
    map: field(['@', '.', '.', DECOR.coopAndPond]),
    goal: { plant: 3 },
    starter: '// 重复 3 次：翻土、播种、前进\n',
    solution: '重复 3 次 {\n  翻土\n  播种\n  前进\n}',
  },
  {
    id: 'level-13',
    chapter: 'ch2',
    name: '第 13 关 · 重复加转向',
    subtitle: '绕着小屋走一圈',
    objective: '先往前走，再转两次弯，走到最下面的旗子。',
    hints: [
      '每一段路都可以用「重复」走完。',
      '走完一段就「右转」一次，方向对了再走下一段。',
    ],
    newCommands: [],
    par: 18,
    map: field(['@.....', '......', '......', '......', 'G.....'], 8),
    goal: { reach: { x: 1, y: 5 } },
    starter: '// 走一段，右转，再走一段\n',
    solution: '重复 5 次 {\n  前进\n}\n右转\n重复 4 次 {\n  前进\n}\n右转\n重复 5 次 {\n  前进\n}',
  },
  {
    id: 'level-14',
    chapter: 'ch2',
    name: '第 14 关 · 一排小麦',
    subtitle: '边走边收',
    objective: '前面有三株熟麦。走一步、收一株，用重复做完。',
    hints: [
      '左边三格都长着成熟小麦，走过去就能收。',
      '「前进」和「收获」都放进大括号里，重复 3 次。',
    ],
    newCommands: [],
    par: 6,
    map: field(['@rrr', '.', '.', DECOR.barnAndHouse]),
    goal: { harvest: 3 },
    starter: '// 重复 3 次：前进、收获\n',
    solution: '重复 3 次 {\n  前进\n  收获\n}',
  },
  {
    id: 'level-15',
    chapter: 'ch2',
    name: '第 15 关 · 复习：种三格',
    subtitle: '把农活排整齐',
    objective: '连着种三格：翻土、播种、浇水，然后走到下一格。',
    hints: [
      '大括号里按顺序写：翻土、播种、浇水、前进。',
      '重复 3 次就完成三格。',
    ],
    newCommands: [],
    par: 12,
    map: field(['@', '.', '.', DECOR.coopAndPond]),
    goal: { plant: 3, water: 3 },
    starter: '// 重复 3 次：翻土、播种、浇水、前进\n',
    solution: '重复 3 次 {\n  翻土\n  播种\n  浇水\n  前进\n}',
  },
  {
    id: 'level-16',
    chapter: 'ch2',
    name: '第 16 关 · 复习：收五株',
    subtitle: '长一点的重复',
    objective: '前面有五株成熟小麦，用重复把它们全部收回来。',
    hints: ['重复的次数要写对：数一数田里有几株熟麦。'],
    newCommands: [],
    par: 10,
    map: field(['@rrrrr', '.', '.', DECOR.barnAndHouse]),
    goal: { harvest: 5 },
    starter: '// 重复几次？先数一数\n',
    solution: '重复 5 次 {\n  前进\n  收获\n}',
  },
];

/** 第 3 章 · 判断 */
const CH3 = [
  {
    id: 'level-17',
    chapter: 'ch3',
    name: '第 17 关 · 如果脚下是草地',
    subtitle: '第一次做判断',
    objective: '小农夫站在草地上。「如果 脚下是草地 { 翻土 }」，条件对了才会翻土。',
    hints: [
      '「如果」后面写条件，条件说对了，大括号里的事才做。',
      '条件说不对，大括号里就跳过，什么也不做。',
    ],
    newCommands: ['如果 脚下是草地 { ... }'],
    par: 1,
    map: field(['@', '.', '.', DECOR.treeAndWell]),
    goal: { till: 1 },
    starter: '// 如果脚下是草地，就翻土\n如果 脚下是草地 {\n  \n}\n',
    solution: '如果 脚下是草地 {\n  翻土\n}',
  },
  {
    id: 'level-18',
    chapter: 'ch3',
    name: '第 18 关 · 如果脚下是泥土',
    subtitle: '换个条件',
    objective: '这一格的土已经翻好了。用「如果 脚下是泥土」来判断，再播种。',
    hints: ['泥土就是翻好的土。条件换掉，判断的写法不变。'],
    newCommands: ['如果 脚下是泥土 { ... }'],
    par: 1,
    map: field(['$', '.', '.', DECOR.barnAndHouse]),
    goal: { plant: 1 },
    starter: '// 如果脚下是泥土，就播种\n',
    solution: '如果 脚下是泥土 {\n  播种\n}',
  },
  {
    id: 'level-19',
    chapter: 'ch3',
    name: '第 19 关 · 如果脚下有幼苗',
    subtitle: '照顾小苗',
    objective: '脚下刚长出一株幼苗。判断一下，有幼苗才浇水。',
    hints: ['幼苗是需要浇水的小苗，长大了就不再是幼苗了。'],
    newCommands: ['如果 脚下有幼苗 { ... }'],
    par: 1,
    map: field(['%', '.', '.', DECOR.coopAndPond]),
    goal: { water: 1 },
    starter: '// 如果脚下有幼苗，就浇水\n',
    solution: '如果 脚下有幼苗 {\n  浇水\n}',
  },
  {
    id: 'level-20',
    chapter: 'ch3',
    name: '第 20 关 · 如果脚下是成熟小麦',
    subtitle: '熟了才收',
    objective: '脚下是一株熟麦。判断一下，熟了才收获。',
    hints: ['只有成熟小麦能收，幼苗收了也没用。'],
    newCommands: ['如果 脚下是成熟小麦 { ... }'],
    par: 1,
    map: field(['&', '.', '.', DECOR.barnAndHouse]),
    goal: { harvest: 1 },
    starter: '// 如果脚下是成熟小麦，就收获\n',
    solution: '如果 脚下是成熟小麦 {\n  收获\n}',
  },
  {
    id: 'level-21',
    chapter: 'ch3',
    name: '第 21 关 · 复习：一串判断',
    subtitle: '一步接一步',
    objective: '用三个判断，把这一格从草地变成浇好水的幼苗。',
    hints: [
      '第一句判断脚下是不是草地，第二句判断是不是泥土，第三句判断有没有幼苗。',
      '每做完一步，脚下的东西就会变，下一句判断正好接得上。',
    ],
    newCommands: [],
    par: 3,
    map: field(['@', '.', '.', DECOR.treeAndWell]),
    goal: { water: 1 },
    starter: '// 三个判断，一步一步来\n',
    solution: '如果 脚下是草地 {\n  翻土\n}\n如果 脚下是泥土 {\n  播种\n}\n如果 脚下有幼苗 {\n  浇水\n}',
  },
  {
    id: 'level-22',
    chapter: 'ch3',
    name: '第 22 关 · 复习：种到收',
    subtitle: '完整的一天',
    objective: '从草地开始，一路判断，直到把脚下的小麦收回来。',
    hints: [
      '前面还是那三个判断。',
      '浇完水要「等待一天」，幼苗才会变成熟麦，最后再判断一次。',
    ],
    newCommands: [],
    par: 5,
    map: field(['@', '.', '.', DECOR.barnAndHouse]),
    goal: { harvest: 1 },
    starter: '// 从草地一路做到收获\n',
    solution: '如果 脚下是草地 {\n  翻土\n}\n如果 脚下是泥土 {\n  播种\n}\n如果 脚下有幼苗 {\n  浇水\n}\n等待一天\n如果 脚下是成熟小麦 {\n  收获\n}',
  },
];

/** 第 4 章 · 牧场：喂鸡、收鸡蛋、喂牛、挤奶，让整座牧场转起来。 */
const CH4 = [
  {
    id: 'level-23',
    chapter: 'ch4',
    name: '第 23 关 · 喂鸡',
    subtitle: '稻草变成早饭',
    objective: '脚下就是一株熟麦。先收获拿到稻草，再到鸡舍旁边写「喂鸡」。',
    hints: [
      '收获一捆小麦会得到 1 捆稻草，稻草就是鸡的早饭。',
      '走到鸡舍的上、下、左、右相邻格，写「喂鸡」，1 只鸡每天吃 1 捆稻草。',
    ],
    newCommands: ['喂鸡'],
    par: 6,
    map: field(['&', '.', '..C..c......', '..T.........']),
    goal: { feed: 1 },
    starter: '// 先收下脚下的熟麦，再去鸡舍旁喂鸡\n',
    solution: '收获\n右转\n前进 2\n左转\n前进\n喂鸡',
  },
  {
    id: 'level-24',
    chapter: 'ch4',
    name: '第 24 关 · 收鸡蛋',
    subtitle: '鸡舍里的收成',
    objective: '昨天喂饱的鸡已经下蛋了。走到鸡舍旁边写「收鸡蛋」，把蛋收进背包。',
    hints: [
      '鸡下蛋后会先留在鸡舍里，要走过去收才算数。',
      '站在鸡舍相邻的格子上写「收鸡蛋」，鸡舍里几枚就收几枚。',
    ],
    newCommands: ['收鸡蛋'],
    par: 5,
    startPendingEggs: 3,
    map: field(['@', '..C..c..c...', '.', '..T.........']),
    goal: { egg: 3 },
    starter: '// 走到鸡舍旁边收鸡蛋\n',
    solution: '右转\n前进\n左转\n前进\n收鸡蛋',
  },
  {
    id: 'level-25',
    chapter: 'ch4',
    name: '第 25 关 · 挤奶',
    subtitle: '给奶牛挤奶',
    objective: '地里站着两头奶牛，它们今天都有奶。走到奶牛旁边写「挤奶」，牛奶就收进奶罐。',
    hints: [
      '奶牛就在小农夫下面一排，走到它旁边的那一格再挤奶。',
      '一头牛每天能挤 1 瓶奶，两头牛都走到旁边，就能挤到 2 瓶。',
      '牛挤完当天就没奶了；喂它吃稻草、等一天，明天又有新奶。',
    ],
    newCommands: ['挤奶'],
    par: 7,
    map: field(['@', '.m...m......', '.', '..T.........']),
    goal: { milk: 2 },
    starter: '// 两头奶牛，一头一瓶奶\n',
    solution: '右转\n前进 2\n左转\n前进\n挤奶\n前进 4\n挤奶',
  },
  {
    id: 'level-26',
    chapter: 'ch4',
    name: '第 26 关 · 喂牛',
    subtitle: '牛也要吃稻草',
    objective: '这头奶牛今天没奶。仓库里有 1 捆稻草，走到它旁边写「喂牛」，等一天再挤奶。',
    hints: [
      '鸡吃稻草，牛也吃稻草。走到奶牛旁边写「喂牛」，1 头牛每天吃 1 捆。',
      '喂饱的牛要到第二天才有奶，所以中间要有「等待一天」。',
      '顺序是：喂牛 → 等待一天 → 挤奶。',
    ],
    newCommands: ['喂牛'],
    par: 7,
    startStraw: 1,
    map: field(['@', '.n..........', '.', '..T.........']),
    goal: { feedCow: 1, milk: 1 },
    starter: '// 先喂牛，等一天，再挤奶\n',
    solution: '右转\n前进 2\n左转\n前进\n喂牛\n等待一天\n挤奶',
  },
  {
    id: 'level-27',
    chapter: 'ch4',
    name: '第 27 关 · 有蛋才收',
    subtitle: '先判断，再收鸡蛋',
    objective: '仓库里有 3 捆稻草。喂饱 2 只鸡和 1 头牛，等一天，再用判断决定要不要收鸡蛋。',
    hints: [
      '站在鸡舍和奶牛中间那一格，写「喂鸡」再写「喂牛」，3 捆稻草刚好用完。',
      '写「等待一天」以后，鸡会下蛋、牛会产奶。',
      '先判断「如果 鸡舍里有鸡蛋」，有蛋才写「收鸡蛋」；最后挤牛奶。',
    ],
    newCommands: ['如果 鸡舍里有鸡蛋 { ... }'],
    par: 10,
    startStraw: 3,
    map: field(['@', '..C..c..c...', '.n..........', '..T.........']),
    goal: { feed: 2, feedCow: 1, egg: 2, milk: 1 },
    starter: '// 先喂饱鸡和牛，等一天，再判断有没有鸡蛋\n',
    solution: '右转\n前进\n左转\n前进\n喂鸡\n喂牛\n等待一天\n如果 鸡舍里有鸡蛋 {\n  收鸡蛋\n}\n挤奶',
  },
  {
    id: 'level-28',
    chapter: 'ch4',
    name: '第 28 关 · 小小牧场主',
    subtitle: '种两格，养一鸡一牛',
    objective: '种两格小麦，用收下来的稻草喂饱 1 只鸡和 1 头牛，等一天，再把鸡蛋收回来、把牛奶挤出来。',
    hints: [
      '先在自己脚下和右边各翻土、播种、浇水，再「等待一天」。',
      '退回起点把两株小麦都收掉，正好得到 2 捆稻草。',
      '走到鸡舍和奶牛中间那一格，写「喂鸡」再写「喂牛」。',
      '「等待一天」以后，收鸡蛋和挤奶都能在同一格做完。',
    ],
    newCommands: [],
    par: 20,
    map: field(['@', '..C..c......', '.n..........', '..T.........']),
    goal: { harvest: 2, feed: 1, feedCow: 1, egg: 1, milk: 1 },
    starter: '// 种两格 → 收稻草 → 喂鸡喂牛 → 等一天 → 收蛋、挤奶\n',
    solution: '翻土\n播种\n浇水\n前进\n翻土\n播种\n浇水\n等待一天\n后退 1\n收获\n前进\n收获\n右转\n前进\n左转\n喂鸡\n喂牛\n等待一天\n收鸡蛋\n挤奶',
  },
];

/** 第 5 章 · 综合 */
const CH5 = [
  {
    id: 'level-29',
    chapter: 'ch5',
    name: '第 29 关 · 见草就翻',
    subtitle: '判断放进循环',
    objective: '田里有的格子已经翻过土，有的还是草地。边走边判断，把六格都种上。',
    hints: [
      '「重复 6 次」走完六格，每格都先判断是不是草地。',
      '是草地就先翻土，然后不管怎样都播种。',
      '这段要写成：重复 6 次 { 前进 / 如果 脚下是草地 { 翻土 } / 播种 }。',
    ],
    newCommands: ['重复里套如果'],
    par: 15,
    map: field(['@_._._', '.', '.', DECOR.barnAndHouse]),
    goal: { plant: 6 },
    starter: '// 重复 6 次：前进，见草就翻，然后播种\n',
    solution: '重复 6 次 {\n  前进\n  如果 脚下是草地 {\n    翻土\n  }\n  播种\n}',
  },
  {
    id: 'level-30',
    chapter: 'ch5',
    name: '第 30 关 · 见熟就收',
    subtitle: '跳过长草的地',
    objective: '这一行有熟麦也有空地。只收熟的，别在空地上白费力。',
    hints: [
      '和上一关一样，重复走到每一格。',
      '「如果 脚下是成熟小麦」才收获，空地上就跳过。',
    ],
    newCommands: [],
    par: 9,
    map: field(['@r.r.r', '.', '.', DECOR.barnAndHouse]),
    goal: { harvest: 3 },
    starter: '// 重复 6 次：前进，见熟麦就收\n',
    solution: '重复 6 次 {\n  前进\n  如果 脚下是成熟小麦 {\n    收获\n  }\n}',
  },
  {
    id: 'level-31',
    chapter: 'ch5',
    name: '第 31 关 · 牛棚巡检',
    subtitle: '只挤有奶的牛',
    objective: '下面一排有三头牛，其中一头今天没奶。边走边判断，只给有奶的牛挤奶。',
    hints: [
      '牛在下面一排，小农夫在上面一排走，走一格就和一头牛相邻。',
      '重复 9 次：前进，然后判断「如果 奶牛可以挤奶」，有奶才挤。',
      '没奶的牛会跳过，这就是判断的用处——不用一个个盯着看。',
    ],
    newCommands: ['如果 奶牛可以挤奶 { ... }'],
    par: 12,
    map: field(['@...........', '..m..n..m...', '............']),
    goal: { milk: 2 },
    starter: '// 重复 9 次：前进，判断能不能挤奶\n',
    solution: '重复 9 次 {\n  前进\n  如果 奶牛可以挤奶 {\n    挤奶\n  }\n}',
  },
  {
    id: 'level-32',
    chapter: 'ch5',
    name: '第 32 关 · 毕业挑战',
    subtitle: '一个人管好一座农场',
    objective: '种四格小麦，用收下来的稻草喂饱鸡和牛，等一天，收鸡蛋、挤牛奶，把整座农场跑通。',
    hints: [
      '种地还是老一套：重复 4 次 { 翻土 / 播种 / 浇水 / 前进 }，再「等待一天」，退回来收掉四格。',
      '收完麦子有 4 捆稻草。走到鸡舍和奶牛中间那一格，写「喂鸡」再写「喂牛」。',
      '「等待一天」之后，鸡下蛋、牛产奶，收鸡蛋、挤奶都在同一格完成，这一天就算圆满了。',
    ],
    newCommands: [],
    par: 35,
    map: field(['@...........', '.n..........', '..C..c......']),
    goal: { plant: 4, water: 4, harvest: 4, feed: 1, feedCow: 1, egg: 1, milk: 1 },
    starter: '// 种地 → 收稻草 → 喂鸡喂牛 → 等一天 → 收蛋、挤奶 → 回到旗子\n',
    solution: '重复 4 次 {\n  翻土\n  播种\n  浇水\n  前进\n}\n等待一天\n后退 4\n重复 4 次 {\n  收获\n  前进\n}\n右转\n前进 1\n左转\n后退 2\n喂鸡\n喂牛\n等待一天\n收鸡蛋\n挤奶',
  },
];

/** 第 6 章 · 经营：两选一判断「否则」+ 多动物经营。 */
const CH6 = [
  {
    id: 'level-33',
    chapter: 'ch6',
    name: '第 33 关 · 如果…否则…',
    subtitle: '两条路选一条',
    objective: '脚下是草地不是熟麦。写「如果 脚下是成熟小麦 { 收获 } 否则 { 翻土 }」，条件不成立时就走「否则」那条路。',
    hints: [
      '「如果」的大括号后面可以再接一个「否则 { ... }」，表示条件不成立时该做什么。',
      '脚下是草地，不是成熟小麦，所以会走「否则」这条路，把草地翻成松土。',
      '记住顺序：先写完整的「如果 { ... }」，紧跟着再写「否则 { ... }」。',
    ],
    newCommands: ['否则 { ... }'],
    par: 1,
    map: field(['@', '.', '.', DECOR.treeAndWell]),
    goal: { till: 1 },
    starter: '// 熟了就收，否则翻土。这一关会走「否则」\n如果 脚下是成熟小麦 {\n  收获\n}\n',
    solution: '如果 脚下是成熟小麦 {\n  收获\n}\n否则 {\n  翻土\n}',
  },
  {
    id: 'level-34',
    chapter: 'ch6',
    name: '第 34 关 · 牧场二选一',
    subtitle: '有蛋收蛋，没蛋喂鸡',
    objective: '仓库里有 1 捆稻草，鸡舍里还没有蛋。用「如果 鸡舍里有鸡蛋 { 收鸡蛋 } 否则 { 喂鸡 }」，自动选该做的那件事。',
    hints: [
      '走到鸡舍旁边，先判断有没有鸡蛋。',
      '现在鸡还没下蛋，条件不成立，所以会走「否则」，把稻草喂给鸡。',
      '一段代码管两件事：有蛋就收，没蛋就喂，不用自己盯着看。',
    ],
    newCommands: [],
    par: 5,
    startStraw: 1,
    map: field(['@', '..C..c......', '.', '..T.........']),
    goal: { feed: 1 },
    starter: '// 有蛋就收蛋，没蛋就喂鸡\n右转\n前进\n左转\n前进\n',
    solution: '右转\n前进\n左转\n前进\n如果 鸡舍里有鸡蛋 {\n  收鸡蛋\n}\n否则 {\n  喂鸡\n}',
  },
  {
    id: 'level-35',
    chapter: 'ch6',
    name: '第 35 关 · 边走边选',
    subtitle: '熟麦收掉，空地翻土',
    objective: '这一行有的格子是熟麦，有的是草地。边走边判断：熟了就收，否则翻土，把整行整理干净。',
    hints: [
      '用「重复 3 次」往前走，每次先前进一格再判断脚下。',
      '「如果 脚下是成熟小麦 { 收获 } 否则 { 翻土 }」正好管两种地。',
      '数一数这一行有几格，就知道要重复几次。',
    ],
    newCommands: [],
    par: 6,
    map: field(['@r.r.', '.', '.', '..T.........']),
    goal: { harvest: 2, till: 1 },
    starter: '// 重复 3 次：前进，熟了就收，否则翻土\n',
    solution: '重复 3 次 {\n  前进\n  如果 脚下是成熟小麦 {\n    收获\n  }\n  否则 {\n    翻土\n  }\n}',
  },
  {
    id: 'level-36',
    chapter: 'ch6',
    name: '第 36 关 · 大农场收官',
    subtitle: '一个人管好一座农场',
    objective: '种三格小麦喂饱 2 只鸡和 1 头牛，等一天，用「如果…否则…」收鸡蛋，最后挤牛奶。',
    hints: [
      '种地老配方：重复 3 次 { 翻土 / 播种 / 浇水 / 前进 }，等到小麦成熟后退回来全部收掉。',
      '走到鸡舍和奶牛中间那一格，先「喂鸡」再「喂牛」，3 捆稻草刚好够。',
      '等一天以后，用「如果 鸡舍里有鸡蛋 { 收鸡蛋 } 否则 { 喂鸡 }」保证不会白跑，最后挤牛奶。',
    ],
    newCommands: [],
    par: 28,
    map: field(['@...........', '............', '..C..c..c...', '.n..........', '..T.........']),
    goal: { plant: 3, water: 3, harvest: 3, feed: 2, feedCow: 1, egg: 2, milk: 1 },
    starter: '// 种三格 → 收稻草 → 喂鸡喂牛 → 等一天 → 判断收蛋 → 挤奶\n',
    solution: '重复 3 次 {\n  翻土\n  播种\n  浇水\n  前进\n}\n等待一天\n后退 3\n重复 3 次 {\n  收获\n  前进\n}\n后退 2\n右转\n前进 2\n喂鸡\n喂牛\n等待一天\n如果 鸡舍里有鸡蛋 {\n  收鸡蛋\n}\n否则 {\n  喂鸡\n}\n挤奶',
  },
];

/** 第 7 章 · 集市：把农产品换成金币，再用金币买种子和稻草。 */
const CH7 = [
  {
    id: 'level-37',
    chapter: 'ch7',
    name: '第 37 关 · 集市开张',
    subtitle: '鸡蛋换金币',
    objective: '鸡舍里已经有 4 枚鸡蛋。先收鸡蛋，再走到集市旁边写「卖出」，把鸡蛋换成金币。',
    hints: [
      '「卖出」会把背包里的鸡蛋、牛奶、小麦全部换成金币，集市价目表就在关卡提示里。',
      '1 枚鸡蛋 3 金币，4 枚就是 12 金币。先收蛋再卖，顺序别写反。',
      '集市在地图右下方，走到它上下左右相邻的那一格才能卖。',
    ],
    newCommands: ['卖出'],
    par: 7,
    startPendingEggs: 4,
    map: field(['@', '..C..c......', '............', '.....M......']),
    goal: { sold: 12 },
    starter: '// 先收鸡蛋，再去集市卖掉\n',
    solution: '前进 2\n收鸡蛋\n前进 4\n右转\n前进\n卖出',
  },
  {
    id: 'level-38',
    chapter: 'ch7',
    name: '第 38 关 · 买种子',
    subtitle: '金币换种子',
    objective: '集市旁边有 12 金币。写「买种子」花 3 金币买 2 颗种子，再回到起点翻土播种。',
    hints: [
      '「买种子」花 3 金币换 2 颗种子；写完看看背包里的种子有没有变多。',
      '买完要从集市走回起点，再用「翻土」「播种」把种子种下去。',
      '集市价格：卖蛋 3 金币、买种子 3 金币、买稻草 4 金币。',
    ],
    newCommands: ['买种子'],
    par: 9,
    startCoins: 12,
    map: field(['@', '............', '............', '.....M......']),
    goal: { plant: 1 },
    starter: '// 去集市买种子，再回起点播种\n',
    solution: '右转\n前进\n左转\n前进 6\n买种子\n后退 6\n翻土\n播种',
  },
  {
    id: 'level-39',
    chapter: 'ch7',
    name: '第 39 关 · 买稻草',
    subtitle: '买草喂牛',
    objective: '这头牛今天没奶，稻草也用完了。去集市花 4 金币买 1 捆稻草，回来喂牛，等一天再挤奶。',
    hints: [
      '「买稻草」花 4 金币换 1 捆稻草，正好够喂一头牛。',
      '顺序是：买稻草 → 走到奶牛旁边「喂牛」 → 「等待一天」 → 「挤奶」。',
      '奶牛在最下面一排，集市在旁边，来回都不远。',
    ],
    newCommands: ['买稻草'],
    par: 11,
    startCoins: 4,
    map: field(['@', '............', '.M..........', '.......n....']),
    goal: { feedCow: 1, milk: 1 },
    starter: '// 买稻草 → 喂牛 → 等一天 → 挤奶\n',
    solution: '右转\n前进\n买稻草\n前进\n前进\n左转\n前进 6\n喂牛\n等待一天\n挤奶',
  },
  {
    id: 'level-40',
    chapter: 'ch7',
    name: '第 40 关 · 集市毕业',
    subtitle: '稻草够就喂，不够就买',
    objective: '仓库里只剩 1 捆稻草，鸡舍旁有 3 只鸡等着吃。用「如果 稻草足够 { 喂鸡 } 否则 { 买稻草 }」决定先去哪边，最后把鸡蛋收回来。',
    hints: [
      '先数一数：3 只鸡要 3 捆稻草，仓库里只有 1 捆，所以「稻草足够」是假的，会走「否则」。',
      '在集市旁边买稻草，买够 3 捆再回到鸡舍旁写「喂鸡」。',
      '喂完「等待一天」，最后回到鸡舍旁「收鸡蛋」。',
    ],
    newCommands: ['稻草足够'],
    par: 14,
    startStraw: 1,
    startCoins: 12,
    map: field(['@', '..C..c..c..c', '............', '.....M......']),
    goal: { feed: 3, egg: 3 },
    starter: '// 稻草够就喂鸡，不够就先去买\n',
    solution: '前进 2\n如果 稻草足够 {\n  喂鸡\n}\n否则 {\n  前进 4\n  右转\n  前进\n  买稻草\n  买稻草\n  后退\n  左转\n  后退 4\n  喂鸡\n}\n等待一天\n收鸡蛋',
  },
];

/** 第 8 章 · 自动农活：「重复直到」——次数交给条件决定。 */
const CH8 = [
  {
    id: 'level-41',
    chapter: 'ch8',
    name: '第 41 关 · 一直走到熟麦',
    subtitle: '条件不成立就一直走',
    objective: '前面很远才有一株熟麦，不知道要走几格。写「重复直到 前方是成熟小麦 { 前进 }」，让代码自己判断什么时候停。',
    hints: [
      '「重复直到 条件 { ... }」会一直做，直到条件成立才停；条件一开始成立就一次也不做。',
      '「前方是成熟小麦」看的是正前方那一格。它一成立，循环就会停下来。',
      '停下来的时候人还站在熟麦前面一格，所以最后要再「前进」，然后「收获」。',
    ],
    newCommands: ['重复直到 ... { ... }'],
    par: 4,
    map: field(['@..r........', '.', '.', DECOR.treeAndWell]),
    goal: { harvest: 1 },
    starter: '// 一直走，直到前面出现熟麦\n',
    solution: '重复直到 前方是成熟小麦 {\n  前进\n}\n前进\n收获',
  },
  {
    id: 'level-42',
    chapter: 'ch8',
    name: '第 42 关 · 一直走到旗子',
    subtitle: '不用数格子',
    objective: '旗子在前面，但不用一格一格数。写「重复直到 到旗子了 { 前进 }」，走到就停。',
    hints: [
      '「到旗子了」在站上旗子那一刻才成立，所以循环会正好停在旗子上。',
      '这一关只要一句循环，不用写好几行「前进」。',
      '如果条件写反了，循环会一直转——测试会跑满 100 遍然后提醒你检查条件。',
    ],
    newCommands: [],
    par: 4,
    map: field(['@...G.......', '.', '.', DECOR.treeAndWell]),
    goal: { reach: { x: 5, y: 1 } },
    starter: '// 一直走到旗子\n',
    solution: '重复直到 到旗子了 {\n  前进\n}',
  },
  {
    id: 'level-43',
    chapter: 'ch8',
    name: '第 43 关 · 等到鸡下蛋',
    subtitle: '等到有蛋为止',
    objective: '仓库里有 2 捆稻草。先喂鸡，再写「重复直到 鸡舍里有鸡蛋 { 等待一天 }」，等蛋出来了再收。',
    hints: [
      '喂完鸡的第二天才会下蛋，所以「等待一天」要放进循环里。',
      '条件成立时循环立刻停，所以不会白等好几天。',
      '循环停下来以后，再写「收鸡蛋」把蛋收进背包。',
    ],
    newCommands: [],
    par: 7,
    startStraw: 2,
    map: field(['@', '..C..c..c...', '.', '..T.........']),
    goal: { feed: 2, egg: 2 },
    starter: '// 先喂鸡，再等到鸡舍里有蛋\n',
    solution: '右转\n前进\n左转\n前进\n喂鸡\n重复直到 鸡舍里有鸡蛋 {\n  等待一天\n}\n收鸡蛋',
  },
  {
    id: 'level-44',
    chapter: 'ch8',
    name: '第 44 关 · 自动农活收官',
    subtitle: '缺多少就买多少',
    objective: '集市旁有 12 金币，稻草却一根也没有，动物都饿着。用「重复直到 稻草足够 { 买稻草 }」把草备齐，再喂饱动物、收蛋挤奶。',
    hints: [
      '3 只动物要 3 捆稻草，1 捆 4 金币，12 金币刚好够——但不用自己数，交给循环判断。',
      '「稻草足够」会算「稻草够不够喂饱今天饿着的动物」，够了自己就会停。',
      '买完草走到鸡舍和奶牛中间那一格，喂鸡、喂牛、等一天，最后收蛋挤奶。',
    ],
    newCommands: [],
    par: 14,
    startCoins: 12,
    map: field(['@...........', '..C....c..c.', '............', '..n.........', '.....M......']),
    goal: { feed: 2, feedCow: 1, egg: 2, milk: 1 },
    starter: '// 用循环把稻草买到够用为止\n',
    solution: '前进 5\n右转\n前进 2\n重复直到 稻草足够 {\n  买稻草\n}\n右转\n前进 3\n喂鸡\n喂牛\n等待一天\n收鸡蛋\n挤奶',
  },
];

/**
 * 独立于教学关卡的沙盒模式。
 *
 * 它不属于 32 关课程，不参与关卡解锁和三星统计；复用同一套中文代码、
 * 世界规则与画面系统，但农场状态会在多次运行之间持续保留。
 */
export const FREE_MODE = {
  id: 'free-farm',
  mode: 'free',
  chapter: 'free',
  name: '自由农场',
  subtitle: '种地 · 养鸡 · 牧牛',
  objective: '这里没有过关目标。种小麦换来稻草，用稻草喂鸡喂牛，收鸡蛋、挤牛奶，慢慢把农场经营起来。',
  hints: [
    '收获 1 株小麦会得到 1 捆稻草，稻草是鸡和牛共同的口粮。',
    '走到鸡舍旁边写「喂鸡」，1 只鸡每天吃 1 捆稻草；写「等待一天」以后再到鸡舍旁写「收鸡蛋」。',
    '走到奶牛旁边写「喂牛」，喂饱的牛第二天才产奶，这时候再写「挤奶」。',
    '一头牛每天 1 瓶奶，挤完当天就没奶了，要再喂一次、再等一天。',
    '3 只鸡加 3 头牛，一天要吃掉 6 捆稻草，多种几格小麦才够用。',
    '判断条件也能用在这里：「如果 奶牛可以挤奶 { 挤奶 } 否则 { 喂牛 }」，让代码自己挑活干。',
    '右下角有座集市，走到旁边写「卖出」可以把鸡蛋、牛奶、小麦换成金币。',
    '金币能买种子和稻草：买种子 3 金币、买稻草 4 金币，卖蛋 3 金币、卖奶 5 金币、卖小麦 2 金币。',
    '自由农场会持续保存；点「重置农场」才会让土地和资源重新开始。',
  ],
  newCommands: ['喂鸡', '收鸡蛋', '喂牛', '挤奶', '卖出', '买种子', '买稻草', '如果 ... 否则 ...'],
  par: 0,
  map: field([
    '@...........',
    '............',
    '..C...c..c..',
    '.m...c......',
    '..W....T...n',
    '.....m......',
    '..M.........',
  ]),
  goal: null,
  starter: '// 自由农场：看看鸡舍和奶牛在哪里，再安排这一轮农活\n',
};

export const LEVELS = [...CH1, ...CH2, ...CH3, ...CH4, ...CH5, ...CH6, ...CH7, ...CH8];

export const LEVEL_INDEX = Object.fromEntries(LEVELS.map((level, index) => [level.id, index]));

export function getLevel(id) {
  const index = LEVEL_INDEX[id];
  return index === undefined ? null : LEVELS[index];
}

export function levelsOfChapter(chapterId) {
  return LEVELS.filter((level) => level.chapter === chapterId);
}

export function chapterOf(level) {
  return CHAPTERS.find((chapter) => chapter.id === level.chapter) ?? null;
}
