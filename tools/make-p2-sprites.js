'use strict';

/* =========================================================================
   P2 抽象词实物图：long / short / quiet / much / thin / near / where / here
   -------------------------------------------------------------------------
   这一组的两条特殊规矩：

   ① longarrow 与 shortarrow **必须同色**。反义对比词只留「长度」一个变量 ——
      如果一蓝一红，孩子可能记成「长的是蓝的」而不是「长 / 短」。

   ② quietface 只留「闭眼 + 食指贴嘴」，**不放 Z**。Z 是「睡着」的符号，
      而 quiet 的词义是「安静」；两者叠在一张图上会把词义讲混。

   构图坐标全部照 index.html 里的简笔画，save() 会自动压剪影描边 + 验收 + 报颜色数。
   ========================================================================= */
const A = require('./artkit.js');
const C = A.C;

function arrow(im, long, fill, shade) {
  const l = long ? 14 : 36;
  const r = long ? 86 : 64;
  // 多边形填充在顶点行会留一像素空隙；短条略放宽端点，保存后的实物框仍与简笔画居中。
  const tip = long ? 14 : 34;
  const rightTip = long ? 86 : 66;
  const wing = long ? 12 : 8;
  const inner = long ? 26 : 44;
  const y0 = long ? 38 : 40;
  const y1 = long ? 62 : 60;
  // 中间的条先画，箭头盖住条端，形成清晰的双向对比。
  A.oRoundRect(im, inner - 2, 46, r - wing + 2, 54, shade, 2);
  A.outlined(im, [[tip, 50], [inner, y0], [inner, 46], [inner + 8, 50],
    [inner, 54], [inner, y1]], fill);
  A.outlined(im, [[rightTip, 50], [r - wing, y0], [r - wing, 46], [r - wing - 8, 50],
    [r - wing, 54], [r - wing, y1]], fill);
  // 一条亮面让长短条在 64px 放大后仍然读得出来。
  A.rect(im, inner + 2, 47, r - wing - 1, 49, shade);
  return im;
}

/* long / short：同一个函数、同一组颜色，只有长度不同 */
function longarrow()  { return arrow(A.canvas(), true,  C.BLUE, C.BLUE_L); }
function shortarrow() { return arrow(A.canvas(), false, C.BLUE, C.BLUE_L); }

/* quiet 安静：闭眼 + 竖在嘴前的食指。不放 Z —— Z 属于「睡着」，会把词义讲混。 */
function quietface() {
  const im = A.canvas();
  // 脸的轮廓覆盖简笔画的 28..72 × 18..70 区域。
  A.oEllipse(im, 50, 44, 22, 26, C.SKIN, C.INK, 16);
  // 头发只压在额头上，避免遮住闭眼和嘘的手势。
  A.poly(im, [[29, 37], [34, 23], [46, 18], [60, 21], [71, 34],
    [62, 29], [53, 32], [43, 28], [35, 34]], C.HAIR);
  A.poly(im, [[58, 30], [71, 34], [70, 45], [62, 40]], C.SKIN_SH);
  // 闭眼：两条向下弯的小线。
  A.line(im, 37, 39, 42, 42, C.INK, 2);
  A.line(im, 42, 42, 47, 39, C.INK, 2);
  A.line(im, 53, 39, 58, 42, C.INK, 2);
  A.line(im, 58, 42, 63, 39, C.INK, 2);
  // 食指贴住嘴：肤色手指压在脸前，指尖和手掌都保持在简笔画框内。
  A.line(im, 50, 43, 50, 64, C.INK, 7);
  A.line(im, 50, 43, 50, 64, C.SKIN, 5);
  A.line(im, 50, 45, 50, 64, C.SKIN_HI, 1);
  A.oRoundRect(im, 45, 61, 55, 69, C.SKIN, 3);
  return im;
}

/* ---------------- much 许多 ----------------
   简笔画：七颗大大小小的圆点铺满整张图。
   用「一堆点」而不是一颗星星 —— 单颗星说不出「多」。 */
function muchdots() {
  const im = A.canvas();
  const dots = [[34, 30, 8], [57, 22, 7], [78, 34, 8], [42, 56, 8],
                [66, 60, 8], [29, 70, 7], [55, 78, 7]];
  // 每个点：深色底 → 亮色面 → 一点高光，三档就够了
  dots.forEach(([x, y, r]) => {
    A.oCircle(im, x, y, r, C.YELLOW, C.YELLOW_D);
    A.circle(im, x - r * 0.28, y - r * 0.3, r * 0.42, C.YELLOW_L);
  });
  return im;
}

/* ---------------- thin 瘦的 ----------------
   简笔画：一个肩窄腰细的小人，两条腿并得很近。
   和 shortarrow 的「短」区分开 —— 这个是「细」，所以画高、画窄。 */
function thinbar() {
  const im = A.canvas();
  // 腿先画，身体后画盖住根部
  A.line(im, 47, 68, 43, 88, C.SKIN_SH, 3);
  A.line(im, 53, 68, 57, 88, C.SKIN_SH, 3);
  A.line(im, 41, 89, 46, 89, C.INK, 2);
  A.line(im, 54, 89, 59, 89, C.INK, 2);
  // 胳膊：从肩往外伸出去一点点，强化「细」的对比
  A.line(im, 47, 46, 35, 58, C.SKIN, 3);
  A.line(im, 53, 46, 65, 58, C.SKIN, 3);
  // 身体：很窄的一条，宽 12 个单位
  A.outlined(im, [[44, 38], [56, 38], [56, 70], [44, 70]], C.GREEN);
  A.rect(im, 45, 39, 49, 69, C.GREEN_L);
  A.rect(im, 54, 39, 55, 69, C.GREEN_D);
  A.rect(im, 44, 52, 56, 55, C.GREEN_D);              // 腰带
  // 头最后画。★ 这个头只有 16×24 个单位（脸上只有 9 个像素宽），
  //    绝不能用 A.rect 画眼睛 —— SK.rect 会 floor/ceil 外扩，
  //    2×3 单位的矩形会变成 4×4 像素，两只眼睛直接把整张脸糊黑。
  //    改用 1px 高的 A.line：左右各 2px，中间留 3px 皮肤。
  A.outlined(im, [[50, 12], [58, 18], [58, 30], [50, 36], [42, 30], [42, 18]], C.SKIN);
  A.poly(im, [[42, 19], [46, 13], [50, 12], [56, 15], [58, 20], [52, 17], [46, 19], [43, 18]], C.HAIR);
  A.line(im, 45, 24, 47, 24, C.INK, 1);
  A.line(im, 53, 24, 55, 24, C.INK, 1);
  A.line(im, 47, 31, 53, 31, C.SKIN_SH, 1);
  return im;
}

/* ---------------- near 在附近 ----------------
   简笔画：一枚定位钉（水滴形）+ 中间一个洞 + 底下两条收拢的线。 */
function nearbin() {
  const im = A.canvas();
  A.outlined(im, [[50, 16], [64, 26], [66, 42], [50, 60], [34, 42], [36, 26]], C.RED);
  A.poly(im, [[50, 18], [60, 26], [61, 41], [50, 56]], C.RED_L);      // 左上受光
  A.poly(im, [[58, 36], [66, 42], [50, 60], [48, 40]], C.RED_D);      // 右下背光
  // 钉尖
  A.outlined(im, [[50, 58], [36, 44], [50, 86], [64, 44]], C.RED);
  A.poly(im, [[50, 62], [40, 48], [50, 80]], C.RED_L);
  // 中间的圆洞
  A.oCircle(im, 50, 35, 6, C.PAPER);
  A.circle(im, 49, 34, 3, C.RED);
  return im;
}

/* ---------------- where 哪里 ----------------
   简笔画：一条问号钩的折线 + 底下一个点 + 一条着重线。
   ★ 用「粗描这条折线」而不是「拼圆角矩形」—— 拼矩形出来的是个带洞的方块，
     像放大镜不像问号；沿着折线描才有那个钩的弯。 */
function whereq() {
  const im = A.canvas();
  /* ★ 折线的顶点不能顶在包围盒边界上：简笔画的最高点在 y=12，而笔画是以折线
     为中心向两侧各摊开半个笔宽的（7px ≈ 5.5 个单位）。顶点放在 12 上，
     实物就会从 6.5 起，高出简笔画画到的 10.45 一大截（实测超 1.7px）。
     把钩顶从 12 压到 15，笔画的最高点落到 9.5，才落在简笔画里。 */
  const hook = [[32, 31], [37, 20], [50, 15], [63, 20], [68, 31], [58, 42], [50, 52], [50, 60]];
  A.stroke(im, hook, C.PURPLE_D, 7);                    // 先描粗一圈当暗边
  A.stroke(im, hook, C.PURPLE, 5);                      // 主色压上去
  A.stroke(im, [[34, 29], [39, 21], [50, 16], [61, 21]], C.PURPLE_L, 2);   // 左上高光
  A.stroke(im, [[66, 31], [57, 42], [50, 51]], C.PURPLE_D, 2);             // 右下阴影
  // 下面的点
  A.oCircle(im, 50, 77, 6, C.PURPLE);
  A.circle(im, 48, 75, 2.5, C.PURPLE_L);
  // 底下的着重线
  A.rect(im, 24, 87, 76, 90, C.PURPLE_D);
  return im;
}

/* ---------------- here 这里 ----------------
   简笔画：一支向下的箭头 + 落点上一个方框 —— 「就这儿」。 */
function herearr() {
  const im = A.canvas();
  // 箭杆 + 箭头
  A.outlined(im, [[45, 12], [55, 12], [55, 40], [66, 40], [50, 60], [34, 40], [45, 40]], C.GREEN);
  A.rect(im, 46, 13, 49, 40, C.GREEN_L);
  A.rect(im, 53, 13, 54, 38, C.GREEN_D);
  A.poly(im, [[38, 40], [50, 38], [50, 56]], C.GREEN_L);
  A.poly(im, [[62, 40], [50, 38], [50, 56]], C.GREEN_D);
  // 落点的方框：中间是空的（「这里」）
  A.oRoundRect(im, 34, 74, 66, 86, C.GREEN, 3);
  A.rect(im, 37, 76, 63, 84, C.PAPER);
  A.rect(im, 34, 74, 66, 76, C.GREEN_L);
  A.rect(im, 34, 84, 66, 86, C.GREEN_D);
  return im;
}

/* ---------------- P2 其余 15 张：简笔画已有，直接补真图 ---------------- */
function openBook(kind) {
  const im = A.canvas();
  const page = kind === 'maths' ? C.BLUE_L : kind === 'english' ? C.PAPER : kind === 'chinese' ? C.YELLOW_L : C.PURPLE_L;
  const shade = kind === 'maths' ? C.BLUE : kind === 'english' ? C.PAPER_D : kind === 'chinese' ? C.YELLOW_D : C.PURPLE;
  A.outlined(im, [[50,28],[18,20],[18,78],[50,86]], page);
  A.outlined(im, [[50,28],[82,20],[82,78],[50,86]], page);
  A.line(im, 50, 28, 50, 86, C.INK, 3);
  A.line(im, 24, 72, 46, 78, shade, 2);
  A.line(im, 54, 78, 76, 72, shade, 2);
  if (kind === 'maths') {
    A.line(im, 59, 47, 69, 47, C.RED, 2); A.line(im, 64, 42, 64, 52, C.RED, 2);
    A.line(im, 68, 58, 76, 58, C.TEAL, 2);
  } else if (kind === 'english') {
    // A / B / C 用像素笔画写在右页，避免字体渲染差异。
    A.stroke(im, [[56,54],[59,42],[63,54]], C.RED, 2); A.line(im, 57,50,62,50,C.RED,2);
    A.line(im, 66,42,66,54,C.BLUE_D,2); A.line(im,66,42,72,44,C.BLUE_D,2); A.line(im,72,44,66,48,C.BLUE_D,2); A.line(im,66,48,73,51,C.BLUE_D,2); A.line(im,73,51,66,54,C.BLUE_D,2);
    A.stroke(im, [[78,43],[74,42],[72,48],[74,54],[78,53]], C.GREEN_D, 2);
  } else if (kind === 'chinese') {
    [44,50,56].forEach(y => A.line(im, 56, y, 72, y, C.RED_D, 2));
    A.line(im, 64, 40, 64, 60, C.BLUE_D, 2);
  } else {
    A.poly(im, [[66,34],[69,42],[78,42],[71,48],[74,57],[66,52],[58,57],[61,48],[54,42],[63,42]], C.YELLOW);
    A.poly(im, [[66,38],[68,44],[73,44],[69,47],[71,52],[66,49]], C.YELLOW_L);
  }
  return im;
}
function maths(){ return openBook('maths'); }
function english(){ return openBook('english'); }
function chinese(){ return openBook('chinese'); }
function storybook(){ return openBook('storybook'); }

function notebook() {
  const im = A.canvas();
  A.outlined(im, [[28,16],[82,16],[82,86],[28,86]], C.TEAL_L);
  A.poly(im, [[34,20],[78,20],[78,82],[34,82]], C.PAPER);
  A.line(im, 28, 20, 28, 82, C.TEAL_D, 3);
  [26,40,54,68].forEach(y => { A.oCircle(im, 21, y, 3, C.METAL_L); A.line(im, 21, y, 29, y, C.METAL_D, 1); });
  A.line(im, 40, 34, 72, 34, C.BLUE_D, 2);
  A.line(im, 40, 44, 68, 44, C.BLUE_L, 2);
  A.line(im, 40, 54, 72, 54, C.BLUE_L, 2);
  return im;
}

function palette() {
  const im = A.canvas();
  A.outlined(im, [[18,42],[24,26],[42,18],[64,20],[82,34],[84,52],[72,68],[52,78],[32,72],[20,58]], C.WOOD);
  A.poly(im, [[24,42],[28,29],[44,22],[63,24],[77,36],[78,51],[68,64],[51,72],[34,67],[25,56]], C.WOOD_L);
  // 调色盘拇指洞，压在右下角轮廓内。
  A.oCircle(im, 69, 54, 7, C.PAPER);
  A.oCircle(im, 69, 54, 3, C.WOOD_D);
  A.oCircle(im, 39, 37, 4, C.RED); A.oCircle(im, 55, 30, 4, C.BLUE);
  A.oCircle(im, 29, 55, 4, C.GREEN);
  return im;
}

function heart() {
  const im = A.canvas();
  A.outlined(im, [[50,86],[16,52],[12,34],[24,20],[40,20],[50,32],[60,20],[76,20],[88,34],[84,52]], C.PINK);
  A.poly(im, [[50,78],[22,50],[18,34],[27,25],[39,25],[50,38],[61,25],[73,25],[82,35],[78,50]], C.RED);
  A.poly(im, [[26,30],[34,25],[40,31],[30,40]], C.PINK_L);
  return im;
}

function fatcat() {
  const im = A.canvas();
  // 腿和尾巴先画，身体盖住根部。
  A.line(im, 36, 68, 30, 82, C.WOOD_D, 5); A.line(im, 64, 68, 70, 82, C.WOOD_D, 5);
  A.line(im, 28, 82, 38, 82, C.INK, 3); A.line(im, 64, 82, 74, 82, C.INK, 3);
  /* 尾巴：★ 尾梢要比简笔画的端点往回收一点。简笔画的尾巴是细线，
     实物是 5px 宽的实心笔画（约 7.8 个单位宽，以折线为中心向两侧各摊开 3.9）。
     尾梢照抄简笔画的 x=12 / x=90，笔画就会各溢出去 1.1 / 2.2 个单位（1.4px）。
     两边各收 2 个单位后，就落回简笔画画到的范围里。 */
  A.stroke(im, [[30,58],[24,58],[14,66],[16,76]], C.WOOD_D, 5);
  A.stroke(im, [[68,58],[80,64],[88,56]], C.WOOD_D, 5);
  A.outlined(im, [[30,44],[24,62],[30,80],[50,86],[70,80],[76,62],[70,44]], C.WOOD);
  A.poly(im, [[34,48],[28,62],[34,75],[50,81],[66,75],[72,62],[66,48]], C.WOOD_L);
  A.outlined(im, [[34,28],[28,18],[20,24],[22,38],[32,44],[50,44],[68,44],[78,38],[80,24],[72,18],[66,28]], C.WOOD);
  A.poly(im, [[21,25],[28,19],[35,29],[30,39],[23,37]], C.WOOD_D);
  A.poly(im, [[72,19],[79,25],[77,37],[68,39],[66,29]], C.WOOD_L);
  A.rect(im, 37, 31, 41, 35, C.INK); A.rect(im, 59, 31, 63, 35, C.INK);
  A.line(im, 45, 40, 55, 40, C.WOOD_D, 2); A.line(im, 50, 42, 50, 46, C.WOOD_D, 2);
  return im;
}

function muscle() {
  const im = A.canvas();
  // 弯臂轮廓：上臂、鼓起的二头肌、前臂和袖口各有一块平涂。
  A.outlined(im, [[18,72],[30,58],[42,42],[56,28],[68,30],[72,42],[62,50],[52,46],[42,58],[32,74]], C.SKIN);
  A.poly(im, [[42,42],[56,28],[68,30],[63,42],[52,46]], C.SKIN_HI);
  A.poly(im, [[52,46],[62,50],[42,58],[32,74],[24,72],[38,52]], C.SKIN_SH);
  A.outlined(im, [[40,42],[50,34],[62,38],[54,48],[44,50]], C.RED);
  A.outlined(im, [[18,72],[12,82],[22,88],[30,80]], C.BLUE);
  A.line(im, 21, 76, 28, 82, C.BLUE_L, 2);
  return im;
}

function scroll() {
  const im = A.canvas();
  A.outlined(im, [[26,10],[74,10],[74,88],[26,88]], C.CREAM);
  A.rect(im, 30, 14, 70, 84, C.PAPER);
  A.line(im, 26, 36, 74, 36, C.WOOD_L, 2);
  A.line(im, 26, 62, 74, 62, C.WOOD_L, 2);
  A.line(im, 34, 28, 66, 28, C.WOOD_D, 2);
  A.line(im, 34, 50, 66, 50, C.WOOD_D, 2);
  A.line(im, 34, 76, 60, 76, C.WOOD_D, 2);
  return im;
}

function note() {
  const im = A.canvas();
  A.stroke(im, [[39,70],[39,24],[76,16],[76,57]], C.PURPLE_D, 5);
  A.stroke(im, [[40,69],[40,25],[75,18],[75,56]], C.PURPLE, 3);
  A.oEllipse(im, 28, 70, 8, 5, C.PURPLE, C.INK, 12);
  A.oEllipse(im, 67, 56, 8, 5, C.PURPLE, C.INK, 12);
  A.stroke(im, [[18,77],[18,63]], C.PURPLE_D, 2);
  A.oEllipse(im, 27, 70, 6, 4, C.PURPLE, C.INK, 12);
  return im;
}

function flask() {
  const im = A.canvas();
  A.outlined(im, [[40,14],[60,14],[60,34],[78,70],[72,84],[28,84],[22,70],[40,34]], C.GLASS_L);
  A.rect(im, 40, 15, 60, 24, C.PAPER);
  A.line(im, 36, 24, 64, 24, C.METAL_D, 3);
  A.poly(im, [[30,68],[44,62],[58,68],[70,64],[72,76],[66,82],[34,82],[28,76]], C.TEAL);
  A.poly(im, [[34,68],[44,64],[56,69],[67,66],[68,73],[34,73]], C.TEAL_L);
  A.oCircle(im, 50, 76, 3, C.YELLOW);
  return im;
}

function check() {
  const im = A.canvas();
  A.stroke(im, [[20,53],[40,72],[82,28]], C.GREEN_D, 5);
  A.stroke(im, [[21,52],[40,70],[81,29]], C.GREEN, 3);
  A.stroke(im, [[28,57],[40,68],[55,51]], C.GREEN_L, 1);
  return im;
}

function hungry() {
  const im = A.canvas();
  // 空盘：没有食物只留一圈盘沿；右上是张开的嘴和饥饿感叹线。
  A.outlined(im, [[12,62],[28,62],[38,72],[62,72],[72,62],[88,62],[80,84],[20,84]], C.PAPER);
  A.poly(im, [[20,72],[80,72],[76,80],[24,80]], C.PAPER_D);
  A.line(im, 22, 68, 78, 68, C.METAL_D, 2);
  A.outlined(im, [[56,36],[66,28],[78,34],[66,42]], C.RED);
  A.poly(im, [[60,36],[66,31],[73,35],[66,39]], C.PINK_L);
  A.line(im, 72, 28, 76, 18, C.YELLOW_D, 3);
  A.line(im, 66, 28, 72, 22, C.YELLOW_D, 2);
  return im;
}

function briefcase() {
  const im = A.canvas();
  A.outlined(im, [[16,36],[84,36],[84,82],[16,82]], C.WOOD);
  A.poly(im, [[20,40],[80,40],[80,78],[20,78]], C.WOOD_L);
  A.outlined(im, [[36,36],[36,24],[64,24],[64,36]], C.WOOD_D);
  A.line(im, 16, 52, 84, 52, C.WOOD_D, 3);
  A.oRoundRect(im, 46, 52, 54, 62, C.YELLOW, 2);
  A.rect(im, 20, 56, 80, 59, C.WOOD);
  return im;
}

for (const [name, make] of [
  ['longarrow', longarrow],
  ['shortarrow', shortarrow],
  ['quietface', quietface],
  ['muchdots', muchdots],
  ['thinbar', thinbar],
  ['nearbin', nearbin],
  ['whereq', whereq],
  ['herearr', herearr],
  ['maths', maths], ['english', english], ['chinese', chinese], ['storybook', storybook],
  ['notebook', notebook], ['palette', palette], ['heart', heart], ['fatcat', fatcat],
  ['muscle', muscle], ['scroll', scroll], ['note', note], ['flask', flask],
  ['check', check], ['hungry', hungry], ['briefcase', briefcase]
]) A.save(name, make());
