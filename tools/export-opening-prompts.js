#!/usr/bin/env node
/*
 * Export the v3 opening-film prompt catalog.
 *
 * This file deliberately does not generate images and does not touch the
 * Remotion composition. It only resolves the prompt metadata into a Chinese
 * review document and a machine-readable catalog for the image-generation
 * step. Run it after remotion/opening-keyframes.json has been updated to v3.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INPUT_FILE = path.join(PROJECT_ROOT, 'remotion', 'opening-keyframes.json');
const MARKDOWN_FILE = path.join(PROJECT_ROOT, 'remotion', '开场影片_完整提示词.md');
const RESOLVED_FILE = path.join(PROJECT_ROOT, 'remotion', 'opening-prompts.resolved.json');

const FALLBACK_NEGATIVE_EN = [
  'pixel art', '8-bit', 'mosaic', 'retro game style', '3D render', 'CG',
  'plastic look', 'smooth textureless surfaces', 'photograph', 'live-action photo',
  'thick black outlines', 'flat vector art', 'over-simplified', 'chibi', 'childish',
  'oversized head', 'anime big eyes', 'exaggerated expression', 'cute mascot style',
  'deformed hands', 'six fingers', 'extra fingers', 'reversed joints', 'text',
  'English words', 'letters', 'watermark', 'signature', 'border', 'trademark', 'logo',
  'oversaturated', 'HDR', 'neon', 'cyberpunk', 'magic circle', 'gemstones',
  'locks', 'ornate decoration', 'glowing runes'
].join(', ');

const text = (value) => {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map((part) => text(part)).filter(Boolean).join(', ');
  return String(value).trim();
};

function fail(message) {
  throw new Error(`[export-opening-prompts] ${message}`);
}

function readJson(file) {
  if (!fs.existsSync(file)) fail(`找不到输入文件：${path.relative(PROJECT_ROOT, file)}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`JSON 无法解析：${path.relative(PROJECT_ROOT, file)}\n${err.message}`);
  }
}

function ensure(condition, message) {
  if (!condition) fail(message);
}

function arrayOrEmpty(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function asNumber(value, label) {
  const n = Number(value);
  ensure(Number.isFinite(n), `${label} 必须是数字，收到：${JSON.stringify(value)}`);
  return n;
}

function versionString(data) {
  return data.schemaVersion || data.version || (data.spec && data.spec.version) || '';
}

function isSupportedVersion(version) {
  return /^(?:v)?[23](?:\.|$)/i.test(text(version));
}

function validateTopLevel(data) {
  ensure(data && typeof data === 'object' && !Array.isArray(data), '输入必须是 JSON 对象');
  const version = versionString(data);
  ensure(version && isSupportedVersion(version), `需要 schema v2/v3（schemaVersion/version/spec.version），当前是：${version || '未提供'}`);
  ensure(data.spec && typeof data.spec === 'object' && !Array.isArray(data.spec), '缺少顶层 spec 对象');
  for (const field of ['styleAnchorZh', 'styleAnchorEn', 'negativePrompt', 'negativePromptEn']) {
    ensure(text(data[field]), `缺少顶层 ${field}`);
  }
  ensure(Array.isArray(data.referenceAssets), 'referenceAssets 必须是数组');
  ensure(Array.isArray(data.keyframes), 'keyframes 必须是数组');
  ensure(Array.isArray(data.shots), 'shots 必须是数组');
}

function deriveShots(data) {
  const frameLengths = arrayOrEmpty(data.remotion && data.remotion.shotFrames).map(Number);
  ensure(frameLengths.length === 10, 'v2 缺少 shots，且 remotion.shotFrames 不是 10 项');
  const frames = [];
  let cursor = 0;
  for (let i = 0; i < frameLengths.length; i += 1) {
    const durationFrames = frameLengths[i];
    frames.push({shot: i + 1, fromFrame: cursor, durationFrames, variants: [], camera: {}, effects: [], audio: null});
    cursor += durationFrames;
  }
  for (const frame of data.keyframes || []) {
    const shot = frames[Number(frame.shot) - 1];
    if (!shot) continue;
    shot.variants.push(frame.key);
    shot.camera = shot.camera && Object.keys(shot.camera).length ? shot.camera : (frame.camera || {});
    shot.effects = [...new Set([...(shot.effects || []), ...arrayOrEmpty(frame.overlay)])];
    shot.promptRefs = [...new Set([...(shot.promptRefs || []), frame.key, frame.scene].filter(Boolean))];
  }
  const audioByShot = {
    1: '远处操场人声与一两声鸟，最后0.8秒只剩轻风',
    2: '脚步三下、书包咚、椅腿刮地、拉链声',
    3: '课本啪嗒，随后一声很轻的风铃高音',
    4: '翻页唰声四次逐渐加快；音乐停止，只剩纸声',
    5: '清脆短促的单音叮；音乐只回一个音',
    6: '音乐停一拍，约0.6秒静音，只有轻呼吸',
    7: '抽笔摩擦簌声与一个由低到高的上扬音',
    8: '笔尖沙沙0.8秒、静0.3秒、电子音渐强0.7秒',
    9: '魔法上升音接镜8扫光，再叠高音铃',
    10: '亮声持续后0.8秒淡出'
  };
  for (const shot of frames) shot.audio = audioByShot[shot.shot] || null;
  return frames;
}

function frameRangeOf(frame, shotInfo) {
  if (frame.fromFrame !== undefined && frame.durationFrames !== undefined) {
    return {fromFrame: Number(frame.fromFrame), durationFrames: Number(frame.durationFrames)};
  }
  const match = text(frame.time).match(/([0-9]+(?:\.[0-9]+)?)\s*[–-]\s*([0-9]+(?:\.[0-9]+)?)s/);
  if (match) {
    const fromFrame = Math.round(Number(match[1]) * 24);
    const endFrame = Math.round(Number(match[2]) * 24);
    return {fromFrame, durationFrames: endFrame - fromFrame};
  }
  const shot = shotInfo && shotInfo.byShot && shotInfo.byShot.get(Number(frame.shot));
  if (shot) return {fromFrame: shot.fromFrame, durationFrames: shot.durationFrames};
  fail(`关键帧 ${frame.key || '(unknown)'} 缺少 fromFrame/durationFrames 或 time`);
}

function normaliseInput(raw) {
  const styleAnchorZh = raw.styleAnchorZh || (raw.spec && raw.spec.styleAnchorZh);
  const styleAnchorEn = raw.styleAnchorEn || (raw.spec && raw.spec.styleAnchorEn);
  const negativePrompt = raw.negativePrompt || (raw.spec && raw.spec.negativePrompt) || '';
  // v2 predates an English negative list. Keep the Chinese list as a complete
  // fallback so every generated entry still has a copyable negative prompt.
  const negativePromptEn = raw.negativePromptEn || (raw.spec && raw.spec.negativePromptEn) || FALLBACK_NEGATIVE_EN;
  const referenceAssets = raw.referenceAssets || raw.assets || [];
  const inferredReferences = {
    K2a: ['CHR'], K2b: ['CHR'], K4a: ['HAND-1'], K4b: ['HAND-1'],
    K5: ['HAND-2'], K6: ['HAND-2'], K7: ['HAND-2'], K8a: ['HAND-2'],
    K8b: ['HAND-2'], K10: ['HAND-2', 'CHR']
  };
  const keyframes = (raw.keyframes || []).map((frame) => Object.assign({}, frame, {
    referenceKeys: frame.referenceKeys || inferredReferences[frame.key] || []
  }));
  const shots = raw.shots || deriveShots(Object.assign({}, raw, {keyframes}));
  const shotMap = new Map(shots.map((shot, index) => [Number(shot.shot || index + 1), shot]));
  for (const frame of keyframes) {
    const range = frameRangeOf(frame, {byShot: shotMap});
    frame.fromFrame = range.fromFrame;
    frame.durationFrames = range.durationFrames;
  }
  return Object.assign({}, raw, {styleAnchorZh, styleAnchorEn, negativePrompt, negativePromptEn, referenceAssets, keyframes, shots});
}

function uniqueKeys(items, label) {
  const seen = new Set();
  for (const item of items) {
    ensure(item && typeof item === 'object', `${label} 中存在非对象项目`);
    const key = text(item.key);
    ensure(key, `${label} 中有项目缺少 key`);
    ensure(!seen.has(key), `${label} 出现重复 key：${key}`);
    seen.add(key);
  }
  return seen;
}

function validateReferenceAssets(data, referenceKeys) {
  data.referenceAssets.forEach((asset, index) => {
    const label = `referenceAssets[${index}]`;
    ensure(text(asset.file), `${label}.file 不能为空`);
    ensure(text(asset.prompt), `${label}.prompt 不能为空`);
    if (asset.promptZh !== undefined) ensure(text(asset.promptZh), `${label}.promptZh 不能为空或删除该字段`);
    if (asset.referenceKeys !== undefined) ensure(Array.isArray(asset.referenceKeys), `${label}.referenceKeys 必须是数组`);
    for (const ref of arrayOrEmpty(asset.referenceKeys)) {
      ensure(referenceKeys.has(text(ref)), `${label}.referenceKeys 引用不存在：${text(ref)}`);
    }
  });
}

function shotNumber(shot, index) {
  const n = shot.shot === undefined ? index + 1 : Number(shot.shot);
  ensure(Number.isInteger(n) && n >= 1, `shots[${index}].shot 必须是正整数`);
  return n;
}

function validateShots(data) {
  ensure(data.shots.length === 10, `shots 必须正好有 10 个镜头，当前 ${data.shots.length} 个`);
  const canvas = data.spec.canvas || {};
  const durationFrames = asNumber(canvas.durationFrames || data.durationFrames || data.spec.durationFrames || 600, 'durationFrames');
  const byShot = new Map();
  let cursor = 0;
  data.shots.forEach((shot, index) => {
    const n = shotNumber(shot, index);
    ensure(!byShot.has(n), `shots 出现重复镜头编号：${n}`);
    const from = asNumber(shot.fromFrame, `shots[${index}].fromFrame`);
    const duration = asNumber(shot.durationFrames, `shots[${index}].durationFrames`);
    ensure(Number.isInteger(from) && Number.isInteger(duration), `shots[${index}] 帧数必须是整数`);
    ensure(from === cursor, `镜头帧不连续：镜头 ${n} 应从 ${cursor} 开始，实际 ${from}`);
    ensure(duration > 0, `镜头 ${n} durationFrames 必须大于 0`);
    cursor = from + duration;
    byShot.set(n, {shot, index, fromFrame: from, durationFrames: duration, endFrame: cursor});
  });
  ensure(cursor === durationFrames, `10 镜头应连续覆盖 ${durationFrames} 帧，实际到 ${cursor} 帧`);
  ensure(durationFrames === 600, `开场影片必须是 600 帧，当前 ${durationFrames} 帧`);
  return {byShot, durationFrames};
}

function validateKeyframes(data, referenceKeys, shotInfo) {
  const seen = new Set();
  data.keyframes.forEach((frame, index) => {
    const label = `keyframes[${index}]`;
    const key = text(frame.key);
    ensure(key, `${label}.key 不能为空`);
    ensure(!seen.has(key), `keyframes 出现重复 key：${key}`);
    seen.add(key);
    for (const field of ['file', 'description', 'prompt']) {
      ensure(text(frame[field]), `${label}.${field} 不能为空`);
    }
    if (frame.promptZh !== undefined) ensure(text(frame.promptZh), `${label}.promptZh 不能为空或删除该字段`);
    const shot = asNumber(frame.shot, `${label}.shot`);
    ensure(Number.isInteger(shot) && shotInfo.byShot.has(shot), `${label}.shot 引用不存在的镜头：${shot}`);
    const from = asNumber(frame.fromFrame, `${label}.fromFrame`);
    const duration = asNumber(frame.durationFrames, `${label}.durationFrames`);
    ensure(Number.isInteger(from) && Number.isInteger(duration), `${label} 帧数必须是整数`);
    ensure(duration > 0, `${label}.durationFrames 必须大于 0`);
    const target = shotInfo.byShot.get(shot);
    ensure(from >= target.fromFrame && from + duration <= target.endFrame,
      `${label} (${from}–${from + duration}) 超出镜头 ${shot} 的范围 (${target.fromFrame}–${target.endFrame})`);
    if (frame.referenceKeys !== undefined) ensure(Array.isArray(frame.referenceKeys), `${label}.referenceKeys 必须是数组`);
    for (const ref of arrayOrEmpty(frame.referenceKeys)) {
      ensure(referenceKeys.has(text(ref)), `${label}.referenceKeys 引用不存在：${text(ref)}`);
    }
    if (frame.constraints !== undefined) ensure(Array.isArray(frame.constraints), `${label}.constraints 必须是数组`);
    if (frame.overlay !== undefined) ensure(Array.isArray(frame.overlay), `${label}.overlay 必须是数组`);
    if (frame.camera !== undefined) ensure(typeof frame.camera === 'object' && frame.camera !== null, `${label}.camera 必须是对象`);
  });
  return seen;
}

function variantKey(variant) {
  if (typeof variant === 'string' || typeof variant === 'number') return text(variant);
  if (variant && typeof variant === 'object') return text(variant.key || variant.frameKey || variant.id);
  return '';
}

function validateVariantReferences(data, keyframeKeys) {
  data.shots.forEach((shot, index) => {
    for (const variant of arrayOrEmpty(shot.variants)) {
      const key = variantKey(variant);
      ensure(key, `shots[${index}].variants 中存在无法识别的变体`);
      ensure(keyframeKeys.has(key), `shots[${index}].variants 引用不存在的关键帧：${key}`);
    }
  });
}

function validate(data) {
  validateTopLevel(data);
  const referenceKeys = uniqueKeys(data.referenceAssets, 'referenceAssets');
  validateReferenceAssets(data, referenceKeys);
  const shotInfo = validateShots(data);
  const keyframeKeys = validateKeyframes(data, referenceKeys, shotInfo);
  validateVariantReferences(data, keyframeKeys);
  return {referenceKeys, keyframeKeys, shotInfo};
}

function styleText(styleOverride, globalStyle) {
  if (typeof styleOverride === 'string' && text(styleOverride)) return text(styleOverride);
  if (styleOverride && typeof styleOverride === 'object') {
    for (const key of ['en', 'english', 'prompt', 'styleAnchorEn']) {
      if (text(styleOverride[key])) return text(styleOverride[key]);
    }
  }
  return text(globalStyle);
}

function combinePositive(styleOverride, globalStyle, prompt) {
  const style = styleText(styleOverride, globalStyle);
  const body = text(prompt);
  ensure(style && body, '正向提示词必须同时包含风格锚点和 prompt');
  return `${style}\n${body}`;
}

function splitTerms(value) {
  return text(value)
    .split(/[,，、;；\n]+/g)
    .map((term) => term.trim())
    .filter(Boolean);
}

function combineNegative(globalNegative, localNegative) {
  const terms = [];
  const seen = new Set();
  for (const term of [...splitTerms(globalNegative), ...splitTerms(localNegative)]) {
    const id = term.toLocaleLowerCase();
    if (!seen.has(id)) {
      seen.add(id);
      terms.push(term);
    }
  }
  ensure(terms.length > 0, '负向提示词不能为空');
  return terms.join(', ');
}

function canvasOf(data) {
  const canvas = data.spec.canvas || {};
  return {
    width: Number(canvas.width || data.width || data.spec.width || 1280),
    height: Number(canvas.height || data.height || data.spec.height || 720),
    fps: Number(canvas.fps || data.fps || data.spec.fps || 24),
    durationFrames: Number(canvas.durationFrames || data.durationFrames || data.spec.durationFrames || 600)
  };
}

function dimensionsOf(item, data) {
  const candidates = [item.dimensions, item.size, item.canvas, item.imageDimensions, item.outputDimensions,
    data.assetDimensions, data.spec.assetDimensions, data.spec.imageDimensions, data.spec.keyframeDimensions];
  for (const value of candidates) {
    if (typeof value === 'string' && /^\d+\s*[x×]\s*\d+$/i.test(value)) {
      const [width, height] = value.toLowerCase().split(/[x×]/).map((v) => Number(v.trim()));
      return {width, height};
    }
    if (value && typeof value === 'object') {
      const width = Number(value.width);
      const height = Number(value.height);
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return {width, height};
    }
  }
  const width = Number(item.width);
  const height = Number(item.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return {width, height};
  // Image-generation assets need room for Ken Burns; this is the documented
  // fallback when v3 does not repeat a per-file size.
  const fallback = data.spec.recommendedImageDimensions || {width: 2560, height: 1440};
  return {width: Number(fallback.width), height: Number(fallback.height)};
}

function filePathOf(item, kind) {
  const supplied = item.filePath || item.path || item.outputPath;
  if (text(supplied)) return text(supplied).replace(/\\/g, '/');
  const file = text(item.file).replace(/\\/g, '/');
  if (/^(?:[A-Za-z]:\/|\/|remotion\/|assets\/)/.test(file)) return file;
  if (kind === 'keyframe') return `remotion/public/keyframes/${file}`;
  return `remotion/public/opening/references/${file}`;
}

function shotFor(frame, shotInfo) {
  return shotInfo.byShot.get(Number(frame.shot));
}

function resolveReference(asset, data) {
  return Object.assign({}, asset, {
    resolvedPrompt: combinePositive(asset.styleOverride, data.styleAnchorEn, asset.prompt),
    resolvedNegativePrompt: combineNegative(data.negativePromptEn, asset.negativePrompt),
    dimensions: dimensionsOf(asset, data),
    filePath: filePathOf(asset, 'reference'),
    referenceKeys: arrayOrEmpty(asset.referenceKeys)
  });
}

function resolveKeyframe(frame, data, shotInfo) {
  const shot = shotFor(frame, shotInfo);
  const ownEffects = frame.effects !== undefined ? frame.effects : frame.overlay;
  const effectiveEffects = ownEffects !== undefined ? ownEffects : (shot && shot.shot.effects) || [];
  const effectiveCamera = frame.camera !== undefined ? frame.camera : (shot && shot.shot.camera) || {};
  return Object.assign({}, frame, {
    resolvedPrompt: combinePositive(frame.styleOverride, data.styleAnchorEn, frame.prompt),
    resolvedNegativePrompt: combineNegative(data.negativePromptEn, frame.negativePrompt),
    dimensions: dimensionsOf(frame, data),
    filePath: filePathOf(frame, 'keyframe'),
    referenceKeys: arrayOrEmpty(frame.referenceKeys),
    effectiveCamera,
    effectiveEffects,
    shotEffects: shot && shot.shot.effects !== undefined ? shot.shot.effects : [],
    shotAudio: shot && shot.shot.audio !== undefined ? shot.shot.audio : null
  });
}

function frameRange(from, duration) {
  return `${from}–${from + duration}（${(from / 24).toFixed(2)}–${((from + duration) / 24).toFixed(2)}s）`;
}

function jsonCode(value) {
  return JSON.stringify(value, null, 2);
}

function mdCell(value) {
  return text(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function markdown(data, resolved, validation) {
  const canvas = canvasOf(data);
  const lines = [];
  lines.push('# 开场影片·完整文生图提示词');
  lines.push('');
  lines.push('> 本文件是给文生图工具使用的提示词清单。**Remotion 不理解文生图提示词**，必须先用下列提示词生成合格 PNG，再将 PNG 放入对应文件路径。当前如果目录里仍只有 SVG，它们只是构图草稿，不是合格的正式写实图片。');
  lines.push('');
  lines.push(`- Schema：${mdCell(versionString(data))}；画布：${canvas.width}×${canvas.height} @ ${canvas.fps}fps；总时长：${canvas.durationFrames} 帧（${(canvas.durationFrames / canvas.fps).toFixed(2)}s）`);
  lines.push(`- 安全区：${mdCell(data.spec.canvas && data.spec.canvas.safeArea || data.spec.safeArea || '5%')}`);
  lines.push('- 关键帧输出尺寸：每条记录中的“尺寸”；未单独指定时按 2560×1440 生成，供 Ken Burns 运镜留余量。');
  lines.push('');
  lines.push('## 中文索引');
  lines.push('');
  lines.push('| 类型 | 键 | 镜头 | 帧范围 | 描述 | 尺寸 | 文件路径 | 参考键 | 状态 |');
  lines.push('|---|---|---:|---|---|---|---|---|---|');
  for (const item of resolved.referenceAssets) {
    lines.push(`| 参考资产 | ${mdCell(item.key)} | — | — | ${mdCell(item.description || '角色/场景/道具参考图')} | ${item.dimensions.width}×${item.dimensions.height} | ${mdCell(item.filePath)} | ${mdCell(item.referenceKeys.join(', '))} | ${mdCell(item.status || 'reference')} |`);
  }
  for (const item of resolved.keyframes) {
    lines.push(`| 关键帧 | ${mdCell(item.key)} | ${item.shot} | ${frameRange(item.fromFrame, item.durationFrames)} | ${mdCell(item.description)} | ${item.dimensions.width}×${item.dimensions.height} | ${mdCell(item.filePath)} | ${mdCell(item.referenceKeys.join(', '))} | ${mdCell(item.status || 'todo')} |`);
  }
  lines.push('');
  lines.push('## 十镜时间线');
  lines.push('');
  lines.push('| 镜头 | 帧范围 | 变体 | camera | effects | audio |');
  lines.push('|---:|---|---|---|---|---|');
  data.shots.forEach((shot, index) => {
    const n = shotNumber(shot, index);
    lines.push(`| ${n} | ${frameRange(Number(shot.fromFrame), Number(shot.durationFrames))} | ${mdCell(arrayOrEmpty(shot.variants).map(variantKey).join(', '))} | ${mdCell(JSON.stringify(shot.camera || {}))} | ${mdCell(JSON.stringify(shot.effects || []))} | ${mdCell(JSON.stringify(shot.audio || null))} |`);
  });
  lines.push('');
  lines.push('## 生成前的全局锚点');
  lines.push('');
  lines.push('### 全局正向风格（中文）');
  lines.push('');
  lines.push('```text');
  lines.push(data.styleAnchorZh);
  lines.push('```');
  lines.push('');
  lines.push('### Global style anchor (English)');
  lines.push('');
  lines.push('```text');
  lines.push(data.styleAnchorEn);
  lines.push('```');
  lines.push('');
  lines.push('### 全局负向词 / Global negative prompt');
  lines.push('');
  lines.push('```text');
  lines.push(`${data.negativePrompt}\n\n${data.negativePromptEn}`);
  lines.push('```');
  lines.push('');
  lines.push('## 参考资产提示词');
  lines.push('');
  for (const item of resolved.referenceAssets) appendItem(lines, item, '参考资产');
  lines.push('## 关键帧提示词');
  lines.push('');
  for (const item of resolved.keyframes) appendItem(lines, item, `镜头 ${item.shot} / ${item.key}`);
  lines.push('## 验证结果');
  lines.push('');
  lines.push(`- referenceAssets：${validation.referenceKeys.size} 个唯一键；keyframes：${validation.keyframeKeys.size} 个唯一键。`);
  lines.push(`- shots：10 个，帧 0–${validation.shotInfo.durationFrames} 连续无间隙，满足 600 帧验收。`);
  lines.push('- 所有 prompt 和 negative prompt 均已展开为可单独复制的完整文本；referenceKeys 仅作为一致性参考，不替代提示词。');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function appendItem(lines, item, heading) {
  lines.push(`### ${heading}`);
  lines.push('');
  lines.push(`- **键**：${item.key}`);
  if (item.shot !== undefined) lines.push(`- **镜头**：${item.shot}；帧：${frameRange(item.fromFrame, item.durationFrames)}`);
  lines.push(`- **文件路径**：${item.filePath}`);
  lines.push(`- **尺寸**：${item.dimensions.width}×${item.dimensions.height}`);
  lines.push(`- **参考键**：${item.referenceKeys.length ? item.referenceKeys.join(', ') : '无'}`);
  lines.push(`- **状态**：${item.status || (item.inVideo === false ? 'reference' : 'todo')}`);
  if (item.description) lines.push(`- **画面说明**：${item.description}`);
  lines.push('');
  lines.push('**正向完整提示词（English）**');
  lines.push('');
  lines.push('```text');
  lines.push(item.resolvedPrompt);
  lines.push('```');
  lines.push('');
  if (item.promptZh) {
    lines.push('**正向提示词（中文说明）**');
    lines.push('');
    lines.push('```text');
    lines.push(item.promptZh);
    lines.push('```');
    lines.push('');
  }
  lines.push('**Negative prompt（完整可复制）**');
  lines.push('');
  lines.push('```text');
  lines.push(item.resolvedNegativePrompt);
  lines.push('```');
  lines.push('');
  if (item.effectiveCamera || item.camera) {
    lines.push(`- **camera**：\`${JSON.stringify(item.effectiveCamera || item.camera)}\``);
  }
  if (item.overlay !== undefined) lines.push(`- **overlay**：\`${JSON.stringify(item.overlay)}\``);
  if (item.effectiveEffects !== undefined) lines.push(`- **effects（含镜头继承）**：\`${JSON.stringify(item.effectiveEffects)}\``);
  if (item.shotAudio !== undefined && item.shotAudio !== null) lines.push(`- **audio**：\`${JSON.stringify(item.shotAudio)}\``);
  if (item.constraints && item.constraints.length) lines.push(`- **constraints**：${item.constraints.join('；')}`);
  lines.push('');
}

function resolvedDocument(data, resolved) {
  return {
    schemaVersion: versionString(data),
    spec: data.spec,
    styleAnchorZh: data.styleAnchorZh,
    styleAnchorEn: data.styleAnchorEn,
    negativePrompt: data.negativePrompt,
    negativePromptEn: data.negativePromptEn,
    referenceAssets: resolved.referenceAssets,
    keyframes: resolved.keyframes,
    shots: data.shots.map((shot, index) => Object.assign({}, shot, {
      shot: shotNumber(shot, index),
      frameEnd: Number(shot.fromFrame) + Number(shot.durationFrames)
    })),
    remotion: data.remotion || null,
    source: 'remotion/opening-keyframes.json'
  };
}

function main() {
  const data = normaliseInput(readJson(INPUT_FILE));
  const validation = validate(data);
  const shotInfo = validation.shotInfo;
  const resolved = {
    referenceAssets: data.referenceAssets.map((asset) => resolveReference(asset, data)),
    keyframes: data.keyframes.map((frame) => resolveKeyframe(frame, data, shotInfo))
  };
  fs.writeFileSync(MARKDOWN_FILE, markdown(data, resolved, validation), 'utf8');
  fs.writeFileSync(RESOLVED_FILE, `${JSON.stringify(resolvedDocument(data, resolved), null, 2)}\n`, 'utf8');
  console.log(`已输出：${path.relative(PROJECT_ROOT, MARKDOWN_FILE)}`);
  console.log(`已输出：${path.relative(PROJECT_ROOT, RESOLVED_FILE)}`);
  console.log(`校验通过：${validation.referenceKeys.size} 个参考资产、${validation.keyframeKeys.size} 个关键帧、10 镜/600 帧连续。`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = {main, validate, combinePositive, combineNegative, dimensionsOf, filePathOf};
