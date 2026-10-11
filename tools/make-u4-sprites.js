'use strict';
/* =========================================================================
   U4 房间组实物图：study / bathroom / bedroom / kitchen / room
                    phone / bed / fridge / home / garden
   -------------------------------------------------------------------------
   这一组几乎全是「场景」，构图要点和单个物件不同：
     · 先把房间的墙/地大面积铺好，家具是压在上面的一层层色块
     · 每张图都留一个「一眼认出来」的锚点：书房的书架、卫生间的花洒、
       卧室的枕头、厨房的锅、房间的门、花园的栅栏……
     · 颜色预算 4~8：大面积底色最多用两档，把色数留给锚点
   ========================================================================= */
const A = require('./artkit.js');
const C = A.C;

/* ---------------- study 书房 ----------------
   简笔画：屋顶尖 (15,22)→(50,10)→(85,22) + 房间 (85,88)→(15,88) 封口
           + 书架 (22,34)-(42,76) 带两条隔板线 + 书桌 (50,68)-(78,82) */
function study() {
  const im = A.canvas();
  // ① 墙 + 地。墙用暖奶油色而不是纯白 —— 纯白墙面占掉整张图 28% 的像素，
  //    远看就是一个空框；暖色一压，房间立刻有「屋子」的感觉，色数还不变。
  A.outlined(im, [[15, 22], [50, 10], [85, 22], [85, 88], [15, 88]], C.CREAM);
  A.rect(im, 15, 78, 85, 88, C.WOOD_D);
  A.rect(im, 15, 78, 85, 80, C.WOOD);
  // ② 墙上的画和挂钟，把右上角那片空白填掉
  A.outlined(im, [[54, 30], [74, 30], [74, 48], [54, 48]], C.WOOD);
  A.rect(im, 56, 32, 72, 46, C.WOOD_D);
  A.poly(im, [[56, 46], [61, 37], [66, 43], [70, 34], [72, 46]], C.WOOD);
  A.oCircle(im, 30, 62, 5, C.WOOD_L);
  A.line(im, 30, 62, 30, 58, C.WOOD_D, 1);
  A.line(im, 30, 62, 33, 64, C.WOOD_D, 1);
  // ③ 书架（锚点）：三格，每格塞几本书
  A.outlined(im, [[22, 34], [42, 34], [42, 76], [22, 76]], C.WOOD);
  A.rect(im, 24, 36, 40, 46, C.WOOD_D);
  A.rect(im, 24, 48, 40, 58, C.WOOD_D);
  A.rect(im, 24, 60, 40, 74, C.WOOD_D);
  const books = [[25, 38, C.RED], [28, 37, C.BLUE], [31, 39, C.YELLOW_D], [34, 38, C.WOOD],
                 [25, 51, C.BLUE], [28, 50, C.RED], [31, 52, C.YELLOW_D], [34, 50, C.WOOD],
                 [25, 63, C.YELLOW_D], [28, 62, C.RED], [31, 64, C.BLUE], [34, 62, C.WOOD]];
  books.forEach(([x, y, c]) => A.rect(im, x, y, x + 2.4, y + 9, c));
  A.rect(im, 36, 62, 39, 74, C.WOOD_L);
  // ④ 书桌 + 椅子
  A.outlined(im, [[50, 68], [78, 68], [78, 82], [50, 82]], C.WOOD);
  A.rect(im, 51, 69, 77, 72, C.WOOD_L);
  A.rect(im, 51, 80, 77, 81, C.WOOD_D);
  A.rect(im, 54, 74, 58, 82, C.WOOD_D);
  A.rect(im, 70, 74, 74, 82, C.WOOD_D);
  A.poly(im, [[59, 66], [64, 66], [63, 68], [59, 68]], C.WOOD_L);   // 摊开的书
  A.poly(im, [[64, 66], [69, 66], [69, 68], [65, 68]], C.WOOD_L);
  A.rect(im, 72, 62, 74, 68, C.WOOD_D);                   // 台灯杆
  A.poly(im, [[69, 58], [77, 58], [76, 62], [70, 62]], C.YELLOW_D);
  return im;
}

/* ---------------- bathroom 卫生间 ----------------
   简笔画：浴缸 (16,54)→(84,54)→(80,76)→(70,86)→(30,86)→(20,76)
           + 淋浴管 (70,54)→(70,24)→(82,18) + 花洒 (82,18)-(92,28)
           + 两组水花 (28,36)→(34,30)→(40,36)→(46,30)→(52,36)、(62,36)→(68,30)→(74,36) */
function bathroom() {
  const im = A.canvas();
  // ① 淋浴管和花洒先画，浴缸后画盖住根部
  A.line(im, 70, 54, 70, 26, C.METAL, 3);
  A.stroke(im, [[70, 26], [80, 19]], C.METAL, 3);
  A.poly(im, [[80, 15], [92, 18], [92, 28], [80, 25]], C.METAL_L);
  A.rect(im, 81, 25, 91, 27, C.METAL);
  // ② 水花：简笔画那两条折线，画成一串水珠
  for (const [x0, y0] of [[28, 36], [34, 30], [40, 36], [46, 30], [52, 36],
                          [62, 36], [68, 30], [74, 36]]) {
    A.line(im, x0, y0, x0, y0 + 7, C.GLASS_L, 1);
    A.circle(im, x0, y0 + 9, 1.4, C.GLASS);
  }
  // ③ 浴缸：先画缸体，再压缸里的水，最后画缸沿
  A.outlined(im, [[16, 54], [84, 54], [80, 76], [70, 86], [30, 86], [20, 76]], C.PAPER);
  A.poly(im, [[20, 56], [80, 56], [77, 70], [23, 70]], C.GLASS);
  A.poly(im, [[20, 56], [80, 56], [79, 60], [21, 60]], C.GLASS_L);
  A.rect(im, 24, 54, 76, 57, C.PAPER);                    // 缸沿
  A.rect(im, 30, 78, 70, 81, C.PAPER_D);                  // 缸底阴影
  // ④ 泡沫
  A.circle(im, 30, 57, 3, C.PAPER_HI);
  A.circle(im, 38, 56, 4, C.PAPER_HI);
  A.circle(im, 47, 57, 3, C.PAPER_HI);
  A.circle(im, 56, 56, 4, C.PAPER_HI);
  A.circle(im, 65, 57, 3, C.PAPER_HI);
  // ⑤ 龙头
  A.oRoundRect(im, 84, 48, 90, 56, C.METAL_L, 2);
  A.line(im, 84, 50, 80, 50, C.METAL_L, 2);
  return im;
}

/* ---------------- bedroom 卧室 ----------------
   简笔画：房间 (14,20)-(86,88) + 床体 (22,58)-(78,82) + 床头板 (22,42)-(78,58)
           + 枕头 (30,48)-(44,58) */
function bedroom() {
  const im = A.canvas();
  // ① 墙 + 地
  A.outlined(im, [[14, 20], [86, 20], [86, 88], [14, 88]], C.PAPER);
  A.rect(im, 14, 78, 86, 88, C.WOOD_L);
  A.rect(im, 14, 78, 86, 80, C.WOOD);
  // ② 挂画和床头灯，让墙不空
  A.outlined(im, [[20, 30], [34, 30], [34, 44], [20, 44]], C.WOOD);
  A.poly(im, [[22, 42], [26, 35], [30, 40], [33, 34], [33, 42]], C.BLUE);
  A.oRoundRect(im, 62, 28, 76, 36, C.BLUE_D, 3);
  A.line(im, 69, 36, 69, 44, C.WOOD_D, 1);
  // ③ 床：床头板先画，床垫后画盖住根部
  A.outlined(im, [[22, 40], [78, 40], [78, 56], [22, 56]], C.WOOD);
  A.rect(im, 23, 41, 77, 45, C.WOOD_L);
  A.rect(im, 23, 53, 77, 55, C.WOOD_D);
  // ④ 床垫 + 被子
  A.outlined(im, [[22, 56], [78, 56], [78, 84], [22, 84]], C.PAPER_HI);
  A.outlined(im, [[38, 62], [78, 62], [78, 84], [38, 84]], C.BLUE);
  A.poly(im, [[62, 63], [78, 62], [78, 84], [62, 84]], C.BLUE_D);
  A.line(im, 38, 66, 78, 66, C.BLUE_D, 1);
  // ⑤ 枕头：简笔画 (30,48)-(44,58)
  A.oRoundRect(im, 26, 46, 46, 60, C.PAPER_HI, 3);
  A.line(im, 36, 48, 36, 59, C.BLUE, 1);
  // ⑥ 床尾和床腿
  A.rect(im, 22, 84, 78, 87, C.WOOD_D);
  A.rect(im, 23, 86, 28, 90, C.WOOD_D);
  A.rect(im, 72, 86, 77, 90, C.WOOD_D);
  return im;
}

/* ---------------- kitchen 厨房 ----------------
   简笔画：灶台 (12,58)-(88,84) + 抽油烟机 (28,42)-(72,58) + 锅 (38,30)-(62,42)
           + 两缕蒸汽 (46,30)→(50,20)→(54,30)、(58,30)→(64,20)→(68,30) */
function kitchen() {
  const im = A.canvas();
  // ① 蒸汽先画（在后面），锅和烟机后画盖住根部
  A.stroke(im, [[50, 32], [46, 26], [52, 21]], C.PAPER_D, 2);
  A.stroke(im, [[62, 32], [66, 26], [61, 21]], C.PAPER_D, 2);
  // ② 抽油烟机
  A.outlined(im, [[28, 42], [72, 42], [72, 50], [28, 50]], C.METAL_L);
  A.poly(im, [[28, 42], [72, 42], [66, 34], [34, 34]], C.METAL);
  A.rect(im, 30, 50, 70, 54, C.METAL_L);
  A.rect(im, 34, 54, 66, 58, C.METAL);
  // ③ 锅：简笔画 (38,30)-(62,42)
  A.oEllipse(im, 50, 34, 12, 5, C.DARK);
  A.poly(im, [[38, 34], [62, 34], [60, 44], [40, 44]], C.METAL);
  A.poly(im, [[50, 34], [62, 34], [60, 44], [50, 44]], C.METAL_D);
  A.oEllipse(im, 50, 34, 12, 5, C.METAL_L);
  A.ellipse(im, 50, 34, 9, 3, C.YELLOW_D);                // 锅里的东西
  A.line(im, 38, 36, 30, 36, C.DARK, 2);                  // 锅把手
  A.line(im, 62, 36, 70, 36, C.DARK, 2);
  // ④ 灶台
  A.outlined(im, [[12, 58], [88, 58], [88, 84], [12, 84]], C.PAPER);
  A.rect(im, 13, 59, 87, 63, C.DARK);
  A.rect(im, 13, 61, 87, 63, C.METAL_L);
  A.circle(im, 28, 71, 4, C.DARK);
  A.circle(im, 46, 71, 4, C.DARK);
  A.circle(im, 30, 71, 2, C.YELLOW_D);
  A.circle(im, 64, 71, 3, C.DARK);
  A.circle(im, 74, 71, 3, C.DARK);
  A.rect(im, 13, 80, 87, 83, C.PAPER_D);
  A.line(im, 12, 78, 88, 78, C.PAPER_D, 1);
  return im;
}

/* ---------------- room 房间 ----------------
   简笔画：房间 (12,18)-(88,88) + 墙上的画 (24,30)-(48,54) + 门 (60,58)-(76,88)
           + 门把手 (66,68)-(72,68) */
function room() {
  const im = A.canvas();
  // ① 墙 + 地
  A.outlined(im, [[12, 18], [88, 18], [88, 88], [12, 88]], C.PAPER);
  A.rect(im, 12, 80, 88, 88, C.WOOD_L);
  A.rect(im, 12, 80, 88, 82, C.WOOD);
  // ② 墙上的画（锚点）
  A.outlined(im, [[24, 30], [48, 30], [48, 54], [24, 54]], C.WOOD);
  A.rect(im, 26, 32, 46, 52, C.PURPLE_L);
  A.poly(im, [[26, 52], [32, 40], [38, 47], [44, 34], [46, 52]], C.PURPLE_D);
  A.circle(im, 41, 37, 3, C.PURPLE_L);
  // ③ 地板上的地毯
  A.oEllipse(im, 34, 84, 18, 5, C.RED);
  A.ellipse(im, 34, 84, 13, 3, C.PURPLE_L);
  // ④ 门：简笔画 (60,58)-(76,88)
  A.outlined(im, [[60, 56], [78, 56], [78, 88], [60, 88]], C.WOOD);
  A.rect(im, 61, 57, 77, 60, C.WOOD_L);
  A.rect(im, 61, 85, 77, 87, C.WOOD);
  A.outlined(im, [[64, 64], [74, 64], [74, 78], [64, 78]], C.WOOD_L);
  A.oCircle(im, 73, 83, 2, C.PURPLE_L);                  // 门把手
  return im;
}

/* ---------------- phone 电话 ----------------
   简笔画：机身 (30,8)-(70,92) + 听筒/屏幕线 (42,18)-(58,18) + 按键 (46,82)-(54,82) */
function phone() {
  const im = A.canvas();
  A.oRoundRect(im, 30, 8, 70, 92, C.DARK, 5);
  A.rect(im, 31, 88, 69, 90, C.METAL_D);
  // 屏幕
  A.rect(im, 34, 15, 66, 78, C.GLASS);
  A.poly(im, [[34, 78], [66, 15], [66, 40], [34, 78]], C.GLASS_L);
  A.rect(im, 34, 15, 66, 19, C.PAPER);                    // 状态栏
  A.rect(im, 36, 17, 42, 18, C.DARK);                     // 听筒（简笔画 (42,18)-(58,18) 那一段）
  A.rect(im, 44, 24, 64, 28, C.PAPER);                    // 一条消息
  A.rect(im, 48, 32, 64, 36, C.PAPER);
  A.rect(im, 36, 40, 56, 44, C.PAPER);
  A.rect(im, 42, 48, 64, 52, C.PAPER);
  A.circle(im, 44, 62, 5, C.GREEN);                       // 一个圆形图标
  A.rect(im, 52, 58, 64, 66, C.PAPER);
  A.rect(im, 36, 70, 64, 76, C.PAPER);
  // 底部按键（简笔画 (46,82)-(54,82)）
  A.oRoundRect(im, 44, 81, 56, 88, C.METAL_D, 2);
  A.rect(im, 40, 84, 42, 85, C.METAL_D);
  A.rect(im, 58, 84, 60, 85, C.METAL_D);
  return im;
}

/* ---------------- bed 床 ----------------
   简笔画：床头立柱 (10,26)-(10,86) + 上沿 (10,26)-(72,26) + 右立柱 (72,26)-(72,52)
           + 床面 (10,52)-(64,52) + 枕头 (18,36)-(36,36)-(36,52) + 两条腿 (18,86)-(18,94)、(72,86)-(72,94) */
function bed() {
  const im = A.canvas();
  // ① 床腿先画
  A.rect(im, 15, 84, 22, 94, C.WOOD);
  A.rect(im, 68, 84, 75, 94, C.WOOD);
  // ② 床头板（简笔画高的那一头在左）
  A.outlined(im, [[10, 26], [20, 26], [20, 86], [10, 86]], C.WOOD);
  A.outlined(im, [[66, 26], [72, 26], [72, 54], [66, 54]], C.WOOD);
  A.rect(im, 10, 26, 72, 32, C.WOOD);
  A.rect(im, 10, 26, 72, 29, C.WOOD_L);
  A.rect(im, 11, 33, 19, 84, C.WOOD_L);
  // ③ 床垫 + 被子，压住床头板的根部
  A.outlined(im, [[12, 52], [72, 52], [72, 84], [12, 84]], C.PAPER_HI);
  A.outlined(im, [[30, 56], [72, 56], [72, 84], [30, 84]], C.BLUE);
  A.poly(im, [[58, 57], [72, 56], [72, 84], [58, 84]], C.BLUE_D);
  A.rect(im, 30, 56, 72, 60, C.BLUE_L);
  A.line(im, 30, 62, 72, 62, C.BLUE_D, 1);
  // ④ 枕头（简笔画 (18,36)-(36,52)）
  A.oRoundRect(im, 18, 40, 36, 54, C.PAPER_HI, 3);
  A.line(im, 27, 42, 27, 53, C.PAPER, 1);
  return im;
}

/* ---------------- fridge 冰箱 ----------------
   简笔画：箱体 (26,10)-(74,90) + 分门线 y=48 + 上下两个把手 (64,26)-(68,40)、(64,58)-(68,72) */
function fridge() {
  const im = A.canvas();
  A.oRoundRect(im, 26, 10, 74, 90, C.PAPER, 3);
  // 左受光、右背光，白色家电才有体积
  A.rect(im, 27, 12, 34, 88, C.PAPER_HI);
  A.rect(im, 66, 12, 73, 88, C.PAPER_D);
  // 上下门的分缝
  A.rect(im, 27, 46, 73, 50, C.PAPER_D);
  A.line(im, 26, 48, 74, 48, C.METAL_D, 1);
  A.line(im, 27, 12, 73, 12, C.METAL_L, 1);
  // 把手：简笔画给的是 (64,26)-(68,40) 和 (64,58)-(68,72)
  A.oRoundRect(im, 62, 24, 69, 42, C.METAL_L, 2);
  A.oRoundRect(im, 62, 56, 69, 74, C.METAL_L, 2);
  A.rect(im, 63, 26, 65, 40, C.METAL_HI);
  A.rect(im, 63, 58, 65, 72, C.METAL_HI);
  // 门上的便签和磁贴：一眼是家里的冰箱
  A.rect(im, 38, 24, 54, 38, C.YELLOW_L);
  A.line(im, 40, 28, 52, 28, C.METAL_D, 1);
  A.line(im, 40, 32, 50, 32, C.METAL_D, 1);
  A.line(im, 40, 35, 48, 35, C.METAL_D, 1);
  A.rect(im, 52, 20, 56, 24, C.YELLOW_L);
  A.circle(im, 44, 60, 3, C.METAL_D);
  A.rect(im, 28, 86, 72, 89, C.METAL_D);                  // 底脚
  return im;
}

/* ---------------- home 家 ----------------
   简笔画：屋顶 (12,44)→(50,12)→(88,44) + 屋身 (88,44)→(88,88)→(12,88) 封口
           + 门 (40,88)-(40,64)-(60,64)-(60,88) + 窗 (24,52)-(38,66) + 烟囱 (70,30)-(80,14)-(80,36) */
function home() {
  const im = A.canvas();
  // ① 烟囱先画，屋顶后画盖住根部
  A.outlined(im, [[70, 30], [70, 14], [80, 14], [80, 36]], C.RED_D);
  A.rect(im, 70, 14, 80, 17, C.RED);
  // ② 屋身
  A.outlined(im, [[12, 44], [88, 44], [88, 88], [12, 88]], C.PAPER);
  A.rect(im, 13, 46, 87, 49, C.PAPER_D);
  A.rect(im, 12, 85, 88, 88, C.PAPER_D);
  // ③ 屋顶（压住屋身上沿和烟囱根部）
  A.outlined(im, [[12, 44], [50, 12], [88, 44]], C.RED);
  A.rect(im, 12, 42, 88, 46, C.RED_D);
  // ④ 门
  A.outlined(im, [[40, 64], [60, 64], [60, 88], [40, 88]], C.WOOD);
  A.oCircle(im, 57, 77, 2, C.GLASS);
  // ⑤ 窗（简笔画 (24,52)-(38,66)）
  A.outlined(im, [[23, 51], [39, 51], [39, 67], [23, 67]], C.PAPER);
  A.rect(im, 25, 53, 37, 65, C.GLASS);
  A.rect(im, 30, 53, 32, 65, C.PAPER);
  A.rect(im, 25, 58, 37, 60, C.PAPER);
  // ⑥ 门前的小路和两丛草
  A.poly(im, [[46, 88], [54, 88], [58, 92], [42, 92]], C.PAPER_D);
  A.circle(im, 18, 84, 4, C.GREEN);
  A.circle(im, 24, 86, 3, C.GREEN);
  A.circle(im, 80, 84, 4, C.GREEN);
  A.circle(im, 74, 86, 3, C.GREEN);
  return im;
}

/* ---------------- garden 花园 ----------------
   简笔画：地面线 (10,62)-(90,62) + 栅栏 (12,62)→(12,82)→(24,82)→(24,62)→(46,62)→…
           + 三朵花 (24,54)→(24,38)→(18,32)→(24,26)→(30,32) 与 (50,…)、(76,…) */
function garden() {
  const im = A.canvas();
  // ① 草地
  A.rect(im, 10, 60, 90, 84, C.GREEN);
  A.rect(im, 10, 60, 90, 63, C.GREEN_L);
  A.rect(im, 10, 80, 90, 84, C.GREEN_D);
  // ② 三朵花先画，栅栏后画挡住花茎根部
  const flower = (x, top, petal) => {
    A.line(im, x, 62, x, top + 6, C.GREEN_D, 2);
    A.poly(im, [[x, 52], [x - 7, 57], [x, 61]], C.GREEN_D);              // 叶子
    A.poly(im, [[x, 48], [x + 7, 53], [x, 57]], C.GREEN);
    A.oCircle(im, x, top + 5, 5, petal);
    A.circle(im, x, top + 5, 2, C.YELLOW);
  };
  flower(24, 27, C.PINK);
  flower(50, 25, C.RED);
  flower(76, 29, C.PURPLE);
  // ③ 白色栅栏：简笔画那排交错的高低段
  const picket = (x, y0, y1) => {
    A.outlined(im, [[x - 5, y0 + 3], [x, y0], [x + 5, y0 + 3], [x + 5, y1], [x - 5, y1]], C.PAPER);
    A.rect(im, x - 4, y0 + 4, x - 3, y1 - 2, C.PAPER_HI);
    A.rect(im, x + 3, y0 + 4, x + 4, y1 - 2, C.PAPER_D);
  };
  [[14, 62, 84], [26, 60, 84], [38, 62, 84], [50, 60, 84], [62, 62, 84], [74, 60, 84], [86, 62, 84]]
    .forEach(([x, y0, y1]) => picket(x, y0, y1));
  A.rect(im, 10, 68, 90, 72, C.PAPER);
  A.rect(im, 10, 76, 90, 80, C.PAPER);
  A.rect(im, 10, 71, 90, 73, C.PAPER_D);
  A.rect(im, 10, 79, 90, 81, C.PAPER_D);
  return im;
}

for (const [name, make] of [
  ['study', study], ['bathroom', bathroom], ['bedroom', bedroom],
  ['kitchen', kitchen], ['room', room], ['phone', phone],
  ['bed', bed], ['fridge', fridge], ['home', home], ['garden', garden]
]) A.save(name, make());
