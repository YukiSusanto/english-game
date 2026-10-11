#!/usr/bin/env node
/*
 * 剧情 A 组 NPC 立绘：chalk / dragon / mirror / tree / pot
 *
 * 这些图不是教学词条的「对齐实物图」，所以不套简笔画包围盒；
 * 它们只遵守剧情立绘规格：64×64 RGBA、透明背景、少色平涂、深色轮廓。
 * dog.png 已经存在，本脚本不会覆盖它。
 */
'use strict';

const A = require('./artkit.js');
const C = A.C;

function chalk() {
  const im = A.canvas();
  // 一小截竖着的粉笔，斜切的顶端让它不像普通方块。
  A.oRoundRect(im, 27, 18, 73, 82, C.YELLOW, 6);
  A.poly(im, [[33, 18], [67, 18], [73, 24], [27, 24], [27, 23]], C.YELLOW_L);
  A.poly(im, [[27, 68], [73, 68], [73, 82], [27, 82]], C.YELLOW_D);
  // 粉笔精灵的简单笑脸：两点眼睛和一条短弧线。
  A.px(im, 42, 43, C.INK);
  A.px(im, 58, 43, C.INK);
  A.line(im, 43, 54, 50, 58, C.INK, 1);
  A.line(im, 50, 58, 57, 54, C.INK, 1);
  return im;
}

function dragon() {
  const im = A.canvas();
  // 翼和尾巴先画，书包主体随后盖住连接处。
  A.outlined(im, [[25, 39], [12, 28], [14, 52], [26, 58]], C.GREEN_L);
  A.outlined(im, [[73, 39], [87, 28], [85, 52], [73, 58]], C.GREEN_L);
  A.line(im, 70, 70, 84, 80, C.GREEN_D, 5);
  A.line(im, 84, 80, 89, 72, C.GREEN_D, 4);
  // 书包主体和前袋。
  A.oRoundRect(im, 24, 31, 76, 82, C.GREEN, 6);
  A.oRoundRect(im, 31, 56, 69, 76, C.GREEN_D, 3);
  A.line(im, 35, 34, 35, 78, C.GREEN_L, 2);
  // 龙头、角和鼻孔是识别点。
  A.outlined(im, [[31, 31], [30, 19], [38, 12], [50, 17], [62, 12], [70, 20],
    [69, 34], [58, 42], [42, 42]], C.GREEN);
  A.poly(im, [[34, 19], [38, 10], [44, 18]], C.YELLOW);
  A.poly(im, [[56, 18], [63, 10], [66, 22]], C.YELLOW);
  A.oCircle(im, 42, 27, 4, C.YELLOW);
  A.oCircle(im, 59, 27, 4, C.YELLOW);
  A.px(im, 42, 27, C.INK);
  A.px(im, 59, 27, C.INK);
  A.line(im, 48, 35, 54, 35, C.RED, 2);
  return im;
}

function mirror() {
  const im = A.canvas();
  // 镜框、镜面和底座。
  A.oRoundRect(im, 14, 9, 86, 75, C.METAL_D, 5);
  A.oRoundRect(im, 20, 15, 80, 69, C.GLASS_L, 3);
  A.outlined(im, [[47, 74], [59, 74], [64, 89], [42, 89]], C.METAL);
  A.oRoundRect(im, 35, 86, 71, 90, C.METAL_D, 2);
  // 镜里的人形：头部轮廓保留，但脸部故意留成镜面色，没有眼睛和嘴。
  A.outlined(im, [[50, 25], [61, 31], [61, 43], [50, 51], [39, 43], [39, 31]], C.GLASS_D);
  A.outlined(im, [[40, 50], [60, 50], [68, 68], [50, 76], [32, 68]], C.METAL);
  A.poly(im, [[43, 34], [50, 29], [57, 34], [57, 43], [50, 48], [43, 43]], C.GLASS_L);
  // 镜面高光，不画五官，保留“忘了自己长什么样”的空脸。
  A.line(im, 25, 24, 25, 46, C.PAPER_HI, 2);
  A.line(im, 29, 20, 35, 20, C.PAPER_HI, 1);
  return im;
}

function tree() {
  const im = A.canvas();
  // 家庭树冠做成屋顶式的三层轮廓，既像树也能读出“家”。
  A.outlined(im, [[14, 53], [18, 37], [28, 34], [28, 25], [38, 27], [50, 12],
    [62, 27], [72, 25], [72, 34], [82, 37], [86, 53], [78, 63], [22, 63]], C.GREEN);
  A.poly(im, [[19, 48], [28, 36], [39, 38], [50, 22], [61, 38], [73, 36],
    [82, 49], [76, 58], [25, 58]], C.GREEN_L);
  A.poly(im, [[45, 59], [50, 44], [55, 59]], C.GREEN);
  // 三个小果实象征家庭成员，保持平涂和少色。
  A.oCircle(im, 34, 45, 4, C.RED);
  A.oCircle(im, 50, 34, 4, C.YELLOW);
  A.oCircle(im, 66, 45, 4, C.RED);
  // 树干、根和花盆。
  A.outlined(im, [[44, 56], [56, 56], [58, 77], [42, 77]], C.WOOD);
  A.poly(im, [[48, 57], [56, 57], [58, 77], [51, 77]], C.WOOD_D);
  A.oRoundRect(im, 31, 73, 69, 91, C.RED, 4);
  A.poly(im, [[35, 76], [65, 76], [62, 88], [38, 88]], C.RED_D);
  A.line(im, 36, 78, 64, 78, C.RED, 2);
  return im;
}

function pot() {
  const im = A.canvas();
  // 蒸汽在后面，锅盖和锅体在前面。
  A.line(im, 36, 29, 32, 20, C.PAPER_HI, 2);
  A.line(im, 50, 27, 50, 16, C.PAPER_HI, 2);
  A.line(im, 64, 29, 68, 20, C.PAPER_HI, 2);
  // 把手和锅盖。
  A.outlined(im, [[19, 45], [10, 45], [10, 55], [22, 55]], C.METAL_D);
  A.outlined(im, [[81, 45], [90, 45], [90, 55], [78, 55]], C.METAL_D);
  A.oRoundRect(im, 22, 31, 78, 51, C.RED_L, 5);
  A.oRoundRect(im, 42, 25, 58, 34, C.METAL_D, 3);
  A.rect(im, 47, 26, 53, 30, C.METAL);
  // 锅体以暖红色表现“正在烧”，右下压暗形成一块平涂阴影。
  A.oRoundRect(im, 20, 45, 80, 84, C.RED, 7);
  A.poly(im, [[56, 48], [77, 48], [80, 77], [68, 82], [57, 82]], C.RED_D);
  A.line(im, 29, 54, 71, 54, C.RED_L, 2);
  A.line(im, 35, 84, 65, 84, C.INK, 3);
  return im;
}

function saveNpc(name, im) {
  // NPC 没有同名 SKETCH，不能把“找不到对齐底稿”当成失败；
  // 这里仍然用 SK.save 的自动剪影描边，再输出专用的规格摘要。
  A.save(name, im, { quiet: true });
  let minX = 64, minY = 64, maxX = -1, maxY = -1, opaque = 0, semi = 0;
  const colors = new Set();
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4, a = im[i + 3];
    if (!a) continue;
    opaque++;
    if (a < 255) semi++;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    colors.add(im.slice(i, i + 3).join(','));
  }
  console.log(`✅ ${name.padEnd(7)} 64×64 RGBA　${colors.size} 色　` +
    `内容框 ${minX},${minY}–${maxX},${maxY}　` + (semi ? `⚠ ${semi} 个半透明像素` : '透明边缘干净'));
}

saveNpc('chalk', chalk());
saveNpc('dragon', dragon());
saveNpc('mirror', mirror());
saveNpc('tree', tree());
saveNpc('pot', pot());
