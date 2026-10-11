'use strict';
/* =========================================================================
   U1 教室组实物图：classroom / win / board / picture / door / pc / fan
   -------------------------------------------------------------------------
   构图全部照 tools/sprite-peek.js 打出来的简笔画对位：
   简笔画的每一笔在实物图里都要有对应的边或面，否则淡入的时候会「线飘在外面」。
   A.save() 会自动沿剪影压墨线并做对齐验收。
   ========================================================================= */
const A = require('./artkit.js');
const C = A.C;

/* ---------------- door 门 ----------------
   简笔画：外框 (22,8)-(78,92) + 门把手 (66,46)-(66,54) */
function door() {
  const im = A.canvas();
  A.outlined(im, [[22, 8], [78, 8], [78, 92], [22, 92]], C.WOOD);          // 门板
  A.poly(im, [[22, 8], [34, 8], [34, 92], [22, 92]], C.WOOD_L);            // 左侧受光面
  A.poly(im, [[68, 8], [78, 8], [78, 92], [68, 92]], C.WOOD_D);            // 右侧背光面
  // 上下两块门芯板：让门一眼是门，不是一块木头
  A.outlined(im, [[30, 16], [70, 16], [70, 42], [30, 42]], C.WOOD_L);
  A.outlined(im, [[30, 56], [70, 56], [70, 84], [30, 84]], C.WOOD_L);
  A.rect(im, 31, 17, 69, 20, C.WOOD_HI);
  A.rect(im, 31, 57, 69, 60, C.WOOD_HI);
  // 把手：简笔画给的是 (66,46)-(66,54) 这一段，做成一个竖着的黄铜拉手
  A.oRoundRect(im, 62, 44, 69, 56, C.YELLOW, 2);
  A.rect(im, 64, 46, 66, 54, C.YELLOW_L);
  return im;
}

/* ---------------- board 黑板 ----------------
   简笔画：板面 (10,12)-(90,64) + 两条腿 (34,68)-(34,88)、(66,68)-(66,88) + 横撑 (26,88)-(74,88)
   配色压到 7 色：木框 2 + 板面 1 + 粉笔 2 + 墨线 1（原来的深绿条和粉色粉笔都并掉了） */
function board() {
  const im = A.canvas();
  // ① 先画腿和横撑，板面后画盖上去（四肢先画、衣服后画那条规则）
  A.rect(im, 32, 60, 37, 89, C.WOOD_D);
  A.rect(im, 63, 60, 68, 89, C.WOOD_D);
  A.outlined(im, [[26, 86], [74, 86], [74, 90], [26, 90]], C.WOOD);
  // ② 木框
  A.outlined(im, [[10, 12], [90, 12], [90, 64], [10, 64]], C.WOOD);
  A.rect(im, 11, 13, 89, 15, C.WOOD_L);
  A.rect(im, 11, 61, 89, 63, C.WOOD_D);
  // ③ 墨绿色板面
  A.rect(im, 14, 17, 86, 59, C.GREEN_D);
  // ④ 粉笔字：横线 + 一个乘号，暗示「黑板」而不是一块绿板
  A.line(im, 20, 26, 52, 26, C.PAPER, 1);
  A.line(im, 20, 33, 44, 33, C.PAPER, 1);
  A.line(im, 20, 40, 58, 40, C.PAPER, 1);
  A.stroke(im, [[66, 24], [72, 36], [66, 48]], C.YELLOW_L, 2);
  A.line(im, 62, 36, 76, 36, C.YELLOW_L, 2);
  // ⑤ 粉笔槽 + 两支粉笔
  A.rect(im, 16, 60, 84, 62, C.WOOD_D);
  A.rect(im, 20, 58, 30, 61, C.PAPER);
  A.rect(im, 32, 58, 40, 61, C.YELLOW_L);
  return im;
}

/* ---------------- win 窗户 ----------------
   简笔画：窗框 (14,14)-(86,86) + 竖中梃 x=50 + 横中梃 y=50 → 四格玻璃 */
function win() {
  const im = A.canvas();
  // ① 四块玻璃先铺满
  A.rect(im, 14, 14, 86, 86, C.GLASS);
  A.poly(im, [[14, 86], [86, 14], [86, 50], [14, 86]], C.GLASS_L);   // 斜向高光
  A.rect(im, 16, 16, 48, 48, C.GLASS_L);
  A.rect(im, 52, 52, 84, 84, C.GLASS_D);
  // ② 窗框：外圈 + 十字中梃（覆盖在玻璃上，形成四格）
  A.rect(im, 14, 14, 86, 19, C.PAPER);
  A.rect(im, 14, 81, 86, 86, C.PAPER);
  A.rect(im, 14, 14, 19, 86, C.PAPER);
  A.rect(im, 81, 14, 86, 86, C.PAPER);
  A.rect(im, 47, 14, 53, 86, C.PAPER);
  A.rect(im, 14, 47, 86, 53, C.PAPER);
  A.rect(im, 47, 14, 49, 86, C.PAPER_D);
  A.rect(im, 14, 47, 86, 49, C.PAPER_D);
  // ③ 玻璃上的高光条，让窗「亮」起来
  A.poly(im, [[22, 44], [44, 22], [44, 26], [24, 44]], C.PAPER_HI);
  A.poly(im, [[56, 44], [78, 22], [78, 26], [58, 44]], C.PAPER_HI);
  A.oRoundRect(im, 72, 56, 78, 60, C.METAL_L, 1);   // 窗锁
  return im;
}

/* ---------------- picture 图画 ----------------
   简笔画：画框 (12,16)-(88,84) + 山线 (22,68)→(38,48)→(50,60)→(64,42)→(82,68)
           + 太阳 (66,28)-(74,36) + 小鸟 (34,30)-(42,30)
   配色 8 色：墨线 / 木框 2 / 天 1 / 远山 1 / 近山 1 / 草地 1 / 太阳 1 */
function picture() {
  const im = A.canvas();
  // ① 天空
  A.rect(im, 12, 16, 88, 84, C.GLASS);
  // ② 山：完全照简笔画那条折线，左右两条边往下封口
  A.poly(im, [[22, 68], [38, 48], [50, 60], [64, 42], [82, 68]], C.PURPLE_L);
  A.poly(im, [[38, 48], [50, 60], [44, 70], [28, 70]], C.PURPLE_D);
  A.poly(im, [[64, 42], [82, 70], [54, 70], [56, 60]], C.PURPLE_D);
  A.poly(im, [[38, 48], [42, 53], [34, 53]], C.GLASS);      // 雪顶
  A.poly(im, [[64, 42], [68, 48], [60, 48]], C.GLASS);
  // ③ 草地盖住山脚（先画山再画草，山就被「种」进地里了）
  A.rect(im, 12, 68, 88, 84, C.GREEN);
  A.poly(im, [[12, 68], [34, 74], [56, 70], [88, 76], [88, 68], [12, 68]], C.GREEN);
  // ④ 太阳：简笔画给的是 (66,28)-(74,36) 那个小方框
  A.oCircle(im, 70, 32, 6, C.YELLOW);
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]])
    A.line(im, 70 + d[0] * 7, 32 + d[1] * 7, 70 + d[0] * 9, 32 + d[1] * 9, C.YELLOW, 1);
  // ⑤ 小鸟：简笔画 (34,30)→(42,30) 那一段
  A.stroke(im, [[31, 30], [35, 26], [39, 30], [43, 26], [47, 30]], C.INK, 1);
  // ⑥ 画框最后画，压住画面四边
  A.rect(im, 12, 16, 88, 21, C.WOOD);
  A.rect(im, 12, 79, 88, 84, C.WOOD);
  A.rect(im, 12, 16, 17, 84, C.WOOD);
  A.rect(im, 83, 16, 88, 84, C.WOOD);
  A.rect(im, 12, 16, 14, 84, C.WOOD_D);
  A.rect(im, 86, 16, 88, 84, C.WOOD_D);
  return im;
}

/* ---------------- pc 计算机 ----------------
   简笔画：显示器 (12,16)-(88,58) + 立柱 (50,58)-(50,68) + 底座线 (36,68)-(64,68)
           + 键盘 (22,68)-(78,86)
   配色 8 色：墨线 / 深灰壳 / 屏幕 2 / 键盘 2 / 支架 1 / 屏上图形 1 */
function pc() {
  const im = A.canvas();
  // ① 显示器外壳
  A.outlined(im, [[12, 16], [88, 16], [88, 58], [12, 58]], C.DARK);
  // ② 屏幕：浅蓝底 + 几条「内容」，一眼是亮着的
  A.rect(im, 17, 21, 83, 53, C.GLASS);
  A.poly(im, [[17, 53], [83, 21], [83, 32], [17, 53]], C.GLASS_L);   // 斜向高光
  A.rect(im, 21, 27, 48, 31, C.PAPER);
  A.rect(im, 21, 35, 60, 39, C.PAPER);
  A.rect(im, 21, 43, 40, 47, C.PAPER);
  A.rect(im, 55, 27, 79, 47, C.YELLOW_L);
  A.stroke(im, [[58, 44], [64, 33], [70, 40], [76, 29]], C.DARK, 1);   // 小折线图
  A.oCircle(im, 22, 50, 2, C.YELLOW_L);                                // 状态点
  // ③ 支架 + 底座（先画，键盘后画盖住底部）
  A.rect(im, 47, 58, 53, 72, C.METAL);
  A.rect(im, 34, 64, 66, 69, C.METAL);
  // ④ 键盘：64px 上画不出一个个键，改成「灰键区 + 白色键缝」，一眼就是键盘
  A.outlined(im, [[22, 68], [78, 68], [78, 86], [22, 86]], C.PAPER);
  A.rect(im, 24, 70, 76, 85, C.METAL_L);
  A.line(im, 24, 74, 76, 74, C.PAPER, 1);
  A.line(im, 24, 78, 76, 78, C.PAPER, 1);
  A.line(im, 24, 81, 76, 81, C.PAPER, 1);
  A.rect(im, 36, 82, 64, 85, C.METAL_L);
  A.line(im, 36, 82, 36, 85, C.PAPER, 1);
  A.line(im, 64, 82, 64, 85, C.PAPER, 1);
  return im;
}

/* ---------------- fan 电扇 ----------------
   简笔画：立柱 (50,50)-(50,12) 与 (50,50)-(50,88)、两片扇叶指向 (82,64) 与 (18,64)、
           底座 (32,88)-(68,88)。构图画成一台立式电扇：底座 + 立柱 + 圆形机头 + 两片扇叶。
   配色 8 色：墨线 / 金属 4 档 / 扇叶面 1 / 机身深色 1 / 按键 1 */
function fan() {
  const im = A.canvas();
  // ① 底座（中间会被立柱压住，先画）
  A.oEllipse(im, 50, 87, 19, 5, C.METAL_L);
  A.ellipse(im, 50, 86, 15, 3, C.METAL_D);
  // ② 立柱：简笔画的竖线从 y=12 通到 y=88，画成一根从底座升到头部的杆
  A.rect(im, 47, 48, 53, 88, C.METAL);
  A.rect(im, 47, 48, 49, 88, C.METAL_HI);
  A.rect(im, 51, 48, 53, 88, C.METAL_D);
  // ③ 扇叶先画，机头后画盖住根部（四肢先画、衣服后画）
  A.oEllipse(im, 32, 60, 16, 7, C.METAL_L);
  A.oEllipse(im, 68, 60, 16, 7, C.METAL_L);
  A.poly(im, [[37, 56], [46, 58], [44, 64], [35, 64]], C.METAL_HI);
  A.poly(im, [[63, 56], [54, 58], [56, 64], [65, 64]], C.METAL_HI);
  // ④ 机头（简笔画里扇叶汇聚的中心就在 (50,50)）
  A.oCircle(im, 50, 50, 9, C.METAL);
  A.circle(im, 50, 50, 5, C.METAL_L);
  A.circle(im, 50, 50, 2, C.DARK);
  A.rect(im, 46, 41, 54, 44, C.METAL_D);
  // ⑤ 立柱上半段：细一点的提杆 + 顶帽
  A.rect(im, 48, 14, 52, 44, C.METAL_L);
  A.rect(im, 48, 14, 49, 44, C.METAL_HI);
  A.oRoundRect(im, 43, 10, 57, 16, C.METAL, 2);
  // ⑥ 按键
  A.circle(im, 50, 72, 2, C.RED);
  A.circle(im, 50, 78, 2, C.METAL_D);
  return im;
}

/* ---------------- classroom 教室 ----------------
   简笔画：后墙 (12,12)-(88,50) + 黑板线 (22,42)-(78,42) + 两张课桌 (20,55)-(48,68)、(52,55)-(80,68)
           + 桌腿 U 形 (20,68)→(20,88)→(48,88)→(48,68) 和右边一张 */
function classroom() {
  const im = A.canvas();
  // ① 后墙
  A.rect(im, 12, 12, 88, 50, C.PAPER);
  A.rect(im, 12, 12, 88, 15, C.PAPER_D);
  // ② 黑板：简笔画给的是 (22,42)-(78,42) 那条线，做成挂在墙上的小板
  A.outlined(im, [[20, 24], [80, 24], [80, 44], [20, 44]], C.WOOD_L);
  A.rect(im, 23, 27, 77, 41, C.GREEN_D);
  A.line(im, 27, 31, 50, 31, C.PAPER, 1);
  A.line(im, 27, 36, 42, 36, C.PAPER, 1);
  A.line(im, 58, 32, 72, 32, C.PAPER, 1);
  // ③ 地板
  A.rect(im, 12, 50, 88, 88, C.WOOD_L);
  A.line(im, 12, 50, 88, 50, C.WOOD_D, 1);
  for (let i = 0; i < 4; i++) A.line(im, 12, 58 + i * 9, 88, 58 + i * 9, C.WOOD, 1);
  A.rect(im, 12, 86, 88, 88, C.WOOD_D);
  // ④ 两张课桌：桌面后画，压住桌腿根部（四肢先画、衣服后画）
  for (const [x0, x1] of [[20, 48], [52, 80]]) {
    A.rect(im, x0 + 1, 68, x0 + 4, 88, C.WOOD_D);          // 左腿
    A.rect(im, x1 - 4, 68, x1 - 1, 88, C.WOOD_D);          // 右腿
    A.rect(im, x0 + 3, 78, x1 - 3, 81, C.WOOD_D);          // 横撑（简笔画 U 的底边）
    A.outlined(im, [[x0, 55], [x1, 55], [x1, 68], [x0, 68]], C.WOOD);
    A.rect(im, x0 + 1, 56, x1 - 1, 59, C.WOOD_L);          // 桌面受光
    A.rect(im, x0 + 1, 65, x1 - 1, 67, C.WOOD_D);
    A.rect(im, x0 + 6, 62, x1 - 6, 66, C.WOOD_D);          // 桌斗阴影
  }
  // ⑤ 桌面上放两本书，一眼是「教室」
  A.rect(im, 26, 51, 42, 55, C.RED);
  A.rect(im, 58, 52, 74, 55, C.GREEN_D);
  return im;
}

/* ---------------- wall 墙 ----------------
   简笔画：三层砖线 y=22 / 50 / 78，上层竖缝 x=34、62，下层竖缝 x=20、70 */
function wall() {
  const im = A.canvas();
  A.rect(im, 8, 22, 92, 78, C.PAPER);            // 灰浆底
  const brick = (x0, y0, x1, y1, c) => {
    A.rect(im, x0, y0, x1, y1, c);
    A.rect(im, x0, y0, x1, y0 + 2, C.MEAT_L);    // 上沿受光
    A.rect(im, x0, y1 - 2, x1, y1, C.MEAT_D);    // 下沿背光
  };
  // 上层：竖缝在 34 和 62
  brick(8, 22, 34, 50, C.MEAT);
  brick(34, 22, 62, 50, C.MEAT_D);
  brick(62, 22, 92, 50, C.MEAT);
  // 下层：竖缝错开，落在 20 和 70 —— 错缝才像砖墙
  brick(8, 50, 20, 78, C.MEAT_D);
  brick(20, 50, 70, 78, C.MEAT);
  brick(70, 50, 92, 78, C.MEAT_D);
  // 砖缝：把每块砖再切成两条，2 行砌法更清楚
  A.line(im, 8, 36, 92, 36, C.PAPER, 1);
  A.line(im, 8, 64, 92, 64, C.PAPER, 1);
  A.line(im, 8, 22, 92, 22, C.PAPER, 1);
  A.line(im, 8, 78, 92, 78, C.PAPER, 1);
  return im;
}

/* ---------------- floor 地板 ----------------
   简笔画：两条分隔线 y=28 / 60，上层竖缝 x=40，下层竖缝 x=26、70 */
function floor() {
  const im = A.canvas();
  // 上层：横向铺的木板
  A.rect(im, 8, 28, 92, 60, C.WOOD);
  A.rect(im, 8, 28, 92, 32, C.WOOD_L);
  A.rect(im, 8, 56, 92, 60, C.WOOD_D);
  A.line(im, 40, 28, 40, 60, C.WOOD_D, 1);
  for (let i = 1; i < 4; i++) A.line(im, 8, 28 + i * 8, 92, 28 + i * 8, C.WOOD_L, 1);
  // 下层：竖缝错开的两块
  A.rect(im, 8, 60, 26, 92, C.WOOD_D);
  A.rect(im, 26, 60, 70, 92, C.WOOD);
  A.rect(im, 70, 60, 92, 92, C.WOOD_D);
  A.rect(im, 26, 60, 70, 64, C.WOOD_L);
  A.rect(im, 26, 88, 70, 92, C.WOOD_D);
  for (let i = 1; i < 4; i++) A.line(im, 8, 60 + i * 8, 92, 60 + i * 8, C.WOOD_HI, 1);
  A.line(im, 8, 60, 92, 60, C.WOOD_HI, 1);
  return im;
}

/* ---------------- chair 椅子 ----------------
   简笔画：靠背 (28,14)-(72,52) 的 U 形 + 坐面 (20,52)-(80,52) + 两条腿 (28,56)-(28,92)、(72,56)-(72,92) */
function chair() {
  const im = A.canvas();
  // ① 两条腿先画，坐面后画盖住根部
  A.rect(im, 26, 50, 31, 92, C.WOOD_D);
  A.rect(im, 69, 50, 74, 92, C.WOOD_D);
  A.rect(im, 31, 86, 69, 89, C.WOOD_D);          // 横撑
  // ② 靠背：两根立柱 + 顶横梁 + 两根横档
  A.rect(im, 26, 14, 31, 52, C.WOOD);
  A.rect(im, 69, 14, 74, 52, C.WOOD);
  A.rect(im, 26, 14, 74, 19, C.WOOD);
  A.rect(im, 26, 14, 74, 16, C.WOOD_L);
  A.rect(im, 31, 26, 69, 30, C.WOOD);
  A.rect(im, 31, 38, 69, 42, C.WOOD);
  A.rect(im, 31, 26, 69, 27, C.WOOD_L);
  A.rect(im, 31, 38, 69, 39, C.WOOD_L);
  // ③ 坐面最后画：一块厚板，压住靠背立柱和椅腿的根部
  A.outlined(im, [[20, 46], [80, 46], [80, 56], [20, 56]], C.WOOD);
  A.rect(im, 21, 47, 79, 50, C.WOOD_L);
  A.rect(im, 21, 54, 79, 55, C.WOOD_D);
  // ④ 坐面两侧的螺栓，坐实「家具」的感觉
  A.circle(im, 24, 51, 1.5, C.METAL_D);
  A.circle(im, 76, 51, 1.5, C.METAL_D);
  return im;
}

/* ---------------- pencil 铅笔 ----------------
   简笔画：(16,88) 笔尖 →(24,74)→(74,16) 一条长边 →(84,28) 笔尾 →(34,84)→ 回到笔尖。
   沿两条长边做参数化分带：木锥 / 笔杆 / 金属箍 / 橡皮，这样每一段都正好落在简笔画里。 */
function pencil() {
  const im = A.canvas();
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const A0 = [24, 74], A1 = [74, 16];      // 上面那条长边
  const B0 = [34, 84], B1 = [84, 28];      // 下面那条长边
  const bandAt = (t0, t1, c) => {
    A.poly(im, [lerp(A0, A1, t0), lerp(A0, A1, t1), lerp(B0, B1, t1), lerp(B0, B1, t0)], c);
  };
  A.poly(im, [[16, 88], A0, B0], C.WOOD_L);          // 削出来的木锥
  A.poly(im, [[16, 88], lerp(A0, A1, .05), lerp(B0, B1, .05)], C.INK);   // 笔芯尖端
  bandAt(.05, .22, C.WOOD_L);                        // 露出的木头
  A.line(im, A0[0], A0[1], lerp(A0, A1, .22)[0], lerp(A0, A1, .22)[1], C.WOOD_D, 1);
  bandAt(.22, .82, C.YELLOW);                        // 笔杆
  bandAt(.22, .82, C.YELLOW);                        // （再来一次压掉木锥的边缘锯齿）
  A.poly(im, [lerp(A0, A1, .28), lerp(A0, A1, .76), lerp(B0, B1, .74), lerp(B0, B1, .26)], C.YELLOW_L);
  bandAt(.82, .90, C.METAL_L);                       // 金属箍
  bandAt(.90, 1, C.PINK);                            // 橡皮
  A.poly(im, [lerp(A0, A1, .93), lerp(A0, A1, 1), lerp(B0, B1, 1), lerp(B0, B1, .93)], C.PINK_L);
  return im;
}

/* ---------------- book 书 ----------------
   简笔画：左页 (50,26)→(18,18)→(18,80)→(50,88)，右页镜像，中间书脊 (50,26)-(50,88)。
   画成摊开的书：封面在下面，两页纸在上面，书脊压中间。 */
function book() {
  const im = A.canvas();
  const SP = [[50, 26], [50, 88]];
  // ① 封面：只比纸大一点点，露出来的就是封皮（大太多包围盒会涨过简笔画）
  A.poly(im, [[50, 24], [16, 16], [16, 82], [50, 90], [84, 82], [84, 16]], C.RED_D);
  // ② 两页纸
  A.poly(im, [[50, 26], [18, 18], [18, 80], [50, 88]], C.PAPER);
  A.poly(im, [[50, 26], [82, 18], [82, 80], [50, 88]], C.PAPER);
  A.poly(im, [[50, 26], [18, 18], [18, 26], [50, 34]], C.PAPER_D);      // 左页上沿投影
  A.poly(im, [[50, 26], [82, 18], [82, 26], [50, 34]], C.PAPER_D);
  A.poly(im, [[50, 80], [18, 72], [18, 80], [50, 88]], C.PAPER_D);      // 左页下沿背光
  A.poly(im, [[50, 80], [82, 72], [82, 80], [50, 88]], C.PAPER_D);
  // ③ 书上的字：横线越靠外越短，模拟文字的透视
  const rows = [[36, 44, 74], [42, 38, 68], [48, 34, 64], [54, 30, 58], [60, 26, 50], [66, 22, 42]];
  rows.forEach(([y, inL, inR]) => {
    const k = (y - 34) / 32;
    A.line(im, 22 + k * 8, y, inL + k * 4, y, C.METAL_D, 1);
    A.line(im, inR - k * 4, y, 78 - k * 8, y, C.METAL_D, 1);
  });
  // ④ 书脊压中间，把两页分开
  A.line(im, SP[0][0], SP[0][1], SP[1][0], SP[1][1], C.RED_D, 2);
  A.line(im, 18, 18, 18, 80, C.RED, 1);
  A.line(im, 82, 18, 82, 80, C.RED, 1);
  return im;
}

/* ---------------- teacher 老师 ----------------
   简笔画：头 (50,12) 六边形 + 身体 (44,40)-(56,66) + 左臂 (44,46)→(26,58)→(24,70)
           + 右臂 (56,46)→(70,56)→(86,28)（举起来指黑板）+ 两条腿 (44,66)→(34,90)、(56,66)→(66,90) */
function teacher() {
  const im = A.canvas();
  // ① 腿先画
  A.line(im, 46, 64, 38, 90, C.SKIN_SH, 4);
  A.line(im, 54, 64, 62, 90, C.SKIN_SH, 4);
  A.line(im, 35, 90, 41, 90, C.INK, 2);
  A.line(im, 59, 90, 65, 90, C.INK, 2);
  // ② 胳膊先画（简笔画从 (44,46)/(56,46) 起笔，那是身体里面），衣服后画盖住肩部
  A.line(im, 45, 46, 27, 58, C.SKIN, 4);
  A.line(im, 27, 58, 24, 70, C.SKIN_SH, 3);
  A.line(im, 55, 46, 70, 56, C.SKIN, 4);
  A.line(im, 70, 56, 86, 28, C.SKIN, 4);
  // ③ 连衣裙：上窄下宽，盖住四肢根部
  A.outlined(im, [[44, 40], [56, 40], [64, 68], [36, 68]], C.BLUE);
  A.poly(im, [[50, 41], [56, 40], [64, 68], [50, 68]], C.BLUE_L);
  A.rect(im, 44, 52, 56, 55, C.YELLOW_D);               // 腰带
  A.poly(im, [[36, 68], [64, 68], [64, 72], [36, 72]], C.BLUE_D);
  // ④ 手里那根教鞭：简笔画右臂终点 (86,28)，不许伸出去，否则包围盒会涨
  A.line(im, 76, 44, 86, 26, C.YELLOW_D, 2);
  A.line(im, 70, 56, 76, 46, C.SKIN_SH, 2);
  // ⑤ 头最后画
  A.outlined(im, [[50, 12], [62, 18], [64, 30], [56, 38], [44, 38], [36, 30], [38, 18]], C.SKIN);
  A.poly(im, [[38, 19], [42, 13], [50, 12], [60, 17], [64, 25], [58, 22], [50, 24], [43, 21]], C.HAIR);
  A.poly(im, [[50, 12], [62, 18], [64, 30], [57, 33], [52, 25]], C.HAIR);
  A.poly(im, [[58, 22], [64, 24], [64, 30], [58, 35], [56, 30]], C.SKIN_SH);
  A.rect(im, 45, 26, 47, 28, C.INK);                    // 眼睛
  A.rect(im, 53, 26, 55, 28, C.INK);
  A.line(im, 47, 33, 53, 33, C.SKIN_SH, 1);             // 嘴
  // ⑥ 眼镜，老师感更强
  A.line(im, 43, 27, 57, 27, C.INK, 1);
  A.line(im, 40, 27, 43, 27, C.INK, 1);
  A.line(im, 57, 27, 60, 27, C.INK, 1);
  return im;
}

for (const [name, make] of [
  ['door', door], ['board', board], ['win', win], ['picture', picture],
  ['pc', pc], ['fan', fan],
  ['classroom', classroom], ['wall', wall], ['floor', floor],
  ['chair', chair], ['pencil', pencil], ['book', book], ['teacher', teacher]
]) A.save(name, make());
