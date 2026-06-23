// step_0042/capture.js — 눈 검증(engine 직접 PNG): SW5 SPH 에너지 닫힘 — 압축이 데우고 팽창이 식힌다.
//
//   design/sphere-world.md §6 SW5 — 0041 압력이 한 일이 이제 내부에너지로 닫힌다(총E 보존). 안으로 무너지는
//   가스 구름이 *압축되며 데워지고*(중심 밝아짐) 되튀어 *팽창하며 식는다*(어두워짐). 색 = 온도(internalE/mass).
//   4 프레임 top-down: 수축(데움) → 코어 점화처럼 밝아짐 → 되튀어 옅고 차갑게.
//
//   실행: node HTJ/steps/step_0042/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=48, CEN=(N-1)/2, FOURPI_3=4*Math.PI/3, eqR=(n)=>Math.cbrt(n/FOURPI_3);
let seed=99; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
// 가스 구름 — 중심을 향한 안쪽 속도(붕괴) 부여 → 압축 단계에서 데워짐.
const ps=[];
for(let i=0;i<60;i++){const r=4+rnd()*4,th=rnd()*2*Math.PI,ph=Math.acos(2*rnd()-1);
  const ux=Math.sin(ph)*Math.cos(th),uy=Math.sin(ph)*Math.sin(th),uz=Math.cos(ph),m=1,vin=-1.1; // 안쪽으로
  ps.push({cx:CEN+r*ux,cy:CEN+r*uy,cz:CEN+r*uz,mass:m,px:m*vin*ux,py:m*vin*uy,pz:m*vin*uz,
    KEcm:0.5*m*vin*vin,internalE:0.5,energy:0.5+0.5*m*vin*vin,cells:5,radius:eqR(5)});}
const h=3, dt=0.16, opt={stiffness:2.5, gamma:2, h};
function rms(){let cx=0,cy=0,cz=0,M=0;for(const p of ps){cx+=p.mass*p.cx;cy+=p.mass*p.cy;cz+=p.mass*p.cz;M+=p.mass;}cx/=M;cy/=M;cz/=M;let s=0;for(const p of ps)s+=(p.cx-cx)**2+(p.cy-cy)**2+(p.cz-cz)**2;return Math.sqrt(s/ps.length);}
function totU(){return ps.reduce((s,p)=>s+p.internalE,0);}
function totKE(){return ps.reduce((s,p)=>s+(p.mass>0?0.5*(p.px*p.px+p.py*p.py+p.pz*p.pz)/p.mass:0),0);}
function snap(){let mx=0;for(const p of ps)if(p.internalE>mx)mx=p.internalE;
  return {pts:ps.map(p=>({cx:p.cx,cy:p.cy,t:p.internalE/p.mass})), rms:rms(), U:totU(), KE:totKE(), maxT:mx};}

const frames=[snap()];
for(let f=0;f<3;f++){for(let s=0;s<7;s++){
  SPH.sphThermalEnergy(ps,dt,opt);   // 열(internalE) — 사전 속도(p 는 안 건드림)
  SPH.sphPressureForce(ps,dt,opt);   // 압력(p) — 같은 사전 속도라 짝지어 총E 닫힘
  En.stepEntities(ps,dt,{N});
} frames.push(snap());}
// 온도 색 정규화 — 전 프레임 최고 온도 기준.
let gmaxT=0; for(const f of frames)for(const p of f.pts)if(p.t>gmaxT)gmaxT=p.t;

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
  for(const p of frames[k].pts) disc(ox,oy,p.cx,p.cy,heat(gmaxT>0?p.t/gmaxT:0));}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
// 검증: ① 수축 단계에서 내부E(U) 증가(압축 데움) ② 총E=KE+U 거의 보존(이산 O(dt²)) ③ rms 가 한 번 수축.
const E=frames.map(f=>f.KE+f.U);
const heated=frames[1].U>frames[0].U;                 // 첫 구간(붕괴) → U 증가
const contracted=Math.min(...frames.map(f=>f.rms))<frames[0].rms;   // 어느 시점에 수축
let conserved=true; for(let k=1;k<4;k++) if(Math.abs(E[k]-E[0])/E[0]>0.05) conserved=false;  // 총E ±5%
const ok=fs.existsSync(outPath)&&heated&&contracted&&conserved;
console.log('\n=== 눈 검증: SPH 에너지 닫힘 — 압축이 데우고 팽창이 식힌다(SW5) ===');
console.log('  rms 반지름(수축↔팽창): '+frames.map(f=>f.rms.toFixed(2)).join(' → '));
console.log('  내부E U(압축 데움): '+frames.map(f=>f.U.toFixed(2)).join(' → '));
console.log('  운동E KE: '+frames.map(f=>f.KE.toFixed(2)).join(' → '));
console.log('  총E=KE+U(보존): '+E.map(e=>e.toFixed(2)).join(' → ')+'(거의 불변)');
console.log('  최고 온도 maxT: '+frames.map(f=>f.maxT.toFixed(2)).join(' → '));
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
