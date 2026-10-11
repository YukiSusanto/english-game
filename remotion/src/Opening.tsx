/* ============================================================================
 * 开场影片 · 关键帧合成器
 * ----------------------------------------------------------------------------
 * 【原则】画面是"画好的静帧"，动的是镜头。
 *   - 每一镜 = 一张 AI 生成的插图 + 一段缓慢的推 / 拉 / 平移
 *   - 光效（浮尘、呼吸光、扫光、光点）**全部用代码画**，不用 AI 生成
 *   - 缺图时**不崩、不黑屏**，直接渲染一块写着"缺哪张图"的说明面板
 *
 * 【素材放哪】
 *   remotion/public/keyframes/k01.svg … k10.svg（正式 PNG 到位后把 Keyframe 默认扩展名切到 png）
 *   完整清单和每张图该画什么 → 《开场影片_写实设定与生成说明.md》
 *
 * 【风格】精细二维手绘写实（日式动画电影背景美术），
 *   不复用游戏里的任何像素素材 —— 游戏是 64×64 像素图，这里是厚涂写实。
 *
 * 【改时长】改下面 FRAMES 那一行，同时要改 Root.tsx 的 durationInFrames。
 * ========================================================================== */

import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

/* ---------------------------------------------------------------------------
 * 0. 时间表 —— 已经和 opening-audio.wav（25.00 秒）对死，不要随意改
 *    合计 600 帧 @24fps = 25.00 秒
 * ------------------------------------------------------------------------ */
const FRAMES = [67, 72, 53, 84, 36, 48, 48, 60, 72, 60];
const TOTAL = FRAMES.reduce((a, b) => a + b, 0); // 600
const START: number[] = [];
FRAMES.reduce((acc, n, i) => (START[i] = acc, acc + n), 0);
const at = (i: number) => START[i];

/* ---------------------------------------------------------------------------
 * 1. 基础工具
 * ------------------------------------------------------------------------ */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
/** 帧区间 → 0~1 的缓动进度 */
const prog = (f: number, a: number, b: number) => ease((f - a) / Math.max(1, b - a));
/** 确定性伪随机（同一 i 永远同一结果 —— 逐帧渲染不能有真随机） */
const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* 色板（和说明文档 §1.3 一致） */
const C = {
  sunset: '#ffb26b', glow: '#dff7ff', gold: '#f5c542',
  page: '#f7f1e6', ink: '#21182b', black: '#000',
};

/* ---------------------------------------------------------------------------
 * 2. 每个关键帧该画什么 —— 缺图时渲染成一张【动态分镜卡】
 *
 *    没有关键帧的时候，渲染出来不是一堆报错文字，而是一块能用来审节奏的分镜板：
 *    镜号 / 时码 / 场景 / 画面内容 / 运镜 / 光位 / 主体定位。
 *    这样"还没出图"的阶段也能先把 25 秒的节奏和音乐对一遍。
 * ------------------------------------------------------------------------ */
type KFInfo = { t: string; set: string; desc: string; move: string; light: string; subj: string };
const KF_INFO: Record<string, KFInfo> = {
  k01:  { t:'空教室',            set:'SET-A', desc:'放学后的中国小学教室，黄昏。三排木桌向纵深延伸，光柱里浮着尘埃', move:'缓右移 8% + 微推 1.00→1.06', light:'左窗斜射', subj:'无人物' },
  k02a: { t:'男孩走进教室',       set:'SET-A', desc:'背影 / 侧后 45°，逆光剪影，脸在暗部，肩膀微内收',           move:'固定 + 极轻呼吸感',        light:'左窗逆光', subj:'中景偏右' },
  k02b: { t:'男孩坐下掏书',       set:'SET-A', desc:'同一机位，已坐在座位上，侧后 45°，手伸进书包',              move:'固定 + 缓推 1.02→1.07',   light:'左窗逆光', subj:'中景中央' },
  k03:  { t:'桌面 + 浮起的魔法书', set:'SET-B', desc:'俯视 45°。旧木桌，课本拨到一边，魔法书离桌面约 2cm 浮着',   move:'缓推 1.00→1.18',          light:'左下斜射', subj:'书在正中' },
  k04a: { t:'翻开的空白页 + 手',   set:'SET-B', desc:'手部特写。书摊开，两页全空，带极淡擦痕。★ 不加任何光效',    move:'手持微晃 ±0.35%',         light:'左侧低角度', subj:'手在右页边' },
  k04b: { t:'快速翻页（动态模糊）', set:'SET-B', desc:'同机位，手指正在翻页，翻起的页有自然弯曲',                  move:'手持微晃（同上）',         light:'左侧低角度', subj:'手在中央' },
  k05:  { t:'举书到光下',         set:'SET-B', desc:'逆光。手把书举向窗户，书页边缘透出橙红',                    move:'完全固定',                light:'逆光',     subj:'书在中央偏上' },
  k06:  { t:'书脊极近 + 手指',     set:'SET-D', desc:'极近特写。磨损的布面书脊、起毛的边角、拇指和食指停住',      move:'完全固定（背景全虚）',      light:'低角度侧光', subj:'手指在中央' },
  k07:  { t:'抽出一支旧铅笔',      set:'SET-B', desc:'从书背后抽出笔。笔要普通：漆面磨损、笔尖钝。★ 不发光',      move:'跟随上抬 + 微推 1.00→1.12', light:'左窗侧光', subj:'笔在中央' },
  k08a: { t:'笔尖悬在空白页上',    set:'SET-C', desc:'正俯 90°。空白书页铺满画面，钝笔尖悬在纸面上方',            move:'俯拍固定（后半微推 1.05）', light:'柔和均匀', subj:'笔尖在上中' },
  k08b: { t:'画完一道弧线',        set:'SET-C', desc:'同机位，笔尖已画完一道墨黑弧线，手正在抬起',                move:'俯拍固定',                light:'柔和均匀', subj:'弧线在中央' },
  k09:  { t:'星星从纸面浮起',      set:'SET-C', desc:'墨痕抬起 → 立起 → 墨黑变金色 → 悬在半空。★ 全片唯一急推',   move:'急推（0~14 帧）+ 微仰',    light:'纸面自发光', subj:'星星在中央' },
  k10:  { t:'星星散成光点',        set:'SET-C', desc:'星星碎成光点往画外飘走，纸上只剩一道发光墨痕 → 渐白',       move:'缓拉回俯拍机位',           light:'余辉渐暗', subj:'光点在中央偏上' },
};

/* A range can be a simple two-point tween or a piecewise curve.  The latter
 * is used by shot 9 so its one fast push does not accidentally become a
 * 3-second Ken Burns move. */
type MotionRange = [number, number] | {input: number[]; output: number[]};
const motion = (range: MotionRange, p: number) => {
  if (Array.isArray(range)) return interpolate(p, [0, 1], range);
  return interpolate(p, range.input, range.output);
};

const Keyframe: React.FC<{
  kf: string;
  scale?: MotionRange; tx?: MotionRange; ty?: MotionRange;
  origin?: string; dur: number; local: number;
  opacity?: number;
}> = ({kf, scale = [1, 1], tx = [0, 0], ty = [0, 0], origin = '50% 50%', dur, local, opacity = 1}) => {
  const [ext, setExt] = React.useState<'svg' | 'png'>('svg');
  const [broken, setBroken] = React.useState(false);
  const p = dur <= 1 ? 1 : clamp01(local / (dur - 1));
  const transform =
    `scale(${motion(scale, p)}) ` +
    `translate(${motion(tx, p)}%, ${motion(ty, p)}%)`;
  const style: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', transform, transformOrigin: origin, opacity,
  };

  if (!broken) {
    return <Img src={staticFile(`keyframes/${kf}.${ext}`)} style={style}
      onError={() => ext === 'svg' ? setExt('png') : setBroken(true)} />;
  }

  /* ---- 缺图：渲染一张动态分镜卡（不是报错，是能审节奏的分镜板）---- */
  const info = KF_INFO[kf] || { t: kf, set:'—', desc:'（还没写设定）', move:'—', light:'—', subj:'—' };
  const row = (k: string, v: string) => (
    <div style={{display:'flex', gap:14, alignItems:'baseline'}}>
      <span style={{width:76, textAlign:'right', opacity:.42, fontSize:20, flex:'0 0 auto'}}>{k}</span>
      <span style={{fontSize:24}}>{v}</span>
    </div>
  );
  return (
    <AbsoluteFill style={{
      background:'#12101a', transform, transformOrigin: origin, opacity,
      alignItems:'center', justifyContent:'center',
      fontFamily:'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif', color:'#e8dcc8',
    }}>
      {/* 构图三分线 */}
      <AbsoluteFill style={{pointerEvents:'none', opacity:.09}}>
        {[33.33, 66.66].map(v => <div key={'v'+v} style={{
          position:'absolute', left:v+'%', top:0, bottom:0, width:1, background:'#e8dcc8'}} />)}
        {[33.33, 66.66].map(v => <div key={'h'+v} style={{
          position:'absolute', top:v+'%', left:0, right:0, height:1, background:'#e8dcc8'}} />)}
      </AbsoluteFill>

      <div style={{display:'flex', flexDirection:'column', gap:22, maxWidth:'78%'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:20}}>
          <span style={{fontSize:60, fontWeight:800, color:'#f5c542', letterSpacing:2}}>{kf.toUpperCase()}</span>
          <span style={{fontSize:34, fontWeight:700}}>{info.t}</span>
          <span style={{fontSize:22, opacity:.5, marginLeft:'auto'}}>{info.set}</span>
        </div>
        <div style={{height:2, background:'#f5c542', opacity:.35}} />
        {row('画面', info.desc)}
        {row('运镜', info.move)}
        {row('光位', info.light)}
        {row('主体', info.subj)}
        <div style={{marginTop:12, fontSize:21, opacity:.45, lineHeight:1.6}}>
          ← 还缺这张关键帧：<span style={{color:'#9fd8ff'}}>remotion/public/keyframes/{kf}.svg</span>（或 .png）<br />
          <span style={{fontSize:19}}>设定与提示词见《开场影片_写实设定与生成说明.md》</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------------------
 * 3. 代码画的那些光效（不要用 AI 生成 —— 代码可控、可调、不糊）
 * ------------------------------------------------------------------------ */

/** 浮尘：空气感的关键。缓慢上飘 + 随机闪烁 */
const Dust: React.FC<{n?: number; local: number; tint?: string; opacity?: number}> =
  ({n = 42, local, tint = '#ffe9c4', opacity = 1}) => (
  <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
    {Array.from({length: n}, (_, i) => {
      const x = rnd(i, 1) * 100;
      const speed = 0.22 + rnd(i, 2) * 0.5;
      const y = 105 - (((rnd(i, 3) * 120) + local * speed) % 130);
      const r = 1.2 + rnd(i, 4) * 2.6;
      const tw = 0.25 + 0.75 * Math.abs(Math.sin(local * 0.09 + rnd(i, 5) * 9));
      const drift = Math.sin(local * 0.03 + rnd(i, 6) * 7) * 1.4;
      return (
        <div key={i} style={{
          position: 'absolute', left: `${x + drift}%`, top: `${y}%`,
          width: r * 2, height: r * 2, borderRadius: '50%',
          background: tint, opacity: tw * 0.5, filter: 'blur(0.5px)',
        }} />
      );
    })}
  </AbsoluteFill>
);

/** 呼吸光：给魔法书 / 星星用的柔和辉光，用 sin 波驱动 */
const BreathGlow: React.FC<{x: number; y: number; size: number; color: string;
  local: number; base?: number; amp?: number; period?: number}> =
  ({x, y, size, color, local, base = .18, amp = .12, period = 26}) => {
  const o = base + amp * Math.sin(local / period * Math.PI * 2);
  return (
    <div style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`,
      width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
      borderRadius: '50%', pointerEvents: 'none',
      background: `radial-gradient(circle, ${color} 0%, ${color}00 62%)`,
      opacity: clamp01(o), filter: 'blur(6px)',
    }} />
  );
};

/** 扫光：镜 8 —— 光沿着画出来的那道线，从一端扫到另一端 */
const StrokeSweep: React.FC<{local: number; start: number; dur: number}> = ({local, start, dur}) => {
  const p = prog(local, start, start + dur);
  if (p <= 0) return null;
  const L = 900;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg viewBox="0 0 1280 720" width="100%" height="100%">
        <path d="M390 430 Q560 250 760 385" fill="none" stroke={C.ink}
          strokeWidth={16} strokeLinecap="round" opacity={.85}
          strokeDasharray={L} strokeDashoffset={L * (1 - p)} />
        <path d="M390 430 Q560 250 760 385" fill="none" stroke={C.gold}
          strokeWidth={9} strokeLinecap="round"
          strokeDasharray={L} strokeDashoffset={L * (1 - p)}
          opacity={clamp01((p - .35) * 2.2)}
          style={{filter: 'drop-shadow(0 0 14px #f5c542)'}} />
      </svg>
    </AbsoluteFill>
  );
};

/** 光点：星星散开 / 消散用 */
const Sparkles: React.FC<{x: number; y: number; local: number; start: number;
  dur: number; n?: number; spread?: number; converge?: boolean}> =
  ({x, y, local, start, dur, n = 26, spread = 320, converge = false}) => {
  const raw = (local - start) / Math.max(1, dur);
  if (raw <= 0 || raw >= 1.15) return null;
  const p = clamp01(raw);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: n}, (_, i) => {
        const a = (i / n) * Math.PI * 2 + rnd(i, 7) * 0.6;
        const d = (converge ? (1 - p) : p) * spread * (0.55 + rnd(i, 8) * 0.75);
        const r = (2.4 + rnd(i, 9) * 4.2) * (converge ? p : 1);
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: r * 2, height: r * 2, borderRadius: '50%',
            background: i % 2 ? C.gold : C.glow,
            boxShadow: `0 0 ${r * 3}px ${i % 2 ? C.gold : C.glow}`,
            opacity: converge ? p * 0.9 : (1 - p) * 0.95,
            transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

/** 胶片颗粒 + 暗角：让画面"厚"起来，像电影而不像插图 */
const Grain: React.FC<{local: number; amount?: number}> = ({local, amount = .05}) => (
  <AbsoluteFill style={{pointerEvents: 'none', opacity: amount, mixBlendMode: 'overlay'}}>
    <svg width="100%" height="100%">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"
          seed={Math.floor(local) % 97} />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);
const Vignette: React.FC<{strength?: number}> = ({strength = .42}) => (
  <AbsoluteFill style={{
    pointerEvents: 'none',
    background: `radial-gradient(ellipse at 50% 48%, transparent 42%, rgba(20,14,26,${strength}) 100%)`,
  }} />
);

/* ---------------------------------------------------------------------------
 * 4. 十个镜头
 * ------------------------------------------------------------------------ */

/** 镜 1 · 空教室 0.0–2.8 —— 缓右移 + 微推，只有浮尘在动 */
const Shot1: React.FC<{local: number; dur: number}> = ({local, dur}) => (
  <>
    <Keyframe kf="k01" local={local} dur={dur}
      scale={[1.00, 1.06]} tx={[-4, 4]} origin="60% 55%" />
    <Dust local={local} n={46} />
    <BreathGlow x={22} y={30} size={900} color={C.sunset} local={local} base={.14} amp={.05} period={70} />
    <Grain local={local} />
    <Vignette />
  </>
);

/** 镜 2 · 男孩走进来 2.8–5.8 —— 固定机位 + 极轻呼吸感，走进来之后切到坐下的那张 */
const Shot2: React.FC<{local: number; dur: number}> = ({local, dur}) => {
  const sitAt = 30;                       // 第 30 帧切到"已经坐好"
  const breath = Math.sin(local / 9) * 0.25;   // ±0.25% 的呼吸感
  return (
    <>
      {local < sitAt ? (
        <Keyframe kf="k02a" local={local} dur={sitAt}
          scale={[1.03, 1.05]} tx={[-1, 0]} origin="55% 52%" />
      ) : (
        <Keyframe kf="k02b" local={local - sitAt} dur={dur - sitAt}
          scale={[1.02, 1.07]} tx={[0, 1.5]} ty={[breath, -breath]} origin="52% 50%" />
      )}
      <Dust local={local} n={30} opacity={.8} />
      <Grain local={local} />
      <Vignette strength={.5} />
    </>
  );
};

/** 镜 3 · 发光的书 5.8–8.0 —— 缓推到书，书上一圈呼吸青光 */
const Shot3: React.FC<{local: number; dur: number}> = ({local, dur}) => (
  <>
    <Keyframe kf="k03" local={local} dur={dur}
      scale={[1.00, 1.18]} origin="50% 58%" />
    <BreathGlow x={50} y={56} size={460} color={C.glow} local={local} base={.30} amp={.16} period={19} />
    <Dust local={local} n={24} opacity={.7} />
    <Grain local={local} />
    <Vignette strength={.46} />
  </>
);

/** 镜 4 · 翻开，什么也没有 ★ 8.0–11.5
 *  —— 全片的支点。音乐停掉、光效全灭、翻得越来越快。 */
const Shot4: React.FC<{local: number; dur: number}> = ({local, dur}) => {
  /* 翻页节奏一次比一次快：切点间隔 22 → 12 → 10 → 8 → 8 */
  const cuts = [22, 34, 44, 52, 60, 70];
  const idx = cuts.filter(c => local >= c).length;
  const kf = idx % 2 === 0 ? 'k04a' : 'k04b';
  const prev = idx === 0 ? 0 : cuts[idx - 1];
  const shakeX = Math.sin(local * 0.9) * 0.35;   // 手持微晃 ±0.35%
  const shakeY = Math.cos(local * 1.13) * 0.28;
  return (
    <>
      <Keyframe kf={kf} local={local - prev} dur={Math.max(1, (cuts[idx] ?? dur) - prev)}
        scale={[1.06, 1.075]} tx={[shakeX, shakeX + .3]} ty={[shakeY, shakeY]} origin="50% 52%" />
      {/* ★ 这一镜不加任何光效 —— 青光、光尘、颗粒和暗角全部彻底消失。 */}
    </>
  );
};

/** 镜 5 · 但是有点亮 11.5–13.0 —— 固定，让光自己动 */
const Shot5: React.FC<{local: number; dur: number}> = ({local, dur}) => {
  const flash = prog(local, 12, 16) * (1 - prog(local, 16, 30));  // 第 12~16 帧闪一下
  return (
    <>
      <Keyframe kf="k05" local={local} dur={dur} scale={[1.02, 1.02]} />
      <BreathGlow x={50} y={44} size={420} color={C.sunset} local={local}
        base={.20 + flash * .55} amp={.06} period={22} />
      <Dust local={local} n={20} opacity={.55} />
      <Grain local={local} />
      <Vignette strength={.44} />
    </>
  );
};

/** 镜 6 · 摸到书背 13.0–15.0 —— 完全固定，靠"静"制造悬念 */
const Shot6: React.FC<{local: number; dur: number}> = ({local, dur}) => (
  <>
    <Keyframe kf="k06" local={local} dur={dur} scale={[1.03, 1.03]} />
    {/* 这一镜没有光效、颗粒、暗角、粒子或运镜 —— 那 0.6 秒的静音才是主角。 */}
  </>
);

/** 镜 7 · 抽出一支笔 15.0–17.0 —— 跟着笔上抬，然后微推笔尖
 *  ★ 笔在这一镜绝对不能发光 —— 发光是镜 8 的事。 */
const Shot7: React.FC<{local: number; dur: number}> = ({local, dur}) => (
  <>
    <Keyframe kf="k07" local={local} dur={dur}
      scale={[1.00, 1.12]} ty={[5, -5]} origin="50% 58%" />
    <BreathGlow x={52} y={34} size={520} color={C.sunset} local={local} base={.10} amp={.05} period={17} />
    <Dust local={local} n={16} opacity={.5} />
    <Grain local={local} />
    <Vignette strength={.48} />
  </>
);

/** 镜 8 · 试着画一笔 17.0–19.5 —— 光沿着画出来的线扫过去 */
const Shot8: React.FC<{local: number; dur: number}> = ({local, dur}) => {
  const drawAt = 26;
  const reveal = prog(local, drawAt, drawAt + 6);
  return (
    <>
      {/* K8a is the hesitation; K8b is the same top-down composition after
       * the stroke.  A short dissolve keeps the hand/paper geometry stable. */}
      <Keyframe kf="k08a" local={local} dur={dur}
        scale={[1.00, 1.05]} origin="50% 50%" opacity={1 - reveal} />
      <Keyframe kf="k08b" local={Math.max(0, local - drawAt)} dur={Math.max(1, dur - drawAt)}
        scale={[1.00, 1.05]} origin="50% 50%" opacity={reveal} />
      <StrokeSweep local={local} start={drawAt} dur={34} />
      <Grain local={local} />
      <Vignette strength={.40} />
    </>
  );
};

/** 镜 9 · 它真的出现了 19.5–22.5 —— ★ 全片唯一一次急推 + 白闪 */
const Shot9: React.FC<{local: number; dur: number}> = ({local, dur}) => {
  /* 急推：0~14 帧从俯视冲到侧仰；之后交给 k09 自己的缓慢自转 */
  const rush = prog(local, 0, 14);
  return (
    <>
      <Keyframe kf="k09" local={local} dur={dur}
        scale={{input: [0, 14 / Math.max(1, dur - 1), 1], output: [1.22, 1.06, 1.04]}}
        ty={{input: [0, 14 / Math.max(1, dur - 1), 1], output: [6, 0, -1]}} origin="50% 46%" />
      <Sparkles x={50} y={42} local={local} start={10} dur={44} n={30} spread={330} />
      <BreathGlow x={50} y={40} size={640} color={C.gold} local={local} base={.34} amp={.20} period={15} />
      <Grain local={local} amount={.045} />
      <Vignette strength={.36} />
    </>
  );
};

/** 镜 10 · 散成光点 22.5–25.0 —— 缓拉回镜 8 的俯拍机位，最后渐白
 *  ★ 结尾不给结果：星星飘走，纸上只剩一道发光的墨痕。 */
const Shot10: React.FC<{local: number; dur: number}> = ({local, dur}) => {
  const fadeToPage = prog(local, dur - 22, dur);
  const afterglow = 1 - prog(local, 20, dur - 6);      // 墨痕余辉慢慢消失
  return (
    <>
      <Keyframe kf="k10" local={local} dur={dur}
        scale={[1.16, 1.02]} ty={[-1, 2]} origin="50% 50%" />
      <Sparkles x={50} y={34} local={local} start={2} dur={34} n={34} spread={430} />
      {/* 纸上那道墨痕的余辉 */}
      <div style={{
        position: 'absolute', left: '36.5%', top: '59%', width: '27%', height: 10,
        borderRadius: 6, background: C.gold, opacity: afterglow * .55,
        filter: 'blur(5px)', pointerEvents: 'none',
      }} />
      <Grain local={local} amount={.04} />
      <Vignette strength={.34} />
      {/* 渐白 —— 接游戏面板（#f7f1e6 正好是书页色） */}
      <AbsoluteFill style={{background: C.page, opacity: fadeToPage, pointerEvents: 'none'}} />
    </>
  );
};

/* ---------------------------------------------------------------------------
 * 5. 装配
 * ------------------------------------------------------------------------ */
const SHOTS = [Shot1, Shot2, Shot3, Shot4, Shot5, Shot6, Shot7, Shot8, Shot9, Shot10];

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();

  let idx = 0;
  for (let i = 0; i < START.length; i++) if (frame >= START[i]) idx = i;
  const local = frame - START[idx];
  const dur = FRAMES[idx];
  const Shot = SHOTS[idx];

  /* 首尾：从黑起（18 帧）／结尾在 Shot10 内部渐白 */
  const fadeIn = prog(frame, 0, 18);

  /* ★ 镜 8 → 镜 9 的白闪：全片唯一一次，配合"成真"的爆点 */
  const flashAt = at(8);
  const flash = (frame >= flashAt - 5 && frame <= flashAt + 7)
    ? (1 - Math.abs(frame - flashAt - 1) / 6) * 0.85 : 0;

  /* 镜 4（翻页支点）和镜 6（完全静默）硬切；其余镜头用短叠化。
   * 叠化层是真正的上一镜尾帧，而不是淡入黑场，避免镜头间不必要的闪黑。 */
  const xfade = 4;
  const crossfade = idx > 0 && idx !== 3 && idx !== 5 && local < xfade;
  const fadeInShot = crossfade ? ease(local / xfade) : 1;
  const PrevShot = idx > 0 ? SHOTS[idx - 1] : null;
  const prevDur = idx > 0 ? FRAMES[idx - 1] : 0;
  const prevLocal = idx > 0 ? prevDur - xfade + local : 0;

  return (
    <AbsoluteFill style={{background: C.black, overflow: 'hidden'}}>
      {crossfade && PrevShot && (
        <AbsoluteFill style={{opacity: 1 - fadeInShot}}>
          <PrevShot local={prevLocal} dur={prevDur} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{opacity: fadeIn * fadeInShot}}>
        <Shot local={local} dur={dur} />
      </AbsoluteFill>

      {/* 白闪 */}
      {flash > 0 && <AbsoluteFill style={{background: '#fff', opacity: flash, pointerEvents: 'none'}} />}

      <Audio src={staticFile('opening-audio.wav')} volume={0.78} />
    </AbsoluteFill>
  );
};

/* 给 Root.tsx 用：保证 durationInFrames 和这里的时间表永远一致 */
export const OPENING_FRAMES = TOTAL;
