/* Generate deterministic painted-style SVG keyframes for the Remotion opening.
 * These are production placeholders with the final composition, palette and props
 * locked to 开场影片_写实设定与生成说明.md. They can be replaced by AI PNGs later
 * without changing the Remotion timeline.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'remotion', 'public', 'keyframes');
fs.mkdirSync(OUT, {recursive: true});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const defs = `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#202a43"/><stop offset=".56" stop-color="#6d5360"/><stop offset="1" stop-color="#e8934f"/></linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#d8b38e"/><stop offset=".5" stop-color="#ead0ad"/><stop offset="1" stop-color="#9c8490"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#897b77"/><stop offset="1" stop-color="#493e4c"/></linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c59051"/><stop offset=".5" stop-color="#9a693e"/><stop offset="1" stop-color="#68442f"/></linearGradient>
    <linearGradient id="woodLight" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d3a060"/><stop offset="1" stop-color="#8c6239"/></linearGradient>
    <linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3d4d70"/><stop offset=".5" stop-color="#2b3a5c"/><stop offset="1" stop-color="#1b253e"/></linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaf0"/><stop offset=".5" stop-color="#f7f1e6"/><stop offset="1" stop-color="#e9ddce"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4d1a9"/><stop offset="1" stop-color="#d9a87a"/></linearGradient>
    <linearGradient id="pencil" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f1d39a"/><stop offset="1" stop-color="#c28e55"/></linearGradient>
    <radialGradient id="cyan" cx="50%" cy="50%"><stop stop-color="#dff7ff" stop-opacity=".72"/><stop offset="1" stop-color="#dff7ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="gold" cx="50%" cy="50%"><stop stop-color="#fff3c4" stop-opacity=".8"/><stop offset=".35" stop-color="#f5c542" stop-opacity=".42"/><stop offset="1" stop-color="#f5c542" stop-opacity="0"/></radialGradient>
    <filter id="paper" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" values=".45 0 0 0 0 .35 0 0 0 0 .25 0 0 0 0 0 0 0 .11 0" result="grain"/><feBlend in="SourceGraphic" in2="grain" mode="multiply"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="12" result="b"/><feOffset dy="14" result="o"/><feComponentTransfer><feFuncA type="linear" slope=".4"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="grainPattern" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M2 4l1 1m7 5l1-1m4 6l1 1M5 14l1-1" stroke="#604e4b" stroke-opacity=".14" stroke-width="1"/></pattern>
  </defs>`;
const svg = (body, bg = '#1f2435') => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="${bg}"/>${defs}${body}</svg>`;
const write = (name, body, bg) => fs.writeFileSync(path.join(OUT, name), svg(body, bg), 'utf8');

function windows() {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 150;
    s += `<rect x="${x}" y="76" width="120" height="332" rx="3" fill="#252a3a" stroke="#c1a28e" stroke-width="8"/><rect x="${x + 9}" y="86" width="102" height="312" fill="url(#sky)"/><path d="M${x + 60} 86v312M${x + 9} 244h102" stroke="#c7b19b" stroke-width="5" opacity=".72"/><path d="M${x + 9} 320h102l-102 78z" fill="#f0a45f" opacity=".35"/>`;
  }
  return s;
}
function desks() {
  return `<g opacity=".96">
    <g transform="translate(500 245)"><path d="M0 0h445l55 28H48z" fill="url(#woodLight)"/><path d="M42 28h405l-10 135H28z" fill="url(#wood)"/><path d="M55 163l-18 220M420 163l20 220" stroke="#463335" stroke-width="15"/><path d="M34 382h36m330 0h42" stroke="#2e2b35" stroke-width="18" stroke-linecap="round"/><path d="M72 60q130 25 286-3m-270 35q120 24 300-4m-255 48q110 20 215-1" fill="none" stroke="#5c3d30" stroke-opacity=".38" stroke-width="7"/></g>
    <g transform="translate(410 360) scale(.82)"><path d="M0 0h445l55 28H48z" fill="url(#woodLight)"/><path d="M42 28h405l-10 135H28z" fill="url(#wood)"/><path d="M55 163l-18 220M420 163l20 220" stroke="#463335" stroke-width="15"/><path d="M34 382h36m330 0h42" stroke="#2e2b35" stroke-width="18" stroke-linecap="round"/></g>
    <g transform="translate(330 470) scale(.66)"><path d="M0 0h445l55 28H48z" fill="url(#woodLight)"/><path d="M42 28h405l-10 135H28z" fill="url(#wood)"/><path d="M55 163l-18 220M420 163l20 220" stroke="#463335" stroke-width="15"/><path d="M34 382h36m330 0h42" stroke="#2e2b35" stroke-width="18" stroke-linecap="round"/></g>
  </g>`;
}
function classroom(withBoy = false, seated = false) {
  let boy = '';
  if (withBoy && seated) {
    boy = `<g transform="translate(790 240)"><path d="M40 140q-20 50 12 111l40 3 18-105z" fill="#3a4050"/><path d="M54 244l-12 110h28l24-101m4-1 16 102h27l-25-110" fill="#353a4a"/><path d="M52 344h26l-8 11H42zm50 0h27l9 11h-38z" fill="#e4e2dc"/><path d="M31 90q-6-55 65-61 49 8 57 61l-12 72-100-3z" fill="#2b3a5c"/><path d="M49 102h84l-11 28H58z" fill="#f2f0ea"/><path d="M85 25q12 3 28 19l9 51-89 4 2-41Q42 28 85 25z" fill="#1c1a22"/><path d="M62 79q21 8 44 0" stroke="#11101a" stroke-width="5" fill="none"/><path d="M153 105q40 24 54 76l-25 8-46-44z" fill="#f0c9a0"/><path d="M182 177l95 3 10 55H162z" fill="#8c3a3a"/><path d="M188 180l80 3" stroke="#e6b3b0" stroke-width="6"/></g>`;
  } else if (withBoy) {
    boy = `<g transform="translate(905 230)"><path d="M55 135l-6 196h80l-7-198z" fill="#3a4050"/><path d="M56 330l-12 43h31l20-43m30 0 18 43h30l-28-44" fill="#e4e2dc"/><path d="M32 70q15-45 71-47 51 10 67 61l-15 77-111-4z" fill="#2b3a5c"/><path d="M50 86h94l-11 27H61z" fill="#f2f0ea"/><path d="M64 16q28-23 63 5l14 64H48z" fill="#1c1a22"/><path d="M45 165l-58 52-19-19 70-79z" fill="#2b3a5c"/><path d="M-16 200l45 30" stroke="#f0c9a0" stroke-width="20" stroke-linecap="round"/><path d="M55 323h28l-5 22H45zm68 0h28l14 22h-40z" fill="#e4e2dc"/><path d="M-39 216l45 15 74 44-33 38-77-46z" fill="#8c3a3a"/></g>`;
  }
  return `<rect width="1280" height="430" fill="url(#wall)"/><rect y="430" width="1280" height="290" fill="url(#floor)"/><path d="M0 560H1280" stroke="#c2a79a" stroke-opacity=".25" stroke-width="3"/>${windows()}<path d="M0 104h110v116H0z" fill="#282b3b"/><path d="M16 150q38-16 76 0m-75 22q30-12 64 0" stroke="#d4c8b4" stroke-opacity=".5" stroke-width="5" fill="none"/><path d="M1050 35v35m-110-33v34m225-28v27" stroke="#d7c4a8" stroke-width="8"/><path d="M1110 70q-18 88 0 120m0-120q18 88 0 120" stroke="#475063" stroke-width="4" fill="none"/><ellipse cx="1110" cy="76" rx="58" ry="10" fill="#3b4052" opacity=".7"/>${desks()}<path d="M0 390L720 640 640 720H0z" fill="#ffb26b" opacity=".11"/><path d="M120 400L890 680 820 720H240z" fill="#ffb26b" opacity=".1"/>${boy}<rect width="1280" height="720" fill="url(#grainPattern)" opacity=".45"/>`;
}

function deskBase() {
  return `<rect width="1280" height="720" fill="#493342"/><path d="M-40 120L1320 45v710H-40z" fill="url(#wood)"/><path d="M-40 220L1320 150M-40 360L1320 290M-40 500L1320 430M-40 630L1320 560" stroke="#5c3d30" stroke-opacity=".42" stroke-width="8"/><path d="M80 260q140-40 270 0m-110 110q150-35 305 5m280-190q160-30 310 10m-80 150q140-32 260 5" stroke="#e0ad6e" stroke-opacity=".2" stroke-width="7" fill="none"/>`;
}
function ordinaryBooks() {
  return `<g filter="url(#shadow)"><path d="M135 420l240-21 22 125-241 19z" fill="#58667b"/><path d="M168 435l208-18" stroke="#b5beca" stroke-opacity=".55" stroke-width="5"/><path d="M855 405l230 25-15 110-239-22z" fill="#6d786e"/><path d="M872 430l184 20" stroke="#c5cfb6" stroke-opacity=".5" stroke-width="5"/><path d="M510 442l260-12 18 120-260 12z" fill="#43536d"/><path d="M534 461l207-8" stroke="#a6b0bd" stroke-opacity=".48" stroke-width="5"/></g>`;
}
function magicBook(x=470,y=270,open=false,glow=false) {
  if (open) return `<g filter="url(#shadow)"><path d="M640 210q-98 20-215 0v280q112 18 215-8z" fill="url(#page)" stroke="#d6cbbd" stroke-width="4"/><path d="M640 210q100 20 215 0v280q-116 18-215-8z" fill="url(#page)" stroke="#d6cbbd" stroke-width="4"/><path d="M640 216v263" stroke="#8a6f66" stroke-opacity=".35" stroke-width="6"/><path d="M470 330q82-28 150-4m-150 35q82-25 148-2m-148 38q74-23 146-1m175-60q78-23 145 2m-145 36q75-21 144 2" stroke="#9b837d" stroke-opacity=".12" stroke-width="8" fill="none"/><path d="M525 387q105-90 252-20" stroke="#7d625f" stroke-opacity=".13" stroke-width="6" fill="none"/></g>`;
  return `<g filter="url(#shadow)">${glow ? `<ellipse cx="${x+120}" cy="${y+95}" rx="210" ry="135" fill="url(#cyan)" opacity=".42"/>` : ''}<path d="M${x} ${y+18}l232-15 20 183-238 18z" fill="url(#navy)" stroke="#17223b" stroke-width="7"/><path d="M${x+22} ${y+35}l193-11" stroke="#bd9a62" stroke-opacity=".34" stroke-width="3"/><path d="M${x+10} ${y+173}l225-15" stroke="#e6d5bd" stroke-opacity=".34" stroke-width="4"/><path d="M${x+26} ${y+25}l-21 19m222-25 17 25m-215 137-20 12m210-24 17 20" stroke="#e5d9c8" stroke-opacity=".35" stroke-width="9" stroke-linecap="round"/></g>`;
}
function hand(x, y, rotate=0, pinch=false) {
  return `<g transform="translate(${x} ${y}) rotate(${rotate})"><path d="M0 70q10-58 50-65 24-5 39 11l12 28q8 22-5 40L75 111q-35 18-64-2Q-3 98 0 70z" fill="url(#skin)" stroke="#9e6e5f" stroke-width="3"/><path d="M52 7q-2-40 12-42 13-2 13 40m12 3q4-35 16-31 13 4 5 40m-79-2Q18-17 30-17q12 0 16 39" fill="none" stroke="#d9a87a" stroke-width="14" stroke-linecap="round"/>${pinch ? `<path d="M78 33q48-29 73 4m-73 11q45-27 69 4" stroke="#f0c9a0" stroke-width="13" stroke-linecap="round" fill="none"/>` : ''}</g>`;
}
function pencil(x,y,rot=0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#shadow)"><path d="M0 20l33-13 205 0 30 13-30 13H33z" fill="url(#pencil)" stroke="#9f774b" stroke-width="3"/><path d="M0 20l-31 0 31-13z" fill="#5a5560"/><path d="M268 7h20v26h-20z" fill="#b8bcc4"/><path d="M288 7q30 13 0 26l-13-4V11z" fill="#e88b95"/><path d="M75 9v23m44-23v23m43-23v23" stroke="#b88952" stroke-opacity=".55" stroke-width="4"/></g>`;
}
function pageBase() {
  return `<rect width="1280" height="720" fill="#3d3040"/><rect x="70" y="42" width="1140" height="642" rx="12" fill="url(#page)" stroke="#cdbfac" stroke-width="7" filter="url(#paper)"/><path d="M110 130q280-50 550-8m-560 72q280-45 570-6m-550 78q260-45 530-3m-560 78q300-43 570-4m-545 82q280-42 550 0m-560 78q270-40 550 0" stroke="#9b837d" stroke-opacity=".1" stroke-width="9" fill="none"/><path d="M250 240q290-40 650 8m-670 160q350-45 690 0" stroke="#7d625f" stroke-opacity=".09" stroke-width="8" fill="none"/>`;
}
function arc() { return `<path d="M375 475 Q560 255 815 395" fill="none" stroke="#21182b" stroke-width="18" stroke-linecap="round"/>`; }
function star(cx=640,cy=290,scale=1,fill='#1a1620',opacity=1) {
  const pts = [];
  for (let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5;const r=(i%2?100:220)*scale;pts.push(`${cx+Math.cos(a)*r},${cy+Math.sin(a)*r}`)}
  return `<polygon points="${pts.join(' ')}" fill="${fill}" opacity="${opacity}" stroke="#fff3c4" stroke-opacity=".72" stroke-width="8" stroke-linejoin="round"/>`;
}

write('k01.svg', classroom(false), '#1f2435');
write('k02a.svg', classroom(true, false), '#1f2435');
write('k02b.svg', classroom(true, true), '#1f2435');
write('k03.svg', `${deskBase()}${ordinaryBooks()}${magicBook(500,220,false,true)}${hand(250,185,-12,false)}<ellipse cx="620" cy="470" rx="120" ry="18" fill="#1e1a27" opacity=".28"/>`, '#493342');
write('k04a.svg', `${deskBase()}${magicBook(0,0,true,false)}${hand(900,330,5,false)}`, '#493342');
write('k04b.svg', `${deskBase()}${magicBook(0,0,true,false)}<path d="M645 210q180-100 265 8l-30 126q-118-64-233-12z" fill="#fffaf0" stroke="#d6cbbd" stroke-width="5" opacity=".9"/>${hand(820,220,-18,false)}`, '#493342');
write('k05.svg', `<rect width="1280" height="720" fill="url(#sky)"/><path d="M320 0l350 720H980L690 0z" fill="#ffb26b" opacity=".24"/><g transform="translate(330 175) rotate(-8)"><path d="M100 50q180-25 360 0v280q-180 25-360 0z" fill="url(#page)" stroke="#d6cbbd" stroke-width="8"/><path d="M100 50q180 50 360 0m-360 280q180-50 360 0" stroke="#b29178" stroke-opacity=".4" stroke-width="5"/></g>${hand(475,420,-11,false)}<path d="M430 545h415" stroke="#ffb26b" stroke-opacity=".55" stroke-width="15" filter="url(#soft)"/>`, '#20283f');
write('k06.svg', `<rect width="1280" height="720" fill="#29283b"/><rect x="250" y="-40" width="780" height="800" rx="80" fill="url(#navy)"/><path d="M345 0v720m110-720v720m137-720v720m142-720v720m152-720v720" stroke="#182039" stroke-width="19" stroke-opacity=".6"/><path d="M290 170q160-45 310 0m-170 155q200-50 460 0m-420 170q190-45 470 10m-530 130q280-45 600 4" stroke="#f0d3b4" stroke-opacity=".22" stroke-width="10" fill="none"/><path d="M350 125q65-55 114 0m335 470q46-47 92 0" stroke="#e7d8c6" stroke-opacity=".42" stroke-width="16" stroke-linecap="round"/>${hand(650,420,-8,true)}<rect width="1280" height="720" fill="#dff7ff" opacity=".04"/>`, '#29283b');
write('k07.svg', `${deskBase()}${magicBook(420,250,false,false)}${pencil(565,260,-10)}${hand(420,255,-12,true)}<path d="M440 240L840 130" stroke="#ffb26b" stroke-opacity=".18" stroke-width="35" filter="url(#soft)"/>`, '#493342');
write('k08a.svg', `${pageBase()}${pencil(570,70,-5)}${hand(770,-45,5,true)}`, '#3d3040');
write('k08b.svg', `${pageBase()}${arc()}${pencil(730,255,18)}${hand(830,110,15,true)}`, '#3d3040');
write('k09.svg', `${pageBase()}<ellipse cx="640" cy="300" rx="290" ry="220" fill="url(#gold)" opacity=".65"/>${star(640,300,1,'#f5c542',1)}<path d="M510 525q125-24 258 0" stroke="#f5c542" stroke-opacity=".35" stroke-width="16" filter="url(#soft)"/>`, '#3d3040');
write('k10.svg', `${pageBase()}${arc()}<path d="M375 475 Q560 255 815 395" fill="none" stroke="#f5c542" stroke-opacity=".58" stroke-width="30" filter="url(#soft)"/>${hand(935,530,8,false)}<g transform="translate(1090 580) scale(.34)" opacity=".52" filter="url(#soft)"><path d="M0 120q14-135 118-145 104 10 118 145v95H0z" fill="#f0c9a0"/><path d="M0 88Q30-42 122-32q98 10 114 120L216 57q-72 30-173 0z" fill="#1c1a22"/><path d="M75 120q38 17 79 0" stroke="#9d6d60" stroke-width="7" fill="none"/></g><g fill="#f5c542" opacity=".8"><circle cx="550" cy="180" r="8"/><circle cx="770" cy="185" r="6"/><circle cx="915" cy="290" r="10"/><circle cx="360" cy="220" r="7"/></g>`, '#3d3040');

console.log(`Generated ${13} opening SVG keyframes in ${OUT}`);
