#!/usr/bin/env node
/* =========================================================================
   sprite-align.js —— 实物像素图「对齐」的数值验收
   -------------------------------------------------------------------------
   为什么需要它：对齐是这个需求的核心。肉眼看叠加图能发现大偏差，
   但「差了 2% 还是 6%」看不准。这个工具直接把 PNG 解码，
   算出实物图的【内容包围盒】，再和简笔画的包围盒逐个比较，给数字。

   原理：
     引擎把整张实物图 drawImage 到和简笔画完全相同的那个正方形里，
     所以  图片像素 0 → 简笔画坐标 0，图片像素 64 → 简笔画坐标 100。
     于是   简笔画坐标 = 像素坐标 ÷ 边长 × 100
     两者包围盒一致 = 对齐。

   用法：
     node tools/sprite-align.js             检查所有已登记真图的图形
     node tools/sprite-align.js --tol 5     自定义容差（默认 4 个单位）
     node tools/sprite-align.js --png       额外检查背景透明度 / 颜色数
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, loadConsts } = require('./_extract.js');
const { SKETCH, SPRITE } = loadConsts(['SKETCH','SPRITE']);

/* ---------------- 极简 PNG 解码（8 位、非隔行） ---------------- */
function decodePNG(buf){
  if(buf.readUInt32BE(0)!==0x89504E47) throw new Error('不是 PNG 文件');
  let off=8, ihdr=null; const idat=[];
  while(off+8<=buf.length){
    const len=buf.readUInt32BE(off);
    const type=buf.toString('ascii',off+4,off+8);
    const data=buf.subarray(off+8,off+8+len);
    if(type==='IHDR'){
      ihdr={ w:data.readUInt32BE(0), h:data.readUInt32BE(4), depth:data[8],
             color:data[9], interlace:data[12] };
    } else if(type==='IDAT') idat.push(Buffer.from(data));
    else if(type==='IEND') break;
    off += 12+len;
  }
  if(!ihdr) throw new Error('缺少 IHDR');
  if(ihdr.interlace) throw new Error('不支持隔行扫描 PNG（请导出普通 PNG）');
  if(ihdr.depth!==8) throw new Error('只支持 8 位色深（实际 '+ihdr.depth+' 位）');
  const CH={0:1,2:3,3:1,4:2,6:4};
  const ch=CH[ihdr.color];
  if(!ch) throw new Error('不支持的颜色类型 '+ihdr.color);
  if(ihdr.color===3) throw new Error('这是调色板 PNG，请导出 RGBA（颜色类型 6）');
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const stride=ihdr.w*ch, bpp=ch;
  const out=Buffer.alloc(ihdr.h*stride);
  let p=0;
  for(let y=0;y<ihdr.h;y++){
    const ft=raw[p++];
    const line=raw.subarray(p,p+stride); p+=stride;
    const cur=out.subarray(y*stride,(y+1)*stride);
    const prev=y>0?out.subarray((y-1)*stride,y*stride):null;
    for(let x=0;x<stride;x++){
      const a=x>=bpp?cur[x-bpp]:0;
      const b=prev?prev[x]:0;
      const c=(prev&&x>=bpp)?prev[x-bpp]:0;
      let v=line[x];
      if(ft===1) v+=a;
      else if(ft===2) v+=b;
      else if(ft===3) v+=((a+b)>>1);
      else if(ft===4){
        const pa=Math.abs(b-c), pb=Math.abs(a-c), pc=Math.abs(a+b-2*c);
        v += (pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);
      }
      cur[x]=v&255;
    }
  }
  return { w:ihdr.w, h:ihdr.h, ch:ihdr.color, channels:ch, data:out };
}

/* ---------------- 分析 ---------------- */
const lum = (r,g,b) => 0.299*r + 0.587*g + 0.114*b;

function analyse(png){
  const { w,h,channels,data }=png;
  const hasAlpha = channels===4 || channels===2;
  const alphaAt = (x,y) => {
    if(x<0||y<0||x>=w||y>=h) return 0;
    const i=(y*w+x)*channels;
    return hasAlpha ? (channels===4?data[i+3]:data[i+1]) : 255;
  };
  const rgbAt = (x,y) => { const i=(y*w+x)*channels; return [data[i],data[i+1],data[i+2]]; };

  let minX=w, maxX=-1, minY=h, maxY=-1, opaque=0, semi=0, clear=0;
  let boundary=0, darkEdge=0;
  const colors=new Map();
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=(y*w+x)*channels;
    const a = hasAlpha ? (channels===4?data[i+3]:data[i+1]) : 255;
    if(a===0){ clear++; continue; }
    if(a<250) semi++;
    opaque++;
    if(maxX<0||x<minX) minX=x;
    if(x>maxX) maxX=x;
    if(minY===h||y<minY) minY=y;
    if(y>maxY) maxY=y;
    const key=((data[i]<<16)|(data[i+1]<<8)|data[i+2])>>>0;
    colors.set(key,(colors.get(key)||0)+1);

    /* 剪影边缘：自己透明邻居里至少有一个是空的 */
    const edge = !alphaAt(x-1,y)||!alphaAt(x+1,y)||!alphaAt(x,y-1)||!alphaAt(x,y+1);
    if(edge){
      boundary++;
      const [r,g,b]=rgbAt(x,y);
      let isDark = lum(r,g,b) < 110;
      if(!isDark){                       // 往里看一格，描边常常在轮廓内侧
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          if(!alphaAt(x+dx,y+dy)) continue;
          const [r2,g2,b2]=rgbAt(x+dx,y+dy);
          if(lum(r2,g2,b2)<110){ isDark=true; break; }
        }
      }
      if(isDark) darkEdge++;
    }
  }
  const top=[...colors.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([c,n])=>({hex:'#'+c.toString(16).padStart(6,'0'), n:n, pct:n/opaque}));
  return { w,h,hasAlpha,minX,maxX,minY,maxY,opaque,semi,clear,
           colors:colors.size, coverage: opaque/(w*h),
           boundary, darkEdge, outline: boundary?darkEdge/boundary:0, top };
}

function sketchBox(key){
  const polys=SKETCH[key];
  if(!polys) return null;
  let a=100,b=-1,c=100,d=-1;
  polys.forEach(p=>p.forEach(q=>{
    if(q[0]<a)a=q[0]; if(q[0]>b)b=q[0];
    if(q[1]<c)c=q[1]; if(q[1]>d)d=q[1];
  }));
  return { minX:a, maxX:b, minY:c, maxY:d };
}
/* 像素坐标 → 简笔画坐标（整张图映射到 0~100） */
const toUnit = (px,size) => px/size*100;

/* 调色规范：本项目定的是「少色平涂」，透明不计色。
   4~8 色为标准；极简物件 2~6 色；人物/多部件最多放宽到 8 色。 */
function colorVerdict(n){
  if(n<=8)  return '（符合 4~8 色平涂规范' + (n<4?'，属极简物件':'') + '）';
  if(n<=12) return '（略多，规范是 4~8 色；多部件场景可接受）';
  return '+（偏多，规范是 4~8 色，建议合并相近色）';
}
/* 描边覆盖率：简笔画是深色墨线，实物图如果轮廓也是深色，
   画完那一瞬线条就"变成"了实物的轮廓，过渡才自然。
   覆盖率太低 → 墨线被浅色实物盖住，会显得「线条凭空消失」。 */
function outlineVerdict(r){
  if(r>=0.60) return '　✅ 轮廓清晰，能接住简笔画的墨线';
  if(r>=0.35) return '　（轮廓尚可）';
  return '　⚠ 偏低：简笔画的墨线会被浅色实物盖掉，过渡会显得突兀';
}

/* ---------------- 主流程 ---------------- */
const argv=process.argv.slice(2);
const TOL = argv.includes('--tol') ? parseFloat(argv[argv.indexOf('--tol')+1]) : 4;
const detail = argv.includes('--png');

const keys = Object.keys(SPRITE).filter(k => {
  const s=SPRITE[k];
  if(!s || /^data:/.test(s)) return false;
  return fs.existsSync(path.isAbsolute(s)?s:path.join(ROOT,s));
});

if(!keys.length){ console.log('还没有登记任何真图（SPRITE 表为空或文件不存在）'); process.exit(0); }

console.log('实物像素图 · 对齐数值验收');
console.log('='.repeat(64));
console.log(`检查 ${keys.length} 个：${keys.join('  ')}`);
console.log(`容差 ±${TOL} 个单位（0~100 坐标系）；简笔画线宽约 3 个单位，所以实物略大 1~2 是正常的\n`);

let bad=0;
keys.forEach(k=>{
  const src=SPRITE[k];
  const p=path.isAbsolute(src)?src:path.join(ROOT,src);
  let png, a;
  try{ png=decodePNG(fs.readFileSync(p)); a=analyse(png); }
  catch(e){ console.log(`❌ ${k}：解码失败 —— ${e.message}`); bad++; return; }
  const sb=sketchBox(k);
  const S0=a.w;

  console.log(`【${k}】${src}`);
  console.log(`  图片      ${a.w}×${a.h}${a.w!==a.h?'  ⚠ 不是正方形':''}` +
              (a.hasAlpha?'　有透明通道':'　⚠ 没有透明通道'));
  if(detail){
    console.log(`  背景      ${a.clear} 个全透明像素（${(a.clear/(a.w*a.h)*100).toFixed(1)}%）` +
                (a.clear===0?'　⚠ 背景没有抠掉':''));
    console.log(`  颜色数    ${a.colors}${colorVerdict(a.colors)}`);
    console.log(`  描边覆盖  ${(a.outline*100).toFixed(0)}%（剪影边缘 ${a.boundary}px 里 ${a.darkEdge}px 是深色）` +
                outlineVerdict(a.outline));
    console.log(`  主色      ${a.top.slice(0,5).map(c=>c.hex+' '+(c.pct*100).toFixed(0)+'%').join('　')}`);
    console.log(`  内容占比  ${(a.coverage*100).toFixed(1)}%`);
  }
  if(!sb){ console.log('  ⚠ 找不到对应简笔画，无法比较\n'); return; }

  const imgBox={
    minX: toUnit(a.minX,S0), maxX: toUnit(a.maxX,S0),
    minY: toUnit(a.minY,S0), maxY: toUnit(a.maxY,S0)
  };
  const d={
    left: imgBox.minX-sb.minX, right: imgBox.maxX-sb.maxX,
    top:  imgBox.minY-sb.minY, bottom: imgBox.maxY-sb.maxY
  };
  const f=(v)=>(v>=0?'+':'')+v.toFixed(1);

  /* 更有诊断性的两个指标：
     ① 中心偏移 —— 实物图整体有没有挪位置（这是真正要修的）
     ② 尺寸比例 —— 实物比简笔画大多少（描边厚度会让它略大，属正常）
     只看边缘差会被描边厚度误导，所以判定用这两个。 */
  const scx=(sb.minX+sb.maxX)/2, scy=(sb.minY+sb.maxY)/2;
  const icx=(imgBox.minX+imgBox.maxX)/2, icy=(imgBox.minY+imgBox.maxY)/2;
  const offX=icx-scx, offY=icy-scy;
  const offDist=Math.hypot(offX,offY);
  const sw=sb.maxX-sb.minX, sh=sb.maxY-sb.minY;
  const iw=imgBox.maxX-imgBox.minX, ih=imgBox.maxY-imgBox.minY;
  const rw=iw/sw, rh=ih/sh;

  console.log(`  简笔画框  左${sb.minX.toFixed(0)}  上${sb.minY.toFixed(0)}  右${sb.maxX.toFixed(0)}  下${sb.maxY.toFixed(0)}　宽${sw.toFixed(0)}×高${sh.toFixed(0)}`);
  console.log(`  实物图框  左${imgBox.minX.toFixed(1)}  上${imgBox.minY.toFixed(1)}  右${imgBox.maxX.toFixed(1)}  下${imgBox.maxY.toFixed(1)}　宽${iw.toFixed(1)}×高${ih.toFixed(1)}`);
  console.log(`  中心偏移  ${f(offX)}, ${f(offY)}　（合位移 ${offDist.toFixed(1)} 个单位 ＝ ${(offDist*S0/100).toFixed(1)} 像素）`);
  console.log(`  尺寸比例  ${rw.toFixed(2)}× ${rh.toFixed(2)}×`);

  /* ★ 真正决定「淡入会不会穿帮」的是：实物有没有伸到简笔画**画过的墨线之外**。
     简笔画线宽约 3.1 个单位（游戏里 max(3,side/42) 换算过来），是以折线为中心画的，
     所以实际画到的范围 = 包围盒 ± 1.55。超出这个范围的部分，淡入时没有线托着，
     会看到实物「凭空多出来一块」。

     用逐边判断而不是比例：同样是 1.18×，宽 76 的图形多出来 7 个单位，
     宽 40 的图形只多 3.4 个单位，比例口径会把它们判成一样糟。 */
  const HALF_STROKE = 1.55;              /* 简笔画线宽的一半（0~100 单位） */
  const WARN = 1.56;                     /* 超出 1px（64px 下 1 单位 = 0.64px）：几乎看不见 */
  const FAIL = 2.34;                     /* 超出 1.5px：显示时约 5px，能看出「多出一块」 */
  const over = {
    左: (sb.minX - HALF_STROKE) - imgBox.minX,
    右: imgBox.maxX - (sb.maxX + HALF_STROKE),
    上: (sb.minY - HALF_STROKE) - imgBox.minY,
    下: imgBox.maxY - (sb.maxY + HALF_STROKE)
  };
  const named = Object.entries(over).filter(([, v]) => v > 0.5)
    .map(([k, v]) => k + v.toFixed(1));
  const worstOver = Math.max(0, ...Object.values(over));
  if (named.length) {
    const px = (worstOver * S0 / 100).toFixed(1);
    const tag = worstOver > FAIL ? '　❌ 实物伸到线条外面太多，淡入时会「凭空多出一块」'
              : worstOver > WARN ? '　⚠ 略微超出，显示时约 ' + Math.round(worstOver * S0 / 100 * 3.6) + 'px，勉强能看'
              : '　（1px 以内，属描边厚度，看不见）';
    console.log(`  超出墨线  ${named.join('　')}　（单位；最大 ${px}px）${tag}`);
  } else {
    console.log('  超出墨线  无（实物完全落在简笔画画过的范围内）✅');
  }

  const prob=[];
  if(offDist>TOL) prob.push(`整体偏移了 ${offDist.toFixed(1)} 个单位`);
  if(worstOver>FAIL) prob.push(`实物超出简笔画墨线 ${(worstOver*S0/100).toFixed(1)} 像素（上限 1.5px）`);
  if(rw<0.85||rh<0.85) prob.push(`实物比简笔画小太多（${rw.toFixed(2)}×${rh.toFixed(2)}×），线条会露在外面`);
  if(prob.length){
    bad++;
    console.log(`  ❌ ${prob.join('；')}`);
    if(offDist>TOL){
      const dir=[];
      if(offX<-TOL) dir.push('右');   // 实物偏左 → 往右挪
      if(offX> TOL) dir.push('左');
      if(offY<-TOL) dir.push('下');
      if(offY> TOL) dir.push('上');
      if(dir.length) console.log(`     把实物图整体往「${dir.join('/')}」挪约 ${Math.round(offDist*S0/100)} 像素`);
    }
  } else {
    console.log(`  ✅ 对齐良好（中心偏移 ${offDist.toFixed(1)}，尺寸 ${rw.toFixed(2)}×${rh.toFixed(2)}×）`);
  }
  console.log('');
});

console.log('='.repeat(64));
if(bad){ console.log(`❌ ${bad}/${keys.length} 个需要修一下`); process.exit(1); }
console.log(`✅ ${keys.length} 个全部对齐，可以照这个方向批量做`);
