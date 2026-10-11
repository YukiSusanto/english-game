#!/usr/bin/env node
/* =========================================================================
   sketch-status.js —— 简笔画素材进度表
   -------------------------------------------------------------------------
   用法：
     node tools/sketch-status.js            看总进度 + 还差哪些
     node tools/sketch-status.js --todo P0  只看 P0（画错的，会误导孩子）
     node tools/sketch-status.js --todo P1  只看 P1（共用太多，看图题会歧义）
     node tools/sketch-status.js --shared   只看「一张图被多个词共用」
     node tools/sketch-status.js --md       输出 Markdown 表格（贴进文档用）
     node tools/sketch-status.js --strict   有 P0/P1 未完成就以非 0 退出（可挂 CI）

   优先级定义：
     P0  当前图是【错的】——例如尺子/钥匙/刀叉画成了扳手，会教错孩子
     P1  【共用过多或过于笼统】——看图选词会歧义，或画得不像
     P2  【抽象词】——不参与看图选词，但简笔画演出时值得更好看
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const { ROOT, loadConsts } = require('./_extract.js');
const { RAW, SKETCH } = loadConsts(['RAW','SKETCH']);

/* ---------------------------------------------------------------
   ★ 需求清单：单词 → [目标图形 key, 优先级, 该画成什么样]
   不在表里的单词 = 沿用现在的图形，已经合格
   --------------------------------------------------------------- */
const PLAN = {
/* ===== Unit 1  My classroom ===== */
  light      : ['light',      'P0', '天花板吊灯：一根垂线 + 一个梯形灯罩 + 底下一条亮线'],
  crayon     : ['crayon',     'P0', '蜡笔：短粗的笔身 + 中间一圈纸卷 + 尖头'],
  ruler      : ['ruler',      'P0', '直尺：一个细长条 + 5 道等距刻度短线'],
  classroom  : ['classroom',  'P1', '教室：一块黑板（带粉笔槽）+ 前面两排小课桌'],
  teacher    : ['teacher',    'P1', '老师：一个人形 + 手上拿教鞭 + 旁边一块小黑板'],
  clean      : ['broom',      'P2', '扫帚：一根斜柄 + 三角扫头 + 两道须'],
  help       : ['helpinghand','P2', '帮助：一只手抓住另一只手（两只手叠在一起）'],
  near       : ['neararrow',  'P2', '靠近：两个点 + 一个指向另一点的箭头'],
 much       : ['manydots',   'P2', '许多：一堆大小不一的小圆点，挤在一起'],
  open       : ['openbox',    'P2', '打开：一个盖子掀开的箱子 + 一道开启的弧线'],
  close      : ['closedoor',  'P2', '关上：一扇关着的门 + 一个挂锁'],

/* ===== Unit 2  My schoolbag ===== */
  key        : ['key',        'P0', '钥匙：一个圆环 + 一条直柄 + 尾部两个齿'],
  eraser     : ['eraser',     'P0', '橡皮：一个长方体 + 一角切成斜面'],
  candy      : ['candy',      'P0', '糖果：中间一个圆糖 + 两头拧起来的糖纸'],
  toy        : ['teddy',      'P0', '玩具：一只小熊（圆头 + 两个耳朵 + 圆身 + 四肢）'],
  maths      : ['maths',      'P1', '数学书：一本翻开的书 + 书页上一个加号和一个减号'],
  english    : ['english',    'P1', '英语书：一本书 + 书页上写 A B C'],
  chinese    : ['chinese',    'P1', '语文书：一本书 + 书页上三道横和一个「丨」'],
  storybook  : ['storybook',  'P1', '故事书：一本书 + 书页上冒出一颗星星'],
  notebook   : ['notebook',   'P1', '笔记本：一个方块 + 左边一排线圈小圆'],
  colour     : ['palette',    'P1', '颜色：一个调色盘（椭圆缺一口）+ 三个颜色点'],
  fat        : ['fatcat',     'P1', '胖的：一只圆滚滚的猫（大圆身 + 小耳朵 + 尾巴）'],

/* ===== Unit 3  My friends ===== */
  hair       : ['hair',       'P0', '头发：一个侧脸轮廓 + 头顶一束波浪长发'],
  glasses    : ['glasses',    'P0', '眼镜：两个圈 + 中间鼻梁 + 两侧镜腿'],
  shoe       : ['shoe',       'P0', '鞋：一个侧影（鞋底 + 鞋面 + 鞋带两道）'],
  hat        : ['hat',        'P0', '帽子：一个半圆帽顶 + 一条宽帽檐'],
  friend     : ['twofriends', 'P1', '朋友：两个并排站着的小人 + 中间一道握手线'],
  photo      : ['photo',      'P1', '照片：一个相框 + 框里一个头肩剪影 + 顶上一根挂绳'],
  boy        : ['boy',        'P1', '男孩：短头发的小孩（圆头 + 短发 + 短袖短裤）'],
  girl       : ['girl',       'P1', '女孩：双马尾的小孩（圆头 + 两条辫子 + 裙子）'],
  sports     : ['running',    'P1', '运动：一个跑步的小人（前倾 + 两臂摆动 + 两腿跨开）'],
  strong     : ['muscle',     'P1', '强壮的：一条弯起来的手臂（上臂 + 前臂 + 鼓起的肌肉弧）'],
  long       : ['longarrow',  'P2', '长的：一根被拉得很长的双向箭头'],
  short      : ['shortarrow', 'P2', '短的：一根短的双向箭头'],
  thin       : ['thinman',    'P2', '瘦的：一个细长条的人形（头 + 一根细身 + 两根细腿）'],
  quiet      : ['quietface',  'P2', '安静：一张脸 + 嘴上一道竖线（嘘）+ 旁边一个 Z'],
  name       : ['nametag',    'P2', '名字：一个长方形名牌 + 上面两道横线'],
  science    : ['flask',      'P2', '科学：一个三角烧瓶 + 瓶口 + 里面两条液面线'],

/* ===== Unit 4  My home ===== */
  table      : ['table',      'P0', '桌子：一个桌面 + 四条腿（和课桌区分：课桌要画抽屉）'],
  sofa       : ['sofa',       'P0', '沙发：一个宽坐垫 + 靠背 + 两侧扶手'],
  bath       : ['bathtub',    'P0', '洗澡：一个浴缸（方底圆角）+ 上面三个泡泡'],
  study      : ['study',      'P1', '书房：一个房间 + 里面一格一格的書架 + 一张小桌'],
  bathroom   : ['bathroom',   'P1', '卫生间：一个浴缸 + 一个花洒（带喷头）'],
  bedroom    : ['bedroom',    'P1', '卧室：一个房间轮廓 + 里面一张床'],
  kitchen    : ['kitchen',    'P1', '厨房：一个灶台 + 上面一口锅 + 冒热气'],
  fridge     : ['fridge',     'P1', '冰箱：一个高箱子 + 中间一道横线分成两门 + 两个把手'],
  find       : ['magnifier',  'P1', '找到：一个放大镜（圆圈 + 斜柄）'],
  home       : ['home',       'P1', '家：屋顶三角形 + 方形墙 + 一扇门 + 一个烟囱'],
  garden     : ['garden',     'P1', '花园：一排栅栏 + 三朵小花（花心 + 花瓣 + 花茎）'],
  where      : ['wherepin',   'P2', '哪里：一个定位针 + 针上一个问号'],
  here       : ['herepin',    'P2', '这里：一个定位针 + 针上一个对勾'],

/* ===== Unit 5  Dinner is ready ===== */
  knife      : ['knife',      'P0', '刀：一个三角刀身 + 一条刀背 + 一个短柄'],
  fork       : ['fork',       'P0', '叉子：一个柄 + 四根齿'],
  chopsticks : ['chopsticks', 'P0', '筷子：两根并排的细长棍，上粗下细'],
  spoon      : ['spoon',      'P0', '勺子：一个椭圆勺头 + 一条柄'],
  egg        : ['egg',        'P0', '鸡蛋：一个上窄下宽的椭圆'],
  beef       : ['beef',       'P1', '牛肉：一块带骨头的牛排（不规则方块 + 一根骨头）'],
  chicken    : ['drumstick',  'P1', '鸡肉：一只鸡腿（大椭圆 + 一根骨头）'],
  noodles    : ['noodles',    'P1', '面条：一个碗 + 三条波浪线 + 一双筷子'],
  soup       : ['soup',       'P1', '汤：一个碗 + 上面三条热气曲线'],
  vegetable  : ['broccoli',   'P1', '蔬菜：一棵西兰花（云朵状菜冠 + 一根茎）'],
  bread      : ['bread',      'P1', '面包：一个长条形面包 + 上面两道斜纹'],
  rice       : ['rice',       'P1', '米饭：一个碗 + 碗口一个半圆形的饭堆'],
  dinner     : ['dinner',     'P1', '晚餐：一个盘子 + 左右各一把刀和叉'],
  hungry     : ['hungry',     'P1', '饥饿的：一个空盘子 + 旁边一张张开的嘴（或咕咕叫的肚子）'],
  milk       : ['milkbox',    'P1', '牛奶：一个牛奶盒（方盒 + 顶部斜角 + 一条横线）'],
  juice      : ['juice',      'P1', '果汁：一个杯子 + 一根斜插的吸管'],
  pass       : ['passhand',   'P2', '传递：两只手 + 中间一个正在递过去的小方块'],

/* ===== Unit 6  Meet my family ===== */
  football   : ['football',   'P0', '足球：一个圆 + 中间一个五边形 + 周围几条拼接线'],
  basketball : ['basketball', 'P0', '篮球：一个圆 + 一条竖线 + 两条弧线'],
  family     : ['family',     'P1', '家庭：三个高矮不同的人并排（高 + 中 + 小）'],
  parents    : ['parents',    'P1', '父母：两个大人并排（左边略高）'],
  uncle      : ['manadult',   'P1', '叔叔：一个成年男人（宽肩 + 长裤）'],
  father     : ['manadult',   'P1', '爸爸：同「成年男人」（可以共用同一张图）'],
  aunt       : ['womanadult', 'P1', '姑姑：一个成年女人（长发 + 裙子）'],
  mother     : ['womanadult', 'P1', '妈妈：同「成年女人」（可以共用同一张图）'],
  baby       : ['baby',       'P1', '婴儿：一个圆头 + 圆身的小不点 + 嘴里一个奶嘴'],
  brother    : ['boybig',     'P1', '兄弟：一个大一点的男孩（比 boy 高一点）'],
  sister     : ['girlbig',    'P1', '姐妹：一个大一点的女孩（比 girl 高一点）'],
  doctor     : ['doctor',     'P1', '医生：一个人 + 脖子上挂听诊器（两条线 + 一个圆头）'],
  nurse      : ['nurse',      'P1', '护士：一个人 + 头上戴护士帽（方块 + 一个十字）'],
  cook       : ['cook',       'P1', '厨师：一个人 + 一顶高高的厨师帽'],
  driver     : ['driver',     'P1', '司机：一个人 + 前面一个方向盘（圆 + 三根辐条）'],
  farmer     : ['farmer',     'P1', '农民：一个人 + 一顶草帽 + 一把锄头'],
  job        : ['briefcase',  'P1', '工作：一个公文包（方块 + 上面一个提手）'],
  people     : ['crowd',      'P1', '人们：三个并排的小人（一样高，间距均匀）'],
  puppy      : ['dog',        'P1', '小狗：一只小狗（圆头 + 垂耳 + 四条腿 + 尾巴），不要用爪印'],
};

/* ---------------- 分析 ---------------- */
const words = [];
const seen = new Set();
for (const u in RAW) for (const r of RAW[u]) {
  if (seen.has(r[0])) continue;
  seen.add(r[0]);
  words.push({ word: r[0], cn: r[1], art: r[5], unit: u, tag: r[4] });
}
const have = new Set(Object.keys(SKETCH).filter(k => k !== '__default'));

const byArt = {};
words.forEach(w => (byArt[w.art] = byArt[w.art] || []).push(w));

/* ★ 动词（tag==='verb'）走动作演出，不需要简笔画 —— 从工单里剔除 */
const rowsAll = words.map(w => {
  const p = PLAN[w.word];
  return {
    word: w.word, cn: w.cn, unit: w.unit, verb: (w.tag === 'verb'),
    cur: w.art,
    share: shareOf(w.art),
    target: p ? p[0] : w.art,
    pri: p ? p[1] : '✓',
    desc: p ? p[2] : '',
    /* ★ 唯一判定标准：当前这个单词用的图形必须是【专属的】且【有简笔画】。
       PLAN 里的 target 只是「建议画成什么样」，不是判定依据 ——
       这样工具口径和 pipeline-status、和游戏实际状态三者完全一致。 */
    done: shareOf(w.art) === 1 && have.has(w.art)
  };
});
function shareOf(art){ let n=0; for(const r of words) if(r.art===art) n++; return n; }
const ACTIONS = rowsAll.filter(r => r.verb);
const rows = rowsAll.filter(r => !r.verb);

const todo = rows.filter(r => !r.done);
const byPri = p => rows.filter(r => r.pri === p);
const doneByPri = p => byPri(p).filter(r => r.done).length;

/* ---------------- 输出 ---------------- */
const args = process.argv.slice(2);
const only = args.includes('--todo') ? args[args.indexOf('--todo') + 1] : null;
const md = args.includes('--md');

if (args.includes('--shared')) {
  console.log('===== 一张图被多个词共用 =====\n');
  Object.keys(byArt).sort((a, b) => byArt[b].length - byArt[a].length)
    .filter(k => byArt[k].length > 1)
    .forEach(k => {
      const planned = byArt[k].filter(w => PLAN[w.word] && PLAN[w.word][0] !== k).length;
      console.log(`【${k}】${byArt[k].length} 个词，其中 ${planned} 个已计划拆分`);
      console.log('   ' + byArt[k].map(w => `${w.word}(${w.cn})`).join('、') + '\n');
    });
  process.exit(0);
}

if (md) {
  const list = only ? rows.filter(r => r.pri === only) : rows.filter(r => r.pri !== '✓');
  console.log('| 单词 | 中文 | 单元 | 目标图形 key | 该画成什么样 |');
  console.log('|---|---|---|---|---|');
  list.forEach(r => console.log(`| \`${r.word}\` | ${r.cn} | U${r.unit} | \`${r.target}\` | ${r.desc} |`));
  process.exit(0);
}

const show = only ? rows.filter(r => r.pri === only && !r.done)
                  : todo;
console.log('简笔画素材进度');
console.log('==========================================');
console.log(`名词总数 ${rows.length}　已有图形 ${have.size} 个　待画 ${todo.length} 个`);
console.log(`动词（走动作演出，不用画）  ${ACTIONS.length} 个：${ACTIONS.map(r=>r.word).join(' ')}`);
console.log(`  P0 画错的（会误导）      ${doneByPri('P0')}/${byPri('P0').length}`);
console.log(`  P1 共用/笼统（会歧义）    ${doneByPri('P1')}/${byPri('P1').length}`);
console.log(`  P2 抽象词（好看而已）      ${doneByPri('P2')}/${byPri('P2').length}`);
console.log(`  ✓  已经合格              ${rows.filter(r => r.pri === '✓').length}`);
console.log('==========================================\n');

if (!show.length) {
  console.log('🎉 这一档全部画完了！');
} else {
  console.log(`${only ? only + ' 还差' : '还差'} ${show.length} 个：\n`);
  show.sort((a, b) => a.unit - b.unit).forEach(r => {
    console.log(`[${r.pri}] U${r.unit} ${r.word.padEnd(12)} ${r.cn.padEnd(8)} → ${r.target}`);
    console.log(`      ${r.desc}`);
  });
}

if (args.includes('--strict')) {
  const left = rows.filter(r => (r.pri === 'P0' || r.pri === 'P1') && !r.done).length;
  if (left) { console.error(`\n❌ 还有 ${left} 个 P0/P1 简笔画没画`); process.exit(1); }
}
