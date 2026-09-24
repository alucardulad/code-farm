/**
 * 素材致谢。
 *
 * 音效与音乐全部来自本机统一素材库（Freesound / Jamendo）：
 *   CC0 免署名；CC BY 必须标出作者与来源，所以这里集中登记，
 *   游戏内「素材致谢」面板和 README 共用这份数据。
 */

export const MUSIC_CREDITS = [
  {
    title: 'Happy Coconuts (60s Edit)',
    author: 'HoneyTune',
    license: 'CC BY',
    source: 'https://www.jamendo.com/track/2269002',
    note: '第 1~2 章背景音乐',
  },
  {
    title: 'An Easy Step of Luck',
    author: 'Efr - Enhanced Full Rate',
    license: 'CC BY',
    source: 'https://www.jamendo.com/track/1540325',
    note: '第 3~4 章背景音乐',
  },
];

export const SFX_CREDITS = [
  { name: 'Wet Click', author: 'Breviceps', license: 'CC0', id: 448080, note: '点击按钮' },
  { name: 'Left Grass/Grassy Footstep 6', author: 'Ali_6868', license: 'CC0', id: 384865, note: '走路脚步' },
  { name: 'Space Swoosh - brighter', author: 'GameAudio', license: 'CC0', id: 220191, note: '转身' },
  { name: 'shoveling-dirt', author: 'JeffPearson', license: 'CC0', id: 849840, note: '翻土' },
  { name: 'Planting (Seeds)', author: 'wyronroberth', license: 'CC0', id: 516249, note: '播种' },
  { name: 'Pouring Liquid', author: 'Dvideoguy', license: 'CC0', id: 207781, note: '浇水' },
  { name: 'water drop', author: 'florianreichelt', license: 'CC0', id: 683102, note: '发芽' },
  { name: 'Triple Ping Notification', author: 'PiesHelpfulOven', license: 'CC0', id: 842513, note: '生长提示' },
  { name: 'Pull Plant', author: 'Jofae', license: 'CC0', id: 387083, note: '收获' },
  { name: 'Retro, Coin 01', author: 'LilMati', license: 'CC0', id: 402067, note: '金币' },
  { name: 'Rooster Crow 1', author: 'BenjaminNelan', license: 'CC0', id: 435508, note: '新的一天' },
  { name: 'Chicken clucking 3', author: 'MBPL', license: 'CC0', id: 668803, note: '小鸡' },
  { name: 'z-moo01', author: 'Zozzy', license: 'CC0', id: 59245, note: '奶牛' },
  { name: 'Plop!', author: 'Breviceps', license: 'CC0', id: 447910, note: '走不通' },
  { name: 'Buzzer sounds (Wrong answer)', author: 'Breviceps', license: 'CC0', id: 493163, note: '代码有错' },
  { name: 'victory chime', author: '1bob', license: 'CC0', id: 717771, note: '过关' },
  { name: 'Win Spacey', author: 'GameAudio', license: 'CC0', id: 220184, note: '通关庆祝' },
  { name: 'Bird chirping', author: 'supercell10', license: 'CC0', id: 266832, note: '鸟鸣环境音' },
];

export const FREESOUND_URL = (id) => `https://freesound.org/s/${id}/`;
