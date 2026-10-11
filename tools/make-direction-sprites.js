'use strict';

/*
 * Direction sprites for the first B-group art pass.
 *
 * All subject coordinates stay in the same 0–100 frame as SKETCH. spritekit
 * owns the 64px conversion, PNG encoding, and save-time alignment check.
 */
const SK = require('./spritekit.js');
const rgba = SK.rgba;

const K = SK.rgba('#21182b');
const DESK_DARK = SK.rgba('#5c3a34'), DESK = SK.rgba('#9a5b3e');
const DESK_MID = SK.rgba('#c97a4a'), DESK_LIGHT = SK.rgba('#efb66b');
const CANDY_DARK = SK.rgba('#21182b'), CANDY_PINK = SK.rgba('#e85b83');
const CANDY_LIGHT = SK.rgba('#ff9ab0'), WRAP_TEAL = SK.rgba('#44b7ad');
const WRAP_BLUE = SK.rgba('#25758e'), WRAP_HI = SK.rgba('#9be4d5');
const BALL_DARK = SK.rgba('#21182b'), BALL = SK.rgba('#b86338');
const BALL_MID = SK.rgba('#d98d4c'), BALL_SHADE = SK.rgba('#8d492f');
const CREAM = SK.rgba('#ffe7aa'), CREAM_HI = SK.rgba('#fff4cf');

/* 0–100 sketch coordinates → 64px sprite coordinates. */
const u = v => SK.u(v);
const P = points => points.map(([x, y]) => [u(x), u(y)]);
const C = (im, cx, cy, r, fill, ink) => SK.outlinedCircle(im, u(cx), u(cy), u(r), fill, ink);
const L = (im, x0, y0, x1, y1, color, width = 1) => SK.line(im, u(x0), u(y0), u(x1), u(y1), color, width);
const R = (im, x0, y0, x1, y1, color) => SK.rect(im, u(x0), u(y0), u(x1), u(y1), color);
const poly = (im, points, color) => SK.poly(im, P(points), color);
const outlined = (im, points, fill, ink = K) => SK.outlinedPoly(im, P(points), fill, ink);
const stroke = (im, points, color = K, width = 1) => {
  for (let i = 1; i < points.length; i++) L(im, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], color, width);
};

function desk() {
  const im = SK.canvas();
  /* 桌面轮廓必须收在简笔画里：简笔画只画了 (10,36)-(90,36) 这一条横线、
     桌腿 (18,40)-(18,92) 与 (82,40)-(82,92)。原来桌面挑到 x=94、顶面抬到 y=31、
     桌脚落到 y=94，结果实物在右/上/下三个方向都伸到墨线外面（最大 2.0px）。 */
  outlined(im, [[10, 36], [90, 36], [92, 41], [90, 45], [10, 45]], DESK, K);
  poly(im, [[14, 38], [86, 38], [88, 41], [86, 42], [14, 42]], DESK_LIGHT);
  R(im, 17, 44, 83, 53, DESK_DARK);
  R(im, 22, 45, 78, 50, DESK);
  R(im, 34, 45, 66, 53, DESK_MID);
  R(im, 38, 47, 62, 49, DESK_LIGHT);
  // Two legs and the low crossbar follow the existing 0–100 sketch.
  poly(im, [[16, 44], [25, 44], [23, 89], [17, 92]], DESK_DARK);
  poly(im, [[78, 44], [87, 44], [83, 92], [77, 89]], DESK_DARK);
  R(im, 19, 69, 81, 75, DESK_DARK);
  R(im, 23, 70, 77, 72, DESK_MID);
  R(im, 20, 88, 28, 92, K); R(im, 73, 88, 84, 92, K);
  L(im, 12, 34, 90, 34, DESK_LIGHT, 1);
  return im;
}

function candy() {
  const im = SK.canvas();
  // The whole candy is shifted exactly 2px up-left from the first sample.
  const shift = points => points.map(([x, y]) => [x - 2 * 100 / SK.W, y - 2 * 100 / SK.H]);
  const q = points => P(shift(points));
  const op = (points, fill, ink = K) => SK.outlinedPoly(im, q(points), fill, ink);
  const rl = (x0, y0, x1, y1, color) => SK.rect(im, u(x0 - 2 * 100 / SK.W), u(y0 - 2 * 100 / SK.H), u(x1 - 2 * 100 / SK.W), u(y1 - 2 * 100 / SK.H), color);
  const cl = (cx, cy, r, color) => SK.circle(im, u(cx - 2 * 100 / SK.W), u(cy - 2 * 100 / SK.H), u(r), color);
  op([[12, 34], [22, 26], [34, 32], [31, 40], [36, 48], [24, 56], [13, 50], [22, 43]], WRAP_TEAL);
  op([[66, 48], [72, 40], [68, 32], [58, 38], [71, 43], [68, 53], [96, 64], [80, 72], [58, 59]], WRAP_BLUE);
  SK.line(im, u(18 - 2 * 100 / SK.W), u(34 - 2 * 100 / SK.H), u(30 - 2 * 100 / SK.W), u(48 - 2 * 100 / SK.H), WRAP_HI, 1);
  SK.line(im, u(70 - 2 * 100 / SK.W), u(53 - 2 * 100 / SK.H), u(74 - 2 * 100 / SK.W), u(63 - 2 * 100 / SK.H), WRAP_HI, 1);
  C(im, 50 - 2 * 100 / SK.W, 47 - 2 * 100 / SK.H, 21, CANDY_PINK, CANDY_DARK);
  cl(42, 37, 5, CANDY_LIGHT);
  rl(47, 25, 53, 69, CANDY_DARK);
  rl(48, 26, 52, 68, CANDY_LIGHT);
  return im;
}

function football() {
  const im = SK.canvas();
  // Stepped, slightly oval ball aligned with the 12..88 sketch bounds.
  const outer = [[50, 11], [70, 14], [86, 25], [91, 39], [91, 61], [83, 77], [69, 88], [50, 91], [31, 86], [17, 74], [11, 59], [11, 39], [19, 25], [33, 14]];
  poly(im, outer, BALL_DARK);
  const inner = [[50, 16], [67, 19], [81, 28], [86, 40], [86, 59], [78, 73], [66, 83], [50, 86], [34, 81], [22, 70], [16, 57], [16, 41], [24, 29], [36, 19]];
  poly(im, inner, BALL);
  poly(im, [[24, 29], [36, 19], [48, 17], [42, 28], [27, 39], [16, 44], [16, 41]], BALL_MID);
  poly(im, [[66, 83], [78, 73], [86, 59], [86, 68], [78, 77], [69, 85]], BALL_SHADE);
  // Central pentagon and stitched panel lines match the sketch features.
  poly(im, [[45, 36], [59, 38], [66, 50], [58, 63], [44, 60], [40, 47]], BALL_DARK);
  poly(im, [[47, 40], [57, 41], [61, 50], [57, 57], [47, 56], [44, 48]], CREAM);
  L(im, 50, 16, 49, 36, K, 1);
  L(im, 67, 19, 59, 38, K, 1);
  L(im, 58, 63, 74, 82, K, 1);
  L(im, 40, 47, 16, 44, K, 1);
  R(im, 29, 31, 33, 34, CREAM_HI);
  return im;
}

function light() {
  const im = SK.canvas();
  L(im, 50, 10, 50, 28, K, 2);
  outlined(im, [[25, 28], [75, 28], [66, 52], [34, 52]], rgba('#f1b83a'));
  L(im, 44, 52, 44, 66, K, 2); L(im, 56, 52, 56, 66, K, 2);
  L(im, 40, 72, 50, 76, rgba('#fff0a1'), 2); L(im, 50, 76, 60, 72, rgba('#fff0a1'), 2);
  L(im, 30, 78, 34, 82, rgba('#ffe066'), 1);
  return im;
}

function crayon() {
  const im = SK.canvas();
  outlined(im, [[16, 38], [68, 38], [68, 62], [16, 62]], rgba('#e75c6f'));
  outlined(im, [[68, 38], [86, 50], [68, 62]], rgba('#f0c4a0'));
  R(im, 44, 39, 47, 61, rgba('#ff9baf'));
  R(im, 22, 39, 24, 61, rgba('#f7d4d2'));
  stroke(im, [[76, 44], [80, 50], [76, 56]], rgba('#21182b'), 1);
  return im;
}

function ruler() {
  const im = SK.canvas();
  outlined(im, [[10, 24], [90, 24], [90, 76], [10, 76]], rgba('#e6c77d'));
  R(im, 12, 28, 88, 33, rgba('#f8e7b1'));
  for (const x of [24, 40, 56, 72, 84]) L(im, x, 24, x, 39, K, 1);
  L(im, 14, 70, 86, 70, rgba('#b98d4f'), 1);
  return im;
}

function teddy() {
  const im = SK.canvas();
  outlined(im, [[34, 28], [25, 18], [18, 22], [20, 36], [30, 42], [70, 42], [80, 36], [82, 22], [75, 18], [66, 28]], rgba('#b97945'));
  poly(im, [[30, 42], [32, 62], [38, 78], [50, 82], [62, 78], [70, 62], [66, 42]], rgba('#c9874d'));
  stroke(im, [[30, 50], [16, 58], [20, 68]], K, 3);
  stroke(im, [[70, 50], [84, 58], [80, 68]], K, 3);
  stroke(im, [[40, 78], [34, 92]], K, 3); stroke(im, [[60, 78], [66, 92]], K, 3);
  C(im, 43, 31, 2, rgba('#fff1cf'), K); C(im, 57, 31, 2, rgba('#fff1cf'), K);
  C(im, 50, 38, 3, rgba('#e45f59'), K);
  return im;
}

function key() {
  const im = SK.canvas();
  const ring = [[28, 34], [22, 28], [22, 18], [30, 10], [42, 12], [48, 22], [44, 32], [36, 38], [28, 34]];
  stroke(im, ring, K, 4); stroke(im, ring, rgba('#e7c45f'), 2);
  outlined(im, [[42, 26], [78, 60], [88, 60], [84, 68], [90, 76], [76, 76], [44, 38]], rgba('#d9ad49'));
  L(im, 48, 38, 62, 52, rgba('#ffe7a2'), 1);
  return im;
}

function eraser() {
  const im = SK.canvas();
  outlined(im, [[18, 28], [74, 28], [86, 44], [70, 72], [18, 72]], rgba('#e9869a'));
  poly(im, [[18, 28], [34, 44], [86, 44], [74, 28]], rgba('#f5b1b9'));
  L(im, 18, 28, 34, 44, rgba('#fff0f0'), 1);
  L(im, 34, 44, 18, 72, rgba('#b9506b'), 2);
  L(im, 50, 60, 60, 60, rgba('#fff0f0'), 1);
  return im;
}

function hair() {
  const im = SK.canvas();
  poly(im, [[28, 30], [20, 20], [28, 12], [42, 16], [52, 10], [64, 18], [76, 14], [82, 26], [74, 34], [72, 54], [64, 64], [52, 68], [30, 62], [24, 48]], rgba('#6b422e'));
  outlined(im, [[30, 28], [24, 38], [26, 54], [36, 66], [50, 68], [58, 60], [52, 48], [40, 42]], rgba('#f1c49e'));
  stroke(im, [[52, 68], [64, 82]], rgba('#f1c49e'), 3);
  stroke(im, [[64, 20], [74, 34], [72, 54], [64, 64]], rgba('#3d251e'), 2);
  return im;
}

function glasses() {
  const im = SK.canvas();
  const left = [[14, 40], [18, 30], [30, 26], [42, 30], [46, 40], [42, 50], [30, 54], [18, 50], [14, 40]];
  const right = [[54, 40], [58, 30], [70, 26], [82, 30], [86, 40], [82, 50], [70, 54], [58, 50], [54, 40]];
  stroke(im, left, K, 4); stroke(im, right, K, 4); stroke(im, left, rgba('#8ccde2'), 2); stroke(im, right, rgba('#8ccde2'), 2);
  L(im, 46, 38, 54, 38, K, 3); L(im, 14, 38, 8, 34, K, 2); L(im, 86, 38, 92, 34, K, 2);
  return im;
}

function shoe() {
  const im = SK.canvas();
  outlined(im, [[12, 76], [28, 76], [44, 72], [58, 64], [74, 62], [88, 70], [88, 82], [16, 88]], rgba('#8a5a3a'));
  poly(im, [[28, 76], [34, 56], [50, 48], [66, 52], [74, 62], [58, 64], [44, 72]], rgba('#c88b59'));
  L(im, 40, 62, 52, 60, rgba('#f2d0a4'), 2); L(im, 46, 68, 58, 66, rgba('#f2d0a4'), 2);
  L(im, 18, 82, 84, 78, rgba('#e6c198'), 1);
  return im;
}

function hat() {
  const im = SK.canvas();
  outlined(im, [[12, 64], [88, 64], [82, 76], [18, 76]], rgba('#d44d4e'));
  outlined(im, [[24, 64], [28, 48], [38, 30], [50, 22], [62, 30], [72, 48], [76, 64]], rgba('#ef6a4e'));
  R(im, 26, 58, 74, 63, rgba('#f7b14e'));
  L(im, 30, 52, 70, 52, rgba('#a92f45'), 1);
  return im;
}

function table() {
  const im = SK.canvas();
  outlined(im, [[12, 30], [88, 30], [88, 44], [12, 44]], rgba('#9b5a3c'));
  poly(im, [[18, 44], [27, 44], [25, 88], [18, 88]], rgba('#73402f'));
  poly(im, [[38, 44], [47, 44], [45, 88], [38, 88]], rgba('#73402f'));
  poly(im, [[58, 44], [67, 44], [65, 88], [58, 88]], rgba('#73402f'));
  poly(im, [[78, 44], [87, 44], [84, 88], [77, 88]], rgba('#73402f'));
  L(im, 16, 33, 84, 33, rgba('#e1a05d'), 2);
  L(im, 18, 87, 26, 87, K, 2); L(im, 38, 87, 46, 87, K, 2); L(im, 58, 87, 66, 87, K, 2); L(im, 77, 87, 85, 87, K, 2);
  return im;
}

function sofa() {
  const im = SK.canvas();
  outlined(im, [[16, 42], [16, 30], [28, 22], [72, 22], [84, 30], [84, 42], [90, 46], [90, 76], [10, 76], [10, 46]], rgba('#619d7a'));
  poly(im, [[24, 48], [76, 48], [82, 56], [82, 68], [18, 68], [18, 56]], rgba('#83c08e'));
  outlined(im, [[10, 46], [22, 46], [22, 68], [10, 68]], rgba('#4f896e'));
  outlined(im, [[78, 46], [90, 46], [90, 68], [78, 68]], rgba('#4f896e'));
  L(im, 18, 72, 82, 72, rgba('#c0e2af'), 1);
  return im;
}

function knife() {
  const im = SK.canvas();
  outlined(im, [[18, 54], [32, 42], [76, 18], [86, 20], [72, 40], [34, 62]], rgba('#c5d0d5'));
  L(im, 32, 42, 72, 40, rgba('#f8ffff'), 1);
  outlined(im, [[18, 54], [10, 64], [30, 82], [42, 70]], rgba('#8b5a3c'));
  L(im, 13, 65, 30, 78, rgba('#dca46a'), 1);
  L(im, 10, 64, 30, 82, K, 1);
  return im;
}

function fork() {
  const im = SK.canvas();
  stroke(im, [[28, 16], [28, 38]], K, 4); stroke(im, [[42, 16], [42, 38]], K, 4);
  stroke(im, [[56, 16], [56, 38]], K, 4); stroke(im, [[70, 16], [70, 38]], K, 4);
  L(im, 28, 38, 70, 38, K, 5); L(im, 49, 38, 49, 82, K, 5);
  L(im, 49, 42, 49, 78, rgba('#d9e5e7'), 2);
  L(im, 30, 16, 30, 34, rgba('#e4f0ef'), 1); L(im, 44, 16, 44, 34, rgba('#e4f0ef'), 1);
  return im;
}

function chopsticks() {
  const im = SK.canvas();
  stroke(im, [[22, 18], [72, 82]], K, 5); stroke(im, [[34, 14], [84, 78]], K, 5);
  L(im, 22, 18, 72, 82, rgba('#c88043'), 2); L(im, 34, 14, 84, 78, rgba('#e5aa64'), 2);
  L(im, 34, 28, 38, 32, rgba('#fff0bd'), 1); L(im, 46, 24, 50, 28, rgba('#fff0bd'), 1);
  return im;
}

function spoon() {
  const im = SK.canvas();
  const bowl = [[50, 14], [62, 18], [70, 28], [70, 40], [62, 50], [50, 54], [38, 50], [30, 40], [30, 28], [38, 18], [50, 14]];
  outlined(im, bowl, rgba('#cbd6d9'));
  poly(im, [[38, 28], [62, 28], [66, 36], [60, 45], [50, 49], [40, 45], [34, 36]], rgba('#f1fbf7'));
  outlined(im, [[47, 50], [53, 50], [53, 88], [47, 88]], rgba('#b2c2c4'));
  L(im, 49, 54, 49, 82, rgba('#f6ffff'), 1);
  return im;
}

function egg() {
  const im = SK.canvas();
  outlined(im, [[50, 14], [64, 18], [76, 32], [80, 50], [74, 70], [60, 84], [44, 88], [28, 82], [20, 68], [24, 30]], rgba('#f7df9b'));
  poly(im, [[36, 20], [50, 15], [64, 20], [54, 27], [40, 26]], rgba('#fff4cf'));
  L(im, 38, 30, 44, 26, rgba('#fffbe8'), 1); L(im, 60, 34, 66, 44, rgba('#d7b76e'), 1);
  return im;
}

function basketball() {
  const im = SK.canvas();
  const outer = [[50, 12], [70, 18], [84, 34], [88, 50], [84, 66], [70, 82], [30, 82], [16, 66], [12, 50], [16, 34], [30, 18]];
  poly(im, outer, K);
  const inner = [[50, 16], [67, 22], [80, 36], [84, 50], [80, 64], [67, 78], [33, 78], [20, 64], [16, 50], [20, 36], [33, 22]];
  poly(im, inner, rgba('#df863b'));
  L(im, 50, 16, 50, 86, K, 2); stroke(im, [[18, 28], [34, 38], [50, 42], [66, 38], [82, 28]], K, 2);
  stroke(im, [[18, 72], [34, 62], [50, 58], [66, 62], [82, 72]], K, 2);
  poly(im, [[22, 27], [33, 22], [39, 25], [29, 34]], rgba('#f3ae55'));
  return im;
}

SK.save('desk', desk());
SK.save('candy', candy());
SK.save('football', football());
for (const [name, make] of [
  ['light', light], ['crayon', crayon], ['ruler', ruler], ['teddy', teddy], ['key', key],
  ['eraser', eraser], ['hair', hair], ['glasses', glasses], ['shoe', shoe], ['hat', hat],
  ['table', table], ['sofa', sofa], ['knife', knife], ['fork', fork], ['chopsticks', chopsticks],
  ['spoon', spoon], ['egg', egg], ['basketball', basketball]
]) SK.save(name, make());
