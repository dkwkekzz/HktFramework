// step_0038/capture.js — 눈 검증(engine 직접 PNG): SW3 구체 쪼개기 — 큰 구체 둘이 빠르게 충돌해 파편으로.
//
//   design/sphere-world.md §6 SW3 — 합치기(SW1)의 거울: 강한 충돌(상대 운동E ≥ 결합E 임계)이 구체를 작은
//   구체들로 깬다. 4 프레임(top-down z=중심): 큰 구체 2개 접근 → 충돌 → 각각 파편화(2→12) → 파편 분산.
//   조각 질량↓ → μ↓ → 조각끼리 상대 KE 가 임계 아래 = 재파편 폭주 없음(N 12 에 머묾). 질량·운동량 정확 보존.
//
//   실행: node HTJ/steps/step_0038/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=32, CEN=15.5, FOURPI_3=4*Math.PI/3;
const eqR=(n)=>Math.cbrt(n/FOURPI_3);
// 큰 구체 = cells 큼(반지름 ~3.2)·결합열 큼(분산 재료). 마주보고 접근.
function big(cx,vx){const cells=440,mass=400,internalE=300,px=mass*vx;
  return {cx,cy:CEN,cz:CEN,mass,px,py:0,pz:0,Lx:0,Ly:0,Lz:0,KEcm:0.5*mass*vx*vx,internalKE:0,internalE,energy:0.5*mass*vx*vx+internalE,cells,radius:eqR(cells),temp:0,peak:1};}
let ents=[big(CEN-8,0.8), big(CEN+8,-0.8)];   // 거리 16서 접근(상대 1.6)

const M0=ents.reduce((s,e)=>s+e.mass,0), P0=ents.reduce((s,e)=>s+e.px,0);
const fopt={shatterKE:200,n:6,dispersalFrac:0.4,pad:0.5}, copt={k:14,cDamp:6}, dt=0.5;
function step(){
  const r=En.fragmentOnImpact(ents,fopt); ents=r.entities;   // 빠른 충돌 → 파편화
  En.applyEntityContact(ents,dt,copt);                       // 파편끼리 겹침 거부(반발+감쇠)
  En.stepEntities(ents,dt,{N});                              // 이동(토러스)
}
function snap(){return ents.map(e=>({cx:e.cx,cy:e.cy,r:e.radius,big:e.radius>3.5,temp:e.mass>0?e.internalE/e.mass:0}));}

const frames=[], Ns=[];
frames.push(snap()); Ns.push(ents.length);                  // f0: 큰 구체 2개 접근
for(let i=0;i<11;i++)step(); frames.push(snap()); Ns.push(ents.length);   // 충돌 직전/직후
for(let i=0;i<4;i++)step(); frames.push(snap()); Ns.push(ents.length);    // 파편화(2→12)·분산 시작
for(let i=0;i<16;i++)step(); frames.push(snap()); Ns.push(ents.length);   // 파편 흩어짐
const M1=ents.reduce((s,e)=>s+e.mass,0), P1=ents.reduce((s,e)=>s+e.px,0);

const cellPx=6, panel=N*cellPx, gap=18, pad=20, lab=18;
const Wd=pad*2+panel*4+gap*3, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=12;out[i+1]=14;out[i+2]=20;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
// 큰 구체=청록·파편=따뜻(작고 흩어짐). 깨짐을 눈으로.
function disc(ox,oy,cx,cy,rad,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=Math.max(cellPx*0.8,rad*cellPx),r2=rp*rp;
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.55+0.45*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(col[0]*f)|0,(col[1]*f)|0,(col[2]*f)|0);}}
for(let k=0;k<4;k++){
  const ox=pad+k*(panel+gap), oy=pad+lab;
  box(ox,oy);
  for(const e of frames[k]){
    if(e.big)disc(ox,oy,e.cx,e.cy,e.r,[90,180,200]);          // 큰 구체(온전)
    else disc(ox,oy,e.cx,e.cy,e.r,[230,150,80]);              // 파편
  }
}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
const ok=fs.existsSync(outPath)&&Ns[0]===2&&Ns[3]===12&&Math.abs(M1-M0)<=1e-6+1e-9*M0&&Math.abs(P1-P0)<=1e-6+1e-9*Math.abs(M0);
console.log('\n=== 눈 검증: 큰 구체 둘이 빠르게 충돌해 파편으로(쪼개기·SW3) ===');
console.log('  4 프레임 개체 수: '+Ns.join(' → ')+' (2→12=각각 6 조각·재파편 폭주 없음)');
console.log('  질량 보존: '+M0.toFixed(1)+' → '+M1.toFixed(1)+' · 운동량 ΣP_x: '+P0.toFixed(2)+' → '+P1.toFixed(2));
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
