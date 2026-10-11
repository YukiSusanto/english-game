#!/usr/bin/env node
/*
 * B/C 剧情序列帧生成器
 *
 * 采用 SVG → sharp PNG 的可重复流程，输出 256×256 RGBA 帧。画面用少色
 * 平涂和现有 64×64 NPC 像素立绘组成，便于在游戏的正方形剧情舞台中播放。
 * 每段 36 帧，播放器按 12fps 播放约 3 秒；最后一帧停在可交互画面。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'story');
const W = 256, H = 256, FPS = 12, FRAMES = 36;
const ink = '#21182b', paper = '#f7f1e6', night = '#1b2140', blue = '#5a95cc';
const colors = { red:'#d9534f', redL:'#f08a80', green:'#7fb37f', greenD:'#4a7c50',
  yellow:'#e6bd62', gold:'#f7dfa4', purple:'#8875ab', teal:'#4b9fa5',
  metal:'#8d9aa5', metalL:'#c3ced6', glass:'#9fd6e6', wood:'#a9743c',
  skin:'#f0c9a0', skinD:'#d9a87a', white:'#eef2f5', dark:'#3f3a4d' };

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => n*n*(3-2*n);
const lerp = (a,b,t) => a + (b-a)*t;
function rect(x,y,w,h,fill,rx=0, extra=''){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`; }
function line(x1,y1,x2,y2,stroke=ink,w=3,extra=''){ return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`; }
function poly(points,fill,stroke=ink,w=3){ return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`; }
function circle(cx,cy,r,fill,stroke=ink,w=3){ return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`; }
function text(x,y,s,size=14,fill=ink,anchor='middle',weight='700'){ return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`; }
function fade(v, min=.16){ return min + (1-min)*clamp(v); }
function sprite(name,x,y,w=64,h=64,opacity=1,flip=false){
  const file = path.join(ROOT,'assets','sprites',name+'.png');
  if(!fs.existsSync(file)) return '';
  const data = fs.readFileSync(file).toString('base64');
  const tr = flip ? ` transform="translate(${x+w} ${y}) scale(-1 1)"` : ` x="${x}" y="${y}"`;
  return `<image href="data:image/png;base64,${data}" width="${w}" height="${h}" opacity="${opacity}" image-rendering="pixelated"${tr}/>`;
}
function shell(body, t, label){
  const glow = .12 + .10*Math.sin(t*Math.PI*2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="256" height="256" fill="${night}" opacity=".96"/>
    <rect x="10" y="10" width="236" height="236" rx="14" fill="none" stroke="#6b789d" stroke-width="2" opacity=".55"/>
    <circle cx="218" cy="32" r="12" fill="#f7dfa4" opacity="${glow}"/>
    ${body}
  </svg>`;
}
function classroom(t, fill=.25){
  let s = rect(28,38,200,152,'#27345c',6)+rect(44,54,168,76,'#374879',3)+rect(58,65,140,50,'#b7cee0',2);
  s += line(128,55,128,114,'#8094b4',2)+rect(88,164,80,24,colors.wood,3)+rect(96,188,12,30,colors.wood,2)+rect(148,188,12,30,colors.wood,2);
  s += rect(70,146,34,24,colors.redL,3)+rect(152,146,34,24,colors.blue,3);
  if(fill>.1) s += rect(78,72,100,32,'#263452',2)+text(128,94,'CLASSROOM',12,paper);
  return s;
}
function blackboard(t){ return rect(43,53,170,70,'#263452',4)+rect(49,59,158,58,'#33456b',2)+text(128,92,'The classroom is clean.',11,paper); }
function book(cx=128,cy=132,open=false,glow=0){
  let s = `<g opacity="${fade(glow,.55)}">${circle(cx,cy,48,'#f7dfa4','#e6bd62',2)}</g>`;
  if(open) s += poly([[cx-48,cy-25],[cx-4,cy-16],[cx-4,cy+30],[cx-48,cy+22]],paper)+poly([[cx+4,cy-16],[cx+48,cy-25],[cx+48,cy+22],[cx+4,cy+30]],paper)+line(cx,cy-16,cx,cy+30,colors.red,2);
  else s += poly([[cx-42,cy-27],[cx+42,cy-27],[cx+48,cy+27],[cx-48,cy+27]],paper)+rect(cx-35,cy-20,70,6,colors.purple,2);
  return s;
}
function mirrorScene(t,face=false){
  let s=rect(57,36,142,134,colors.metalD||'#5b6670',8)+rect(67,46,122,114,colors.glass,5)+line(108,174,148,174,colors.metal,6)+rect(92,178,72,16,colors.metalD||'#5b6670',3);
  s += circle(128,92,26,colors.glass,ink,3)+poly([[97,120],[159,120],[171,157],[128,174],[85,157]],colors.metal,ink,3);
  if(face){ s += circle(118,89,3,ink,ink,1)+circle(138,89,3,ink,ink,1)+line(119,105,137,105,colors.red,2); }
  s += line(77,67,77,112,paper,3)+line(82,60,96,60,paper,2); return s;
}
function bagScene(t,full=false){
  let x=lerp(100,72,ease(t)), y=lerp(105,92,ease(t));
  let s=sprite('dragon',x,y,96,96,1);
  if(full){ s+=sprite('book',30,45,40,40)+sprite('eraser',190,52,36,36)+sprite('pencil',26,169,36,36)+sprite('notebook',196,160,42,42); }
  return s;
}
function houseScene(t,flipped=true){
  const cy=flipped?lerp(132,110,ease(t)):132;
  let s=poly([[56,cy+32],[56,cy-22],[128,cy-78],[200,cy-22],[200,cy+32]],colors.redL,ink,4)+rect(83,cy-6,90,38,colors.yellow,2)+rect(114,cy+7,28,25,colors.wood,2);
  s+=rect(93,cy-52,36,24,colors.blue,2)+rect(144,cy-52,30,24,colors.green,2);
  if(flipped) s+=line(74,cy+44,182,cy+44,colors.metalL,3); return s;
}
function potScene(t,calm=false){
  let s=line(107,77,99,51,paper,4)+line(128,73,128,45,paper,4)+line(149,77,157,51,paper,4);
  s+=rect(58,111,22,22,colors.metalD,4)+rect(176,111,22,22,colors.metalD,4)+rect(74,91,108,24,colors.redL,7)+rect(113,79,30,15,colors.metalD,4);
  s+=poly([[72,108],[184,108],[177,180],[79,180]],calm?colors.redL:colors.red,ink,4)+rect(85,140,86,8,calm?colors.redL:colors.redD,3);
  if(!calm) for(let i=0;i<4;i++) s+=circle(92+i*24,158,4,colors.yellow,ink,1);
  return s;
}
function album(t,open=true){
  let s=poly([[38,63],[119,45],[128,181],[45,198]],colors.purple,ink,4)+poly([[128,181],[211,198],[218,63],[137,45]],colors.purple,ink,4)+line(128,48,128,181,ink,3);
  if(open) for(let i=0;i<3;i++){ const y=82+i*34; s+=circle(76,y,14,colors.skinD,ink,2)+circle(180,y,14,colors.skinD,ink,2); }
  return s;
}
function tableMeal(t){
  let s=rect(38,143,180,18,colors.wood,3)+rect(55,161,12,45,colors.wood,2)+rect(189,161,12,45,colors.wood,2);
  const foods=[['rice',56],['fish',91],['beef',128],['soup',165],['bread',201]];
  foods.forEach(([n,x],i)=>s+=sprite(n,x-15,112,30,30,clamp((t*foods.length-i)*2))); return s;
}
function frameFor(sec,t){
  let b='';
  switch(sec){
    case 'ch1_open': b=classroom(t,.05+t*.8)+rect(118,140,20,30,paper,2,`opacity="${t<.3?0:t}"`)+sprite('chalk',88,148,52,52,clamp((t-.35)*3)); break;
    case 'ch1_mid': b=classroom(t,.35)+sprite('chalk',82,137,58,58)+line(140,170,177,153,colors.yellow,4)+circle(178,152,4,colors.yellow); break;
    case 'ch1_end': b=classroom(t,.55)+blackboard(t)+sprite('chalk',184,150,48,48,clamp(t*2)); break;
    case 'ch2_open': b=bagScene(t,t>.42); break;
    case 'ch2_mid': b=bagScene(t,true)+sprite('eraser',167,143,42,42,.75); break;
    case 'ch2_end': b=bagScene(t,true)+sprite('book',42,55,38,38)+sprite('notebook',178,160,42,42); break;
    case 'ch3_open': b=mirrorScene(t,false); if(t>.55)b+=sprite('mirror',177,157,50,50); break;
    case 'ch3_mid': b=mirrorScene(t,false)+sprite('mirror',178,157,50,50)+text(128,214,'SAY IT LOUD',13,colors.gold); break;
    case 'ch3_end': b=mirrorScene(t,true)+sprite('mirror',177,157,50,50,.8); break;
    case 'ch4_open': b=houseScene(t,true)+sprite('tree',182,145,54,54); break;
    case 'ch4_mid': b=houseScene(t,true)+sprite('tree',182,145,54,54)+text(128,218,'A PLACE NAME',12,colors.gold); break;
    case 'ch4_end': b=houseScene(t,false)+sprite('tree',182,145,54,54)+sprite('bed',70,91,48,38,.8); break;
    case 'ch5_open': b=potScene(t,false)+sprite('pot',186,160,52,52); break;
    case 'ch5_mid': b=potScene(t,false)+sprite('pot',186,160,52,52)+text(128,218,'SAY IT QUICKLY',12,colors.gold); break;
    case 'ch5_end': b=potScene(t,true)+tableMeal(t)+sprite('pot',185,159,52,52,.7); break;
    case 'ch6_open': b=album(t,true)+sprite('dog',186,165,52,52,.95); if(t>.65)b+=circle(128,125,70,paper,'none',0); break;
    case 'ch6_mid': b=album(t,true)+sprite('dog',186,165,52,52)+sprite('eraser',108,92,42,42,.55)+text(128,218,'A FORGOTTEN ERASER',11,colors.gold); break;
    case 'ending': {
      b=album(t,false);
      const ew=Math.round(lerp(118,34,ease(t))), ey=Math.round(lerp(58,121,ease(t)));
      b+=sprite('eraser',128-ew/2,ey,ew,ew,1);
      b+=sprite('chalk',18,178,34,34)+sprite('dragon',54,170,38,38)+sprite('mirror',94,172,38,38)+sprite('tree',136,173,38,38)+sprite('pot',178,174,38,38)+sprite('dog',216,175,34,34);
      if(t>.72) b+=text(128,42,'THE MAGIC BOOK',17,colors.gold);
      break;
    }
    default: b=text(128,128,sec,18,paper);
  }
  return shell(b,t,sec.replace('_',' '));
}

const SECTIONS = ['ch1_open','ch1_mid','ch1_end','ch2_open','ch2_mid','ch2_end','ch3_open','ch3_mid','ch3_end','ch4_open','ch4_mid','ch4_end','ch5_open','ch5_mid','ch5_end','ch6_open','ch6_mid','ending'];
async function main(){
  fs.mkdirSync(OUT,{recursive:true});
  const manifest={fps:FPS,width:W,height:H,frames:FRAMES,sections:{}};
  for(const sec of SECTIONS){
    const dir=path.join(OUT,sec); fs.mkdirSync(dir,{recursive:true});
    manifest.sections[sec]={frames:FRAMES,dir:`assets/story/${sec}`};
    for(let i=0;i<FRAMES;i++){
      const t=i/(FRAMES-1), file=path.join(dir,`f${String(i+1).padStart(4,'0')}.png`);
      await sharp(Buffer.from(frameFor(sec,t))).png().toFile(file);
    }
    console.log(`✅ ${sec.padEnd(10)} ${FRAMES} 帧`);
  }
  fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(`完成 ${SECTIONS.length} 段 / ${SECTIONS.length*FRAMES} 帧`);
}
main().catch(e=>{console.error(e.stack||e);process.exit(1);});
