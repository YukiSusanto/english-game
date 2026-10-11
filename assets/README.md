# assets/ — 可选素材目录

**这个目录可以为空，删掉它游戏也照常运行。**
游戏所有像素图形都由 `index.html` 里的 `Art` 模块用字符网格实时生成，音效由 `SFX` 模块用 Web Audio 振荡器实时合成。

想替换成自己的美术 / 配音时：

```
assets/
├── sprites/     角色 32×32、地图节点图标 16×16（PNG，不要预放大）
└── sfx/         音效文件（可选）
```

当前已落地 3 张 B 组真图方向样稿，统一为 64×64 RGBA、透明背景、像素边缘：

```
sprites/desk.png       课桌：木质色块 + 深色描边
sprites/candy.png      糖果：彩色糖纸 + 圆糖主体
sprites/football.png   足球：棕色皮面 + 中心拼块
```

三张图分别验证家具、食物和球类的画法，均已在 `index.html` 的 `SPRITE` 表登记。需要重生成这批方向样稿时运行：

```
node tools/make-direction-sprites.js
```

接入步骤见上一级目录的 **《素材替换说明.md》**。实物图在 `index.html` 的 `SPRITE` 表登记，例如 `desk: 'assets/sprites/desk.png'`；未登记的 key 会自动回退到程序化占位图。
