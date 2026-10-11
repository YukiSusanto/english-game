#!/usr/bin/env node
/* Procedural sound bed for the Remotion opening. It deliberately leaves
 * narration to the game TTS layer, while preserving the designed silence,
 * page turns, pencil scrape, chime, and magic swell. */
'use strict';
const fs = require('fs');
const path = require('path');
const SR = 44100, SEC = 25, N = SR * SEC, CH = 2;
const data = new Float32Array(N);
let seed=0x51a7c0de;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;};
const at = s => Math.max(0, Math.min(N - 1, Math.floor(s * SR)));
function addTone(t, dur, freq, amp, type='sine') {
  const a=at(t), b=Math.min(N,at(t+dur));
  for(let i=a;i<b;i++){
    const q=(i-a)/(b-a), env=Math.sin(Math.PI*Math.min(1,q))*Math.min(1,(1-q)*5+0.08);
    const ph=2*Math.PI*freq*(i-a)/SR;
    data[i]+=amp*env*(type==='square'?(Math.sin(ph)>=0?1:-1):Math.sin(ph));
  }
}
function addNoise(t,dur,amp,band=1){
  const a=at(t),b=Math.min(N,at(t+dur)); let last=0;
  for(let i=a;i<b;i++){ const q=(i-a)/(b-a), n=(rand()*2-1); last=last*.94+n*.06; data[i]+=amp*(last*band+n*(1-band))*Math.sin(Math.PI*Math.min(1,q))*Math.min(1,(1-q)*5+.08); }
}
// Quiet after-school air in shot 1, with the environment pulled down before the book.
addNoise(0,2.8,.018,.85); addTone(0.3,.7,196,.008); addTone(1.35,.6,247,.007);
// Shot 2: three steps, bag thud, chair scrape.
[3.05,3.35,3.65].forEach(t=>addTone(t,.09,92,.12,'square')); addNoise(4.18,.22,.18,.2); addTone(4.2,.22,58,.16); addNoise(4.55,.35,.06,.2);
// Shot 3: sparse music-box notes and the single high chime.
addTone(5.95,.6,523,.045); addTone(7.35,.65,659,.04); addTone(7.82,1.1,1318,.08);
// Shot 4: page turns only; the bed disappears completely.
[8.35,9.0,9.55,10.15].forEach(t=>{addNoise(t,.18,.14,.15);addTone(t,.16,240,.025)}); addNoise(10.85,.12,.08,.25);
// Shot 5: one short bell, no musical bed.
addTone(12.15,.8,1047,.09); addTone(12.15,.8,1568,.035);
// Shot 6: intentional 0.6 s silence, then a low held tension.
addTone(13.65,2.9,82,.026); addTone(14.05,1.8,123,.018);
// Shot 7: pencil friction and upward glissando.
addNoise(15.05,1.05,.1,.12); for(let j=0;j<12;j++) addTone(15.25+j*.11,.16,180+j*35,.009);
// Shot 8: graphite scrape, silence, then electronic line rising.
addNoise(17.05,.82,.13,.08); addTone(18.2,.22,240,.025); for(let j=0;j<10;j++) addTone(18.35+j*.1,.17,300+j*70,.012);
// Shot 9: the only full acceleration / magic swell.
for(let j=0;j<24;j++) addTone(19.5+j*.11,.28,260+j*32,.014); addTone(20.25,2.0,1568,.06); addTone(21.0,1.4,2093,.055);
// Shot 10: shimmer decays toward the handoff to B1.
for(let j=0;j<16;j++) addTone(22.55+j*.12,.32,1200+j*45,.025*(1-j/18)); addNoise(23.2,1.7,.018,.5);
function pcm16(v){ return Math.max(-32768,Math.min(32767,Math.round(v*32767))); }
const bytes=Buffer.alloc(N*CH*2);
for(let i=0;i<N;i++){ const v=Math.tanh(data[i]*1.2); bytes.writeInt16LE(pcm16(v),i*4); bytes.writeInt16LE(pcm16(v),i*4+2); }
const h=Buffer.alloc(44); h.write('RIFF',0); h.writeUInt32LE(36+bytes.length,4); h.write('WAVE',8); h.write('fmt ',12); h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(CH,22); h.writeUInt32LE(SR,24); h.writeUInt32LE(SR*CH*2,28); h.writeUInt16LE(CH*2,32); h.writeUInt16LE(16,34); h.write('data',36); h.writeUInt32LE(bytes.length,40);
const out=path.resolve(__dirname,'..','remotion','public','opening-audio.wav'); fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,Buffer.concat([h,bytes])); console.log(`✅ ${out} ${(fs.statSync(out).size/1024/1024).toFixed(2)} MB · 25 秒 · 44.1kHz stereo`);
