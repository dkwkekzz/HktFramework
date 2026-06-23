// step_0040/capture.js — 눈 검증(engine 직접 PNG): SW5 SPH 밀도 추정 — 구체 떼의 국소 밀도를 색으로.
//
//   design/sphere-world.md §6 SW5 — 유체를 구체(SPH 입자)로. 이 단위 = 밀도 추정 ρ_i=Σ_j m_j·W(r,h).
//   3 프레임: 흩어진 구름 → 약한 중력으로 수축(0028 재사용) → 중심이 모이며 *SPH 밀도가 오른다*(중심 밝게).
//   밀도는 *수동 측정*(힘 없음) — 중력이 위치를 모으면 sphDensity 가 그 모임을 밀도로 *읽어낸다*.
//
//   실행: node HTJ/steps/step_0040/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=40, CEN=(N-1)/2, FOURPI_3=4*Math.PI/3, eqR=(n)=>Math.cbrt(n/FOURPI_3);
// 구름: 중심 둘레로 흩뿌린 작은 구체 떼(약한 무작위 — 결정론 시드).
let seed=12345; function rnd(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}
const m=1, cells=6, parts=[];
for(let i=0;i<80;i++){
  const r=4+rnd()*7, th=rnd()*2*Math.PI, ph=Math.acos(2*rnd()-1);
  parts.push({cx:CEN+r*Math.sin(ph)*Math.cos(th), cy:CEN+r*Math.sin(ph)*Math.sin(th), cz:CEN+r*Math.cos(ph),
    mass:m, px:0, py:0, pz:0, Lx:0, Ly:0, Lz:0, KEcm:0, internalKE:0, internalE:cells*0.3, energy:cells*0.3,
    cells, radius:eqR(cells), temp:0, peak:1});
}
const h=3.0, gopt={G:0.5, soft:2.5}, dt=0.4;
function measure(){SPH.sphDensity(parts,{h}); return parts.map(p=>({cx:p.cx,cy:p.cy,d:p.density}));}
function evolve(steps){for(let s=0;s<steps;s++){En.applyEntityGravity(parts,dt,gopt); En.stepEntities(parts,dt,{N});}}

const frames=[], maxD=[];
const f0=measure(); frames.push(f0); maxD.push(Math.max(...f0.map(p=>p.d)));     // 흩어짐
evolve(12); const f1=measure(); frames.push(f1); maxD.push(Math.max(...f1.map(p=>p.d)));   // 수축 중
evolve(12); const f2=measure(); frames.push(f2); maxD.push(Math.max(...f2.map(p=>p.d)));   // 코어 밀집

const cellPx=8, panel=N*cellPx, gap=20, pad=20, lab=20;
const Wd=pad*2+panel*3+gap*2, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=10;out[i+1]=12;out[i+2]=18;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
// 밀도 → heat 색(낮음 어두운 파랑·높음 흰노랑).
function heat(t){t=Math.max(0,Math.min(1,t));const r=Math.min(255,t*510),g=Math.min(255,Math.max(0,(t-0.3)*510)),b=Math.max(0,(0.4-t)*510)+t*120;return [r|0,g|0,b|0];}
function disc(ox,oy,cx,cy,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=cellPx*0.9,r2=rp*rp;
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.55+0.45*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(col[0]*f)|0,(col[1]*f)|0,(col[2]*f)|0);}}
const globalMax=Math.max(...maxD);
const labels=['1) 흩어진 구름','2) 수축 중','3) 코어 밀집(ρ↑)'];
for(let k=0;k<3;k++){
  const ox=pad+k*(panel+gap), oy=pad+lab;
  box(ox,oy);
  for(const p of frames[k]) disc(ox,oy,p.cx,p.cy,heat(p.d/globalMax));   // 밀도 색
}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
// 검증: 중력 수축으로 최대 밀도가 단조 증가(흩어짐→밀집)·모두 양수.
const ok=fs.existsSync(outPath) && maxD[2]>maxD[1] && maxD[1]>maxD[0] && maxD.every(d=>d>0);
console.log('\n=== 눈 검증: SPH 밀도 추정 — 구체 떼의 국소 밀도(SW5) ===');
console.log('  최대 SPH 밀도(흩어짐→수축→밀집): '+maxD.map(d=>d.toFixed(3)).join(' → ')+'(단조↑ = 모이면 ρ↑)');
console.log('  입자 80개·평활길이 h='+h+'·자기+이웃 합 ρ=Σ m·W');
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
