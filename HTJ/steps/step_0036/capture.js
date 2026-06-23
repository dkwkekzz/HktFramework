// step_0036/capture.js — 눈 검증(engine 직접 PNG): SW1 구체 합치기(강착) — 작은 구체들이 합쳐져 큰 구체로.
//
//   design/sphere-world.md §6 SW1 — 수박: 작은 구체 떼가 중력으로 끌려 닿으면(느리면) 합쳐져 더 큰 구체가
//   된다. 4 프레임(top-down z=중심): 작은 구체 9개 → 끌려 합쳐지며 수 줄고 반지름 큼 → … → 적은 큰 구체.
//   = N 개가 적은 큰 구체로(강착·행성 형성), 질량 정확 보존.
//
//   실행: node HTJ/steps/step_0036/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=32, CEN=15.5, FOURPI_3=4*Math.PI/3;
function eqR(n){return Math.cbrt(n/FOURPI_3);}
// 작은 구체 하나 — cells 작게(반지름 ~1.6), 약한 접선 속도(궤도+천천히 끌림).
function seed(cx,cy){const cells=18,mass=cells*4;const vx=-0.06*(cy-CEN),vy=0.06*(cx-CEN);
  return {cx,cy,cz:CEN,mass,px:mass*vx,py:mass*vy,pz:0,Lx:0,Ly:0,Lz:0,KEcm:0.5*mass*(vx*vx+vy*vy),internalKE:0,internalE:cells*0.5,energy:0,cells,radius:eqR(cells),temp:0,peak:1};}
// 3×3 격자(간격 6·약한 접선 속도) — 처음엔 안 닿음. 중력으로 끌려 닿으면(느리면) 합쳐진다.
let ents=[];
for(let r=0;r<3;r++)for(let c=0;c<3;c++)ents.push(seed(CEN-6+c*6, CEN-6+r*6));
for(const e of ents)e.energy=e.KEcm+e.internalE;

const M0=ents.reduce((s,e)=>s+e.mass,0);
function step(){
  En.applyEntityGravity(ents,0.3,{G:0.6,soft:3});   // 서로 끌어 닿게
  En.stepEntities(ents,0.3,{N});
  ents=En.mergeEntities(ents,{vstick:0.9,pad:0.6}).entities;  // 닿고 느리면 합침(강착)
}
function snap(){return ents.map(e=>({cx:e.cx,cy:e.cy,r:e.radius,m:e.mass}));}
const frames=[];
frames.push(snap());               // f0: 작은 구체 9개(반지름 1.63)
for(let i=0;i<16;i++)step(); frames.push(snap());   // 일부 합쳐짐(5개·하나 커짐 2.78)
for(let i=0;i<18;i++)step(); frames.push(snap());   // 전부 합쳐짐(1개·3.38)
for(let i=0;i<10;i++)step(); frames.push(snap());   // 큰 구체 드리프트

const cellPx=6, panel=N*cellPx, gap=18, pad=20, lab=18;
const Wd=pad*2+panel*4+gap*3, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=12;out[i+1]=14;out[i+2]=20;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
// 큰 구체일수록 더 따뜻한 색(질량) — 합쳐짐을 눈으로.
function col(m){const t=Math.min(1,m/(M0*0.6));return[(90+t*160)|0,(150+t*80)|0,(250-t*120)|0];}
function disc(ox,oy,cx,cy,rad,m){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=Math.max(cellPx*1.0,rad*cellPx),r2=rp*rp,c=col(m);
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.5+0.5*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(c[0]*f)|0,(c[1]*f)|0,(c[2]*f)|0);}}
for(let k=0;k<4;k++){
  const ox=pad+k*(panel+gap), oy=pad+lab;
  box(ox,oy);
  for(const e of frames[k])disc(ox,oy,e.cx,e.cy,e.r,e.m);
}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
const M1=ents.reduce((s,e)=>s+e.mass,0);
const ok=fs.existsSync(outPath)&&frames[0].length===9&&frames[3].length<frames[0].length&&Math.abs(M1-M0)<=1e-6+1e-9*M0;
console.log('\n=== 눈 검증: 작은 구체들이 합쳐져 큰 구체로(강착) ===');
console.log('  4 프레임 개체 수: '+frames.map(f=>f.length).join(' → ')+' (줄어듦=합쳐짐)');
console.log('  질량 보존: '+M0.toFixed(1)+' → '+M1.toFixed(1));
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
