'use strict';

/* U6 人物组：parents / mother / father / uncle / aunt / boybig / girlbig
 * cook / driver / farmer / nurse / crowd / dog
 *
 * 这些图沿用 make-u23-sprites.js 的人物顺序：腿和鞋 → 胳膊 → 衣服 → 头，
 * 再在头部上压发型、帽子或职业配件。坐标直接使用 SKETCH 的 0~100 框。
 */
const A = require('./artkit.js');
const C = A.C;

function face(im, cx, top, opt = {}) {
  const hair = opt.hair || C.HAIR;
  const side = opt.side == null ? true : opt.side;
  const bottom = top + 28;
  A.outlined(im, [[cx, top], [cx + 12, top + 6], [cx + 12, top + 20],
    [cx, bottom], [cx - 12, top + 20], [cx - 12, top + 6]], C.SKIN);
  A.poly(im, [[cx - 12, top + 7], [cx - 7, top + 1], [cx, top],
    [cx + 9, top + 3], [cx + 12, top + 10], [cx + 5, top + 6],
    [cx - 3, top + 9], [cx - 10, top + 6]], hair);
  if (side) A.poly(im, [[cx + 5, top + 8], [cx + 12, top + 10],
    [cx + 12, top + 20], [cx + 5, bottom - 3], [cx + 3, top + 13]], C.SKIN_SH);
  A.rect(im, cx - 6, top + 13, cx - 4, top + 16, C.INK);
  A.rect(im, cx + 4, top + 13, cx + 6, top + 16, C.INK);
  A.line(im, cx - 3, top + 21, cx + 3, top + 21, C.SKIN_SH, 1);
}

/* ★ 手脚要「收在简笔画端点之内」。
   简笔画是一根 3.1 个单位宽的线，端点是折线的终点，实际画到的是端点 ±1.55。
   实物的鞋和手掌是实心块，比线粗得多，如果还照端点往外顶，就会伸到墨线外面 ——
   淡入时那块「凭空多出来」，看得见（实测 2.6~4.0 像素，显示时约 10~15px）。
   所以：鞋底比脚点少伸 2 个单位，小臂比手点少伸 3 个单位。 */
function legs(im, x, y, left, right, shoe = C.INK, width = 4) {
  A.line(im, x - 6, y, left[0], left[1], C.SKIN, width);
  A.line(im, x + 6, y, right[0], right[1], C.SKIN, width);
  A.line(im, left[0] - 2, left[1], left[0] + 2, left[1], shoe, 3);
  A.line(im, right[0] - 2, right[1], right[0] + 2, right[1], shoe, 3);
}

function arms(im, x, y, left, right, width = 4) {
  A.line(im, x - 8, y, left[0], left[1], C.SKIN, width);
  A.line(im, left[0], left[1], left[0] + 1, left[1] + 10, C.SKIN_SH, 3);
  A.line(im, x + 8, y, right[0], right[1], C.SKIN, width);
  A.line(im, right[0], right[1], right[0] - 1, right[1] + 10, C.SKIN_SH, 3);
}

function torso(im, points, fill, shade = fill) {
  A.outlined(im, points, fill);
  if (shade !== fill) A.poly(im, [[points[0][0] + (points[1][0] - points[0][0]) * .55, points[0][1]],
    points[1], points[2], [points[2][0] - 5, points[2][1]],
    [points[0][0] + (points[1][0] - points[0][0]) * .55, points[0][1] + 1]], shade);
}

function adult(im, opt) {
  const { x, top, shirt, shirtL = shirt, leftArm, rightArm,
    leftFoot, rightFoot, female = false, hair = C.HAIR } = opt;
  legs(im, x, opt.legY || 66, leftFoot, rightFoot, opt.shoe || C.INK);
  arms(im, x, opt.armY || 48, leftArm, rightArm);
  if (female) {
    // 长发先铺在衣服后面，脸最后压住发帘。
    A.outlined(im, [[x - 16, top + 8], [x - 22, top + 28], [x - 16, top + 44],
      [x, top + 54], [x + 16, top + 44], [x + 22, top + 28], [x + 16, top + 8]], hair);
    torso(im, [[x - 16, top + 42], [x + 16, top + 42], [x + 24, top + 72],
      [x, top + 76], [x - 24, top + 72]], shirt, shirtL);
    face(im, x, top, { hair });
  } else {
    // 男式躯干原来下摆到 x±20，比头还宽一倍，实心块会顶到简笔画的细身体线外面。
    // 收成 x±15，肩宽仍明显，但落在简笔画范围内。
    torso(im, [[x - 12, top + 28], [x + 12, top + 28], [x + 15, top + 52],
      [x, top + 56], [x - 15, top + 52]], shirt, shirtL);
    face(im, x, top, { hair });
  }
}

function parents() {
  const im = A.canvas();
  adult(im, { x: 30, top: 16, shirt: C.BLUE, shirtL: C.BLUE_L,
    armY: 49, legY: 66, leftArm: [16, 58], rightArm: [40, 58],
    leftFoot: [16, 90], rightFoot: [34, 90] });
  adult(im, { x: 70, top: 18, shirt: C.GREEN, shirtL: C.GREEN_L,
    armY: 51, legY: 68, leftArm: [60, 60], rightArm: [86, 60],
    leftFoot: [66, 90], rightFoot: [86, 90], hair: C.HAIR });
  return im;
}

function mother() {
  const im = A.canvas();
  adult(im, { x: 50, top: 14, female: true, shirt: C.PINK, shirtL: C.PINK_D,
    armY: 52, legY: 68, leftArm: [34, 62], rightArm: [76, 60],
    leftFoot: [28, 86], rightFoot: [72, 86] });
  // 简笔画右侧花朵配件，保持最右包围点到 x=88。
  A.oCircle(im, 82, 60, 6, C.YELLOW);
  A.oCircle(im, 82, 60, 2, C.PINK);
  return im;
}

function father() {
  const im = A.canvas();
  adult(im, { x: 50, top: 14, shirt: C.BLUE, shirtL: C.BLUE_L,
    armY: 48, legY: 66, leftArm: [22, 60], rightArm: [78, 60],
    leftFoot: [34, 90], rightFoot: [66, 90] });
  // 领带：压在衣服上，给 father 一个稳定识别点。
  A.poly(im, [[48, 43], [52, 43], [55, 58], [50, 62], [45, 58]], C.RED);
  A.poly(im, [[50, 45], [52, 44], [55, 58], [51, 59]], C.RED_D);
  return im;
}

function uncle() {
  const im = A.canvas();
  adult(im, { x: 50, top: 14, shirt: C.TEAL, shirtL: C.TEAL_L,
    armY: 48, legY: 66, leftArm: [22, 60], rightArm: [78, 60],
    leftFoot: [34, 90], rightFoot: [58, 90], hair: C.HAIR_D });
  // 胡子只占头部下沿，不改变简笔画的整体框。
  A.poly(im, [[44, 33], [50, 36], [56, 33], [54, 40], [50, 42], [46, 40]], C.HAIR_D);
  return im;
}

function aunt() {
  const im = A.canvas();
  adult(im, { x: 50, top: 14, female: true, shirt: C.PURPLE, shirtL: C.PURPLE_L,
    armY: 48, legY: 68, leftArm: [34, 58], rightArm: [80, 68],
    leftFoot: [28, 86], rightFoot: [72, 86], hair: C.HAIR_D });
  // 发箍与右手的小包对应 aunt 简笔画的两笔配件。
  A.line(im, 40, 20, 60, 20, C.YELLOW_D, 2);
  A.outlined(im, [[76, 64], [82, 68], [78, 82], [68, 74]], C.YELLOW);
  return im;
}

function boybig() {
  const im = A.canvas();
  // 鞋底收在简笔画的两条腿端点之内，避免把 30..70 的窄框撑宽。
  A.line(im, 44, 68, 30, 92, C.SKIN, 4);
  A.line(im, 56, 68, 70, 92, C.SKIN, 4);
  A.line(im, 30, 92, 38, 92, C.INK, 3);
  A.line(im, 62, 92, 70, 92, C.INK, 3);
  arms(im, 50, 48, [31, 58], [69, 58]);
  torso(im, [[38, 40], [62, 40], [62, 68], [38, 68]], C.BLUE, C.BLUE_L);
  // 体型较高、仍保留 boy 的短裤结构。
  A.outlined(im, [[38, 66], [62, 66], [62, 74], [38, 74]], C.GREEN_D);
  A.rect(im, 40, 66, 60, 69, C.GREEN);
  face(im, 50, 12);
  // 顶部短发拉到 y=10，正好贴合 boybig 简笔画。
  A.poly(im, [[36, 20], [42, 10], [58, 10], [66, 22], [58, 18], [48, 20], [40, 18]], C.HAIR);
  return im;
}

function girlbig() {
  const im = A.canvas();
  A.line(im, 44, 74, 36, 92, C.SKIN, 3);
  A.line(im, 56, 74, 64, 92, C.SKIN, 3);
  A.line(im, 32, 92, 42, 92, C.RED, 3);
  A.line(im, 60, 92, 70, 92, C.RED, 3);
  arms(im, 50, 48, [32, 60], [68, 60]);
  A.outlined(im, [[38, 40], [62, 40], [68, 68], [50, 78], [32, 68]], C.PINK);
  A.poly(im, [[50, 41], [62, 40], [68, 68], [50, 78]], C.PINK_D);
  A.rect(im, 40, 42, 60, 46, C.PINK_L);
  face(im, 50, 12);
  // 两条马尾必须保留到 x=24/76、y=10/34 的简笔画范围。
  A.poly(im, [[38, 20], [28, 10], [24, 26], [34, 34]], C.HAIR);
  A.poly(im, [[62, 20], [72, 10], [76, 26], [66, 34]], C.HAIR);
  A.oCircle(im, 29, 20, 3, C.YELLOW);
  A.oCircle(im, 71, 20, 3, C.YELLOW);
  return im;
}

function cook() {
  const im = A.canvas();
  legs(im, 50, 68, [34, 90], [66, 90], C.INK, 4);
  arms(im, 50, 50, [32, 62], [68, 62]);
  torso(im, [[38, 44], [62, 44], [68, 68], [32, 68]], C.PAPER, C.PAPER_D);
  A.line(im, 50, 46, 50, 66, C.PAPER_D, 1);
  face(im, 50, 20);
  // 厨师帽沿用简笔画的五个波峰，顶部到 y=6。
  A.outlined(im, [[30, 20], [36, 10], [44, 14], [50, 6], [56, 14],
    [64, 10], [70, 20]], C.PAPER);
  A.poly(im, [[32, 18], [68, 18], [68, 22], [32, 22]], C.PAPER_D);
  A.line(im, 40, 54, 60, 54, C.RED, 2);
  return im;
}

function driver() {
  const im = A.canvas();
  legs(im, 50, 66, [30, 90], [70, 90], C.INK, 4);
  // 手臂先画，方向指向方向盘两侧。
  A.line(im, 42, 48, 34, 56, C.SKIN, 4);
  A.line(im, 34, 56, 28, 48, C.SKIN_SH, 3);
  A.line(im, 58, 48, 66, 56, C.SKIN, 4);
  A.line(im, 66, 56, 72, 48, C.SKIN_SH, 3);
  torso(im, [[38, 42], [62, 42], [68, 64], [32, 64]], C.BLUE, C.BLUE_L);
  A.oCircle(im, 50, 58, 8, C.METAL, C.INK);
  A.oCircle(im, 50, 58, 3, C.METAL_D, C.INK);
  A.line(im, 50, 58, 50, 50, C.METAL_D, 2);
  A.line(im, 50, 58, 56, 63, C.METAL_D, 2);
  face(im, 50, 14);
  return im;
}

function farmer() {
  const im = A.canvas();
  legs(im, 50, 70, [34, 90], [66, 90], C.INK, 4);
  arms(im, 50, 52, [34, 62], [66, 62]);
  torso(im, [[38, 46], [62, 46], [68, 70], [32, 70]], C.GREEN);
  face(im, 50, 18);
  // 草帽与右侧锄头沿简笔画扩展到 x=26..90。
  A.outlined(im, [[26, 22], [34, 14], [66, 14], [74, 22], [66, 28], [34, 28]], C.YELLOW);
  A.rect(im, 34, 22, 66, 26, C.YELLOW_D);
  A.line(im, 78, 36, 84, 24, C.WOOD_D, 3);
  A.line(im, 84, 24, 90, 36, C.WOOD_D, 3);
  return im;
}

function nurse() {
  const im = A.canvas();
  // 窄身护士的鞋底也收进 x=32..68 的简笔画框。
  A.line(im, 44, 68, 36, 90, C.SKIN, 4);
  A.line(im, 56, 68, 64, 90, C.SKIN, 4);
  A.line(im, 36, 90, 42, 90, C.INK, 3);
  A.line(im, 60, 90, 66, 90, C.INK, 3);
  // 护士简笔画较窄，手臂回收 2 个单位后仍能看出伸手姿势。
  A.line(im, 42, 50, 34, 58, C.SKIN, 4);
  A.line(im, 34, 58, 32, 68, C.SKIN_SH, 3);
  A.line(im, 58, 50, 66, 58, C.SKIN, 4);
  A.line(im, 66, 58, 68, 68, C.SKIN_SH, 3);
  torso(im, [[39, 44], [61, 44], [66, 68], [34, 68]], C.PAPER, C.PAPER_D);
  A.line(im, 50, 46, 50, 66, C.PAPER_D, 1);
  face(im, 50, 16);
  // 护士帽及十字，顶部从 y=10 开始。
  A.outlined(im, [[36, 22], [36, 10], [64, 10], [64, 22]], C.PAPER);
  A.rect(im, 48, 12, 52, 20, C.RED);
  A.rect(im, 40, 18, 60, 22, C.RED);
  return im;
}

function crowd() {
  const im = A.canvas();
  // 三个人同高，先画各自的腿和手臂，再画窄躯干和头。
  legs(im, 24, 64, [16, 86], [38, 86], C.INK, 4);
  legs(im, 50, 64, [38, 86], [62, 86], C.INK, 4);
  legs(im, 76, 64, [64, 86], [84, 86], C.INK, 4);
  A.line(im, 24, 48, 12, 58, C.SKIN, 4);
  A.line(im, 76, 48, 88, 58, C.SKIN, 4);
  A.outlined(im, [[18, 36], [30, 36], [31, 64], [17, 64]], C.BLUE);
  A.outlined(im, [[44, 36], [56, 36], [57, 64], [43, 64]], C.GREEN);
  A.outlined(im, [[70, 36], [82, 36], [83, 64], [69, 64]], C.YELLOW);
  face(im, 24, 18, { hair: C.HAIR });
  face(im, 50, 18, { hair: C.HAIR_D });
  face(im, 76, 18, { hair: C.HAIR });
  return im;
}

function dog() {
  const im = A.canvas();
  // 四条腿先画：两条前后腿和两条被身体遮住的内侧腿。
  // 腿端点到 y=88 而不是 90 —— 5px 宽的腿在 90 处会画到 93.75，超过简笔画的 90。
  A.line(im, 30, 64, 20, 88, C.WOOD, 5);
  A.line(im, 42, 72, 40, 88, C.WOOD_D, 5);
  A.line(im, 56, 72, 62, 88, C.WOOD_D, 5);
  A.line(im, 66, 62, 70, 84, C.WOOD, 5);
  A.line(im, 18, 86, 26, 86, C.INK, 3);
  A.line(im, 36, 88, 45, 88, C.INK, 3);
  A.line(im, 58, 88, 67, 88, C.INK, 3);
  A.line(im, 66, 84, 74, 84, C.INK, 3);
  // 身体和头，耳朵保留简笔画的左高右低轮廓。
  A.outlined(im, [[30, 42], [56, 42], [68, 50], [68, 68], [60, 78],
    [30, 78], [26, 68]], C.WOOD);
  A.poly(im, [[30, 48], [56, 48], [64, 54], [64, 70], [56, 74], [34, 74]], C.WOOD_L);
  A.outlined(im, [[34, 26], [26, 16], [18, 22], [22, 40], [32, 46],
    [54, 46], [66, 38], [68, 24], [58, 18], [50, 28]], C.WOOD);
  A.poly(im, [[18, 22], [26, 16], [34, 26], [28, 38], [22, 40]], C.WOOD_D);
  A.poly(im, [[58, 18], [68, 24], [66, 38], [56, 34]], C.WOOD_L);
  A.rect(im, 34, 31, 38, 35, C.INK);
  A.rect(im, 56, 29, 60, 33, C.INK);
  A.line(im, 42, 40, 50, 40, C.WOOD_D, 2);
  A.line(im, 30, 45, 58, 45, C.RED, 3);
  // 尾巴：右侧三段折线到 x=88、y=34。
  A.line(im, 66, 54, 82, 46, C.WOOD, 4);
  A.line(im, 82, 46, 88, 34, C.WOOD_D, 4);
  return im;
}

for (const [name, make] of [
  ['parents', parents], ['mother', mother], ['father', father], ['uncle', uncle],
  ['aunt', aunt], ['boybig', boybig], ['girlbig', girlbig], ['cook', cook],
  ['driver', driver], ['farmer', farmer], ['nurse', nurse], ['crowd', crowd],
  ['dog', dog]
]) A.save(name, make());
