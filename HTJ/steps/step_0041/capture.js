// step_0041/capture.js — 눈 검증(engine 직접 PNG): SW5 SPH 압력 — 압축된 가스 덩어리가 퍼진다.
//
//   design/sphere-world.md §6 SW5 — SPH 압력은 밀도↑→압력↑로 입자를 밀어낸다(0008 격자 반발의 SPH 판).
//   압축된 작은 구체 떼(높은 밀도)가 *가스처럼 바깥으로 퍼지고* 밀도가 떨어진다. 운동량은 대칭 쌍힘이라 정확
//   보존(ΣP 불변). 4 프레임 top-down·밀도 heat 색: 빽빽한 코어(밝음) → 점점 퍼지며 옅어짐(어두워짐).
//
//   실행: node HTJ/steps/step_0041/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=48, CEN=(N-1)/2, FOURPI_3=4*Math.PI/3, eqR=(n)=>Math.cbrt(n/FOURPI_3);
let seed=99; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
// 압축된 작은 구체 떼(중심 둘레 반경 3.5 안에 빽빽이).
const ps=[];
for(let i=0;i<60;i++){const r=rnd()*3.5,th=rnd()*2*Math.PI,ph=Math.acos(2*rnd()-1);
  ps.push({cx:CEN+r*Math.sin(ph)*Math.cos(th),cy:CEN+r*Math.sin(ph)*Math.sin(th),cz:CEN+r*Math.cos(ph),
    mass:1, px:0, py:0, pz:0, KEcm:0, internalE:1, energy:1, cells:5, radius:eqR(5)});}
const h=3, dt=0.2, popt={stiffness:3, gamma:2, h};
function rms(){let cx=0,cy=0,cz=0,M=0;for(const p of ps){cx+=p.mass*p.cx;cy+=p.mass*p.cy;cz+=p.mass*p.cz;M+=p.mass;}cx/=M;cy/=M;cz/=M;let s=0;for(const p of ps)s+=(p.cx-cx)**2+(p.cy-cy)**2+(p.cz-cz)**2;return Math.sqrt(s/ps.length);}
function snap(){SPH.sphDensity(ps,{h});let mx=0;for(const p of ps)if(p.density>mx)mx=p.density;
  return {pts:ps.map(p=>({cx:p.cx,cy:p.cy,d:mx>0?p.density/globalMax:0})), rms:rms(), maxd:mx, P:ps.reduce((s,p)=>s+p.px,0)};}

// globalMax 를 위해 먼저 t0 최대 밀도.
SPH.sphDensity(ps,{h}); let globalMax=0; for(const p of ps)if(p.density>globalMax)globalMax=p.density;
const frames=[snap()];
for(let f=0;f<3;f++){for(let s=0;s<8;s++){SPH.sphPressureForce(ps,dt,popt);En.stepEntities(ps,dt,{N});} frames.push(snap());}

const cellPx=7, panel=N*cellPx, gap=18, pad=20, lab=18;
const Wd=pad*2+panel*4+gap*3, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=10;out[i+1]=12;out[i+2]=18;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
function heat(t){t=Math.max(0,Math.min(1,t));const r=Math.min(255,t*510),g=Math.min(255,Math.max(0,(t-0.3)*510)),b=Math.max(0,(0.4-t)*510)+t*120;return [r|0,g|0,b|0];}
function disc(ox,oy,cx,cy,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=cellPx*0.8,r2=rp*rp;
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.55+0.45*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(col[0]*f)|0,(col[1]*f)|0,(col[2]*f)|0);}}
for(let k=0;k<4;k++){const ox=pad+k*(panel+gap), oy=pad+lab; box(ox,oy);
  for(const p of frames[k].pts) disc(ox,oy,p.cx,p.cy,heat(p.d));}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
// 검증: rms 반지름 단조 증가(퍼짐)·최대 밀도 단조 감소(옅어짐)·운동량 ΣP 보존(≈0).
let growing=true, thinning=true, conserved=true;
for(let k=1;k<4;k++){if(frames[k].rms<=frames[k-1].rms)growing=false; if(frames[k].maxd>=frames[k-1].maxd)thinning=false; if(Math.abs(frames[k].P-frames[0].P)>1e-6)conserved=false;}
const ok=fs.existsSync(outPath)&&growing&&thinning&&conserved;
console.log('\n=== 눈 검증: SPH 압력 — 압축된 가스 덩어리가 퍼진다(SW5) ===');
console.log('  rms 반지름(퍼짐): '+frames.map(f=>f.rms.toFixed(2)).join(' → ')+'(단조↑)');
console.log('  최대 밀도(옅어짐): '+frames.map(f=>f.maxd.toFixed(3)).join(' → ')+'(단조↓)');
console.log('  운동량 ΣP_x 보존: '+frames.map(f=>f.P.toFixed(4)).join(' → ')+'(≈0 불변)');
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
