# 单词画笔 · Words Make Worlds

英语学习 Web 游戏，当前默认入口为 v5「把教室修回来」演示版。

**在线体验：[打开游戏](https://yukisusanto.github.io/english-game/)**  
**原版入口：[打开原版游戏](https://yukisusanto.github.io/english-game/legacy.html)**

## 演示内容

- 五页教室修复冒险：词卡交互、目标选择、连携、门窗分支与三段 Boss。
- 109 个词的独立练习：认读、听辨、拼写和语境应用，与冒险共享学习组件。
- 手机与桌面适配、本地续玩、学习记录、存档导出和导入。

英语朗读使用浏览器提供的设备声音。游戏进度保存在当前浏览器，可通过学习手册中的存档导出／导入转移。

## GitHub Pages

发布来源：`main` 分支的根目录 `/`。根目录的 `.nojekyll` 用于直接发布静态文件。

游戏无需构建、服务器或 API 密钥。`index.html` 使用相对路径加载 `assets/`，适用于仓库子路径 `/english-game/`。以后更新并推送到 `main`，GitHub Pages 会自动发布。

## 本地体验与检查

直接用浏览器打开 `index.html`；或者安装 Node.js 后运行：

```sh
npm run dev
```

核心规则检查：`npm test`。原版检查：`npm run test:legacy`。浏览器验收：`npm run test:browser`，需要运行本地预览，并提供 Playwright 和 Edge；它们不是线上运行依赖。

手机和平板布局与触控检查：`npm run test:layout`。覆盖 8 种横竖屏尺寸，检查场景与操作同屏、认词选项、48px 字母键、44px 墨团点击区，以及拼写后返回战斗。

## 版本与设计文档

- [简短设计说明：玩法、主题、AI 与核心亮点](设计说明.md)
- `pre-v5-demo-20261011`：改版前的完整快照。
- `v5-demo-20261011`：完成验收的 v5 演示版。
- [交付、体验与回退](v5_Demo_交付与回退.md)
- [v5 优化设计文档](优化设计文档_v5.md)
- [v5 执行方案](优化执行方案_v5对接.md)
- [执行方案核验与答复](优化执行方案_v5_核验与答复.md)

`legacy.html` 保留完整原版。`remotion/` 是开场影片制作源文件，线上游戏无需安装其依赖。
