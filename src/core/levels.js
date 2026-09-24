/**
 * 关卡数据：4 个章节、共 26 关。
 *
 * 分段原则（每一章只解锁一类新语法，参照《地牢围攻》的关卡设计规范）：
 *   第 1 章 顺序编程：把动作一行一行写清楚，不许写循环和判断
 *   第 2 章 重复：     发现重复，用「重复 N 次 { ... }」收起来
 *   第 3 章 判断：     看脚下是什么，再决定做不做
 *   第 4 章 综合：     循环里套判断，完成真正的农活
 *
 * 铁律：一关只教一个新东西。starter 必须是空的（第 1 关留一行示范），
 * objective 和 hints 里不许提前提到还没教过的指令。
 *
 * 地图图例（见 world.js）：
 *   '.' 草地   '_' 翻好的土   's' 幼苗   'r' 成熟小麦
 *   '#' 栅栏   'T' 树   'W' 水井   'R' 石头
 *   'H' 小屋   'B' 谷仓（占 2×2，字符为左下角）
 *   'C' 鸡舍（占 2×1，字符为左下角）   '~' 池塘
 *   'c' 小鸡   'm' 奶牛   'G' 目标旗子
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
    forbidden: ['repeat'],
  },
  {
    id: 'ch2',
    name: '第 2 章 · 重复',
    subtitle: '第 11~16 关',
    goal: '发现重复的动作，用「重复」把一长串代码收起来',
    allow: ['重复 N 次 { ... }'],
    forbidden: ['if'],
  },
  {
    id: 'ch3',
    name: '第 3 章 · 判断',
    subtitle: '第 17~22 关',
    goal: '先看看脚下是什么，再决定要不要做这件事',
    allow: ['如果 脚下是... { ... }', '脚下是草地 / 泥土 / 幼苗 / 成熟小麦'],
    forbidden: [],
  },
  {
    id: 'ch4',
    name: '第 4 章 · 综合',
    subtitle: '第 23~26 关',
    goal: '把循环和判断都用起来，一个人管好整片农田',
    allow: ['全部指令', '重复里套如果'],
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

/** 第 4 章 · 综合 */
const CH4 = [
  {
    id: 'level-23',
    chapter: 'ch4',
    name: '第 23 关 · 见草就翻',
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
    id: 'level-24',
    chapter: 'ch4',
    name: '第 24 关 · 见熟就收',
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
    id: 'level-25',
    chapter: 'ch4',
    name: '第 25 关 · 种三格收三格',
    subtitle: '来回跑一趟',
    objective: '先把左边三格种好、浇好水，等一天，再回头把小麦全部收掉。',
    hints: [
      '第一圈：重复 3 次 { 翻土 / 播种 / 浇水 / 前进 }。',
      '中间加一句「等待一天」。',
      '收的时候要先退回到起点，再重复 3 次 { 收获 / 前进 }。',
    ],
    newCommands: [],
    par: 20,
    map: field(['@', '.', '.', DECOR.barnAndHouse]),
    goal: { plant: 3, water: 3, harvest: 3 },
    starter: '// 先种，再等，最后收\n',
    solution: '重复 3 次 {\n  翻土\n  播种\n  浇水\n  前进\n}\n等待一天\n后退 3\n重复 3 次 {\n  收获\n  前进\n}',
  },
  {
    id: 'level-26',
    chapter: 'ch4',
    name: '第 26 关 · 毕业挑战',
    subtitle: '一个人管好一片田',
    objective: '种下四格小麦，等一天，全部收回，最后走到旗子那里。',
    hints: [
      '和上一关一样的节奏，只是把 3 换成 4。',
      '收完最后一格正好走到旗子上，不用再写别的。',
    ],
    newCommands: [],
    par: 26,
    map: field(['@...G', '.', '.', DECOR.barnAndHouse]),
    goal: { plant: 4, water: 4, harvest: 4, reach: { x: 5, y: 1 } },
    starter: '// 种四格、等一天、收四格，走到旗子\n',
    solution: '重复 4 次 {\n  翻土\n  播种\n  浇水\n  前进\n}\n等待一天\n后退 4\n重复 4 次 {\n  收获\n  前进\n}',
  },
];

/**
 * 通关后的自由农场。
 *
 * 它不属于 26 关课程，不参与关卡解锁和三星统计；复用同一套中文代码、
 * 世界规则与画面系统，但农场状态会在多次运行之间持续保留。
 */
export const FREE_MODE = {
  id: 'free-farm',
  mode: 'free',
  chapter: 'free',
  name: '自由农场',
  subtitle: '种田养鸡',
  objective: '这里没有过关目标。种小麦、收稻草、喂鸡，等一天后到鸡舍旁收鸡蛋。',
  hints: [
    '收获 1 株小麦会得到 1 捆稻草，稻草可以喂鸡。',
    '走到鸡舍旁边写「喂鸡」，1 只鸡每天吃 1 捆稻草。',
    '喂过鸡以后写「等待一天」，再到鸡舍旁写「收鸡蛋」，鸡蛋才会进背包。',
    '自由农场会持续保存；点「重置农场」才会让土地和资源重新开始。',
  ],
  newCommands: ['喂鸡', '收鸡蛋'],
  par: 0,
  map: field([
    '@...........',
    '............',
    '............',
    '....C...c.c.',
    '..W.....T...',
  ]),
  goal: null,
  starter: '// 自由农场：先看看鸡舍在哪里，再安排这一轮农活\n',
};

export const LEVELS = [...CH1, ...CH2, ...CH3, ...CH4];

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
