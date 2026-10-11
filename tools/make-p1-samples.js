'use strict';

/*
 * P1 人物试样：doctor / family / baby
 *
 * 先锁定人物的少色平涂方向，再批量生成其余 P1。所有构图继续使用
 * SKETCH 的 0~100 坐标，SK.save() 负责保存和出生即验收。
 */
const SK = require('./spritekit.js');

const K = SK.rgba('#21182b');
const SKIN = SK.rgba('#f0c9a0');
const SKIN_SHADE = SK.rgba('#d9a87a');
const HAIR = SK.rgba('#6b422e');
const COAT = SK.rgba('#f7f1e6');
const COAT_SHADE = SK.rgba('#d6dfeb');
const TEAL = SK.rgba('#4b9fa5');
const BLUE = SK.rgba('#5a95cc');
const GREEN = SK.rgba('#7fb37f');
const YELLOW = SK.rgba('#e6bd62');
const ONESIE = SK.rgba('#9fd6e6');
const ONESIE_SHADE = SK.rgba('#4b9fa5');
const PACIFIER = SK.rgba('#e85b83');

const u = v => SK.u(v);
const P = points => points.map(([x, y]) => [u(x), u(y)]);
const poly = (im, points, color) => SK.poly(im, P(points), color);
const outlined = (im, points, fill, ink = K) => SK.outlinedPoly(im, P(points), fill, ink);
const line = (im, x0, y0, x1, y1, color, width = 1) =>
  SK.line(im, u(x0), u(y0), u(x1), u(y1), color, width);
const circle = (im, cx, cy, r, fill, ink = K) =>
  SK.outlinedCircle(im, u(cx), u(cy), u(r), fill, ink);

function faceDetails(im, eyesY, mouthY, mouthX = 50) {
  SK.px(im, u(45), u(eyesY), K);
  SK.px(im, u(55), u(eyesY), K);
  line(im, mouthX - 3, mouthY, mouthX + 3, mouthY, SKIN_SHADE, 1);
}

/** 两条腿。简笔画里每个小人只有「一根从脖子连到脚的身体线」，
 *  照抄就只有一个腿；这里从胯部补出第二条。
 *  补出来的那条落在简笔画整体范围之内，包围盒一个像素都不变。 */
function twoLegs(im, hx, hy, ax, ay, bx, by) {
  line(im, hx, hy, ax, ay, SKIN, 3);
  line(im, hx, hy, bx, by, SKIN, 3);
}

function doctor() {
  const im = SK.canvas();

  // Head: the outer silhouette follows doctor SKETCH exactly.
  outlined(im, [[50,14],[62,20],[62,34],[50,42],[38,34],[38,20]], SKIN);
  poly(im, [[38,20],[41,15],[50,14],[59,18],[62,23],[56,21],[50,23],[44,20]], HAIR);
  poly(im, [[55,22],[62,24],[62,34],[56,39],[54,31]], SKIN_SHADE);
  faceDetails(im, 27, 35);

  // White coat: broad torso, with one cool shadow plane.
  outlined(im, [[38,42],[32,66],[68,66],[62,42]], COAT);
  poly(im, [[55,43],[62,42],[68,66],[56,66]], COAT_SHADE);
  line(im, 50, 44, 50, 66, COAT_SHADE, 1);

  // Trousers and shoes stay inside the two leg strokes from the sketch.
  line(im, 40, 66, 34, 90, BLUE, 5);
  line(im, 60, 66, 66, 90, BLUE, 5);
  line(im, 33, 90, 39, 90, K, 2);
  line(im, 61, 90, 67, 90, K, 2);

  // Skin arms plus the teal stethoscope are the identity cue for “doctor”.
  line(im, 42, 48, 34, 58, SKIN, 4);
  line(im, 34, 58, 28, 50, SKIN_SHADE, 3);
  line(im, 58, 48, 66, 58, SKIN, 4);
  line(im, 66, 58, 72, 50, SKIN_SHADE, 3);
  line(im, 58, 48, 66, 58, TEAL, 2);
  line(im, 66, 58, 58, 68, TEAL, 2);
  circle(im, 50, 60, 3, TEAL);
  return im;
}

function family() {
  const im = SK.canvas();

  // Three heads at three heights: this is the main family recognition cue.
  outlined(im, [[22,18],[30,22],[30,32],[22,38],[14,32],[14,22]], SKIN);
  outlined(im, [[50,12],[58,18],[58,30],[50,36],[42,30],[42,18]], SKIN);
  outlined(im, [[76,26],[83,30],[83,40],[76,46],[69,40],[69,30]], SKIN);
  poly(im, [[14,23],[17,18],[24,18],[30,23],[27,26],[20,23]], HAIR);
  poly(im, [[42,18],[47,13],[54,13],[58,19],[55,21],[49,18]], HAIR);
  poly(im, [[69,31],[73,27],[79,27],[83,32],[80,34],[74,31]], HAIR);
  poly(im, [[25,29],[30,29],[30,32],[24,37],[22,34]], SKIN_SHADE);
  poly(im, [[53,27],[58,27],[58,30],[52,35],[50,32]], SKIN_SHADE);
  poly(im, [[79,38],[83,37],[83,40],[78,44],[76,41]], SKIN_SHADE);
  faceDetails(im, 27, 34, 22);
  faceDetails(im, 24, 31, 50);
  faceDetails(im, 35, 42, 76);

  // ★ 腿先画，衣服后画盖上去。
  //   简笔画的每根身体线是从脖子一路连到脚的，如果照「衣服画完再补腿」的顺序，
  //   一条肤色斜楔会从衣服中间穿出来，把衣服劈成两半（第一版就是这样）。
  //   先画腿再盖衣服，腿就变成「从衣服下摆伸出来」的了。
  twoLegs(im, 22, 58, 10, 86, 34, 86);
  twoLegs(im, 50, 60, 38, 88, 62, 88);
  twoLegs(im, 76, 62, 88, 88, 64, 88);

  // 三件衣服平涂：大人 1 蓝、大人 2 绿、小孩黄。
  // 之前拿 SKIN_SHADE 当衣服暗面用，结果肤色占了整张图 40%，比衣服还重，看着又暗又脏。
  outlined(im, [[16,38],[28,38],[29,62],[22,68],[15,62]], BLUE);
  outlined(im, [[44,36],[56,36],[58,64],[50,70],[42,64]], GREEN);
  outlined(im, [[71,46],[81,46],[82,66],[76,72],[70,66]], YELLOW);
  return im;
}

function baby() {
  const im = SK.canvas();

  // Large round head and compact body make the head-to-body ratio obvious.
  outlined(im, [[50,22],[64,30],[64,48],[50,62],[36,48],[36,30]], SKIN);
  poly(im, [[36,31],[40,24],[50,22],[60,28],[64,35],[57,32],[48,34],[40,31]], HAIR);
  // 脸侧暗面收到 x≥58 —— 原来从 x=51 起，正好压住嘴的右半边，
  // 嘴角糊进腮红里，看着像嘴长歪了。
  poly(im, [[58,44],[64,44],[64,48],[57,56],[53,53]], SKIN_SHADE);
  // ★ 五官要排在连体衣**上面**：连体衣顶边在 y=44，原来的嘴画在 y=47，
  //   结果被连体衣整个盖住 —— 一个没有嘴的宝宝。五官上移、连体衣下移各让一步。
  faceDetails(im, 36, 43);

  outlined(im, [[42,48],[58,48],[62,58],[50,62],[38,58]], ONESIE);
  poly(im, [[54,49],[58,49],[62,58],[53,61]], ONESIE_SHADE);
  line(im, 36, 40, 24, 52, SKIN, 4);
  line(im, 24, 52, 30, 60, SKIN_SHADE, 3);
  line(im, 64, 40, 76, 52, SKIN, 4);
  line(im, 76, 52, 70, 60, SKIN_SHADE, 3);
  circle(im, 64, 44, 3, PACIFIER);
  line(im, 64, 44, 56, 40, PACIFIER, 1);
  return im;
}

SK.save('doctor', doctor());
SK.save('family', family());
SK.save('baby', baby());
