// step_0037/capture.js — 눈 검증(engine 직접 PNG): SW2 접촉(반발 + 소산) — 작은 구체들이 큰 구체 위로 쌓인다.
//
//   design/sphere-world.md §6 SW2(DEM) — 합치기(SW1)는 닿고 느린 구체를 *하나로* 붙였다. 접촉은 겹친 구체를
//   *합치지 않고 떠받친다*: 반발(겹침 거부)이 작은 구체들을 큰 구체(지면) 위에·서로 위에 쌓아 표면을 세우고,
//   감쇠(법선 소산→열)가 튕김을 죽여 멈춘다. 4 프레임(top-down z=중심): 둘레에 흩어진 작은 구체 12개 →
//   중력으로 떨어짐 → 지면 표면에 닿아 겹침 거부로 *고리처럼 쌓임* → 감쇠로 정착(잔류 KE↓).
//
//   실행: node HTJ/steps/step_0037/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=32, CEN=15.5, FOURPI_3=4*Math.PI/3;
const Rg=6, SMALL=12, smallR=1.3, smallM=70, shellR=11;
// 지면 = 큰 구체(질량 거대 → 거의 안 움직임)·중심.
let ents=[{cx:CEN,cy:CEN,cz:CEN,mass:6e4,px:0,py:0,pz:0,Lx:0,Ly:0,Lz:0,KEcm:0,internalKE:0,internalE:0,energy:0,cells:FOURPI_3*Rg*Rg*Rg,radius:Rg,temp:0,peak:0.2}];
// 작은 구체들 — 평면(z=CEN) 고리에 결정론적으로 배치(떨어질 준비).
for(let i=0;i<SMALL;i++){const th=2*Math.PI*i/SMALL;
  ents.push({cx:CEN+Math.cos(th)*shellR,cy:CEN+Math.sin(th)*shellR,cz:CEN,mass:smallM,px:0,py:0,pz:0,Lx:0,Ly:0,Lz:0,KEcm:0,internalKE:0,internalE:0,energy:0,cells:FOURPI_3*smallR*smallR*smallR,radius:smallR,temp:0,peak:1});}

const gopt={G:8e-4,soft:3}, copt={k:12,cDamp:40}, dt=0.25;
function step(){En.applyEntityGravity(ents,dt,gopt);En.applyEntityContact(ents,dt,copt);En.stepEntities(ents,dt);}
const KE=()=>ents.reduce((s,e)=>s+e.KEcm,0);
function snap(){return ents.map(e=>({cx:e.cx,cy:e.cy,r:e.radius,ground:e.radius>3,temp:e.mass>0?e.internalE/e.mass:0}));}

const frames=[]; const KEs=[];
frames.push(snap()); KEs.push(KE());          // f0: 둘레에 흩어진 작은 구체 12개
let kemax=0;
for(let i=0;i<18;i++){step();kemax=Math.max(kemax,KE());} frames.push(snap()); KEs.push(KE());   // 떨어지는 중
for(let i=0;i<22;i++){step();kemax=Math.max(kemax,KE());} frames.push(snap()); KEs.push(KE());   // 표면에 닿아 쌓임
for(let i=0;i<40;i++){step();kemax=Math.max(kemax,KE());} frames.push(snap()); KEs.push(KE());   // 정착(잔류 KE↓)

// 표면 정착 측정: 마지막 프레임에서 작은 구체가 지면과 접촉(거리 ≤ Rg+smallR+여유)하는지.
const last=ents.slice(1);
const touching=last.filter(e=>Math.hypot(e.cx-CEN,e.cy-CEN)<=Rg+smallR+0.3).length;
const tempMax=Math.max(...last.map(e=>e.internalE/e.mass));   // 감쇠로 데워짐(소산→열)

const cellPx=6, panel=N*cellPx, gap=18, pad=20, lab=18;
const Wd=pad*2+panel*4+gap*3, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=12;out[i+1]=14;out[i+2]=20;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
// 지면=어두운 회청·작은 구체=따뜻(감쇠열↑ → 더 따뜻). 색으로 소산을 눈에.
function colSmall(t){const f=Math.min(1,t/(tempMax+1e-9));return[(180+f*70)|0,(150-f*40)|0,(90-f*40)|0];}
function disc(ox,oy,cx,cy,rad,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=Math.max(cellPx*0.9,rad*cellPx),r2=rp*rp;
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.55+0.45*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(col[0]*f)|0,(col[1]*f)|0,(col[2]*f)|0);}}
for(let k=0;k<4;k++){
  const ox=pad+k*(panel+gap), oy=pad+lab;
  box(ox,oy);
  for(const e of frames[k]){
    if(e.ground)disc(ox,oy,e.cx,e.cy,e.r,[70,82,104]);          // 지면(큰 구체)
    else disc(ox,oy,e.cx,e.cy,e.r,colSmall(e.temp));            // 작은 구체(따뜻=데워짐)
  }
}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
const ok=fs.existsSync(outPath)&&touching>=SMALL-1&&KEs[3]<kemax*0.1&&tempMax>0;
console.log('\n=== 눈 검증: 작은 구체들이 큰 구체(지면) 위로 떨어져 쌓인다(반발+소산·SW2) ===');
console.log('  4 프레임 잔류 KE: '+KEs.map(v=>v.toFixed(2)).join(' → ')+'  (낙하 최대 '+kemax.toFixed(2)+' → 정착 ↓)');
console.log('  표면 접촉(마지막): '+touching+'/'+SMALL+'개가 지면 표면에 닿아 쌓임(반발=겹침 거부)');
console.log('  감쇠열(소산→열) tempMax: '+tempMax.toFixed(3)+' (>0 = 멈추며 데워짐·비가역)');
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
