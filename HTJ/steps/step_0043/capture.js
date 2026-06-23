// step_0043/capture.js — 눈 검증(engine 직접 PNG): 강착 세계 — 작은 구체 구름이 몇 천체로 합쳐진다.
//
//   design/sphere-world.md §6 SW1·SW2 — 중력+소산 접촉+합치기를 함께 굴리면 작은 구체 40개 구름이 무너지며
//   충돌·소산으로 식고 합쳐져 *몇 개의 큰 천체로 강착*한다(미행성→행성). 4 프레임 top-down: 흩어진 작은 점들 →
//   뭉치며 합쳐짐 → 몇 개의 큰 구체(밝음=강착열↑). 크기=질량·색=온도(internalE/mass).
//
//   실행: node HTJ/steps/step_0043/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=48, CEN=(N-1)/2, eqR=(n)=>En.equivalentRadius(n);
let seed=11; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
// 작은 구체 40개 구름 — 약한 접선 속도(각운동량).
let ps=[];
for(let i=0;i<40;i++){const cells=6,m=cells*4,dx=(rnd()-0.5)*18,dy=(rnd()-0.5)*18,dz=(rnd()-0.5)*18,tang=0.04;
  ps.push({cx:CEN+dx,cy:CEN+dy,cz:CEN+dz,mass:m,px:m*-tang*dy,py:m*tang*dx,pz:0,Lx:0,Ly:0,Lz:0,
    KEcm:0,internalE:cells*0.5,energy:cells*0.5,cells,radius:eqR(cells),temp:0,peak:1});}
const dt=0.1,gopt={G:0.5,soft:4},copt={stiffness:4,damping:25,pad:0.3},mopt={vstick:3.0,pad:0.6};
const sumU=es=>es.reduce((s,p)=>s+p.internalE,0), sumM=es=>es.reduce((s,p)=>s+p.mass,0);
const sumP=es=>{let x=0;for(const p of es)x+=p.px;return x;};
function snap(){let mxT=0;for(const p of ps){const t=p.internalE/p.mass;if(t>mxT)mxT=t;}
  return {pts:ps.map(p=>({cx:p.cx,cy:p.cy,r:p.radius,t:p.internalE/p.mass})), n:ps.length, U:sumU(ps), M:sumM(ps), P:sumP(ps), mxT};}

const frames=[snap()];
const stepsPer=[120,160,320];   // 누적 t=120, 280, 600
for(const sp of stepsPer){for(let s=0;s<sp;s++){
  En.applyEntityGravity(ps,dt,gopt);En.applyEntityContact(ps,dt,copt);En.stepEntities(ps,dt,{N});ps=En.mergeEntities(ps,mopt).entities;
} frames.push(snap());}
let gmaxT=0; for(const f of frames)for(const p of f.pts)if(p.t>gmaxT)gmaxT=p.t;

const cellPx=7, panel=N*cellPx, gap=18, pad=20, lab=18;
const Wd=pad*2+panel*4+gap*3, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=10;out[i+1]=12;out[i+2]=18;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
function heat(t){t=Math.max(0,Math.min(1,t));const r=Math.min(255,t*510),g=Math.min(255,Math.max(0,(t-0.3)*510)),b=Math.max(0,(0.4-t)*510)+t*120;return [r|0,g|0,b|0];}
// 반지름(질량) 반영 디스크.
function disc(ox,oy,cx,cy,rad,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=Math.max(cellPx*0.6,rad*cellPx*0.9),r2=rp*rp;
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.5+0.5*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(col[0]*f)|0,(col[1]*f)|0,(col[2]*f)|0);}}
for(let k=0;k<4;k++){const ox=pad+k*(panel+gap), oy=pad+lab; box(ox,oy);
  for(const p of frames[k].pts) disc(ox,oy,p.cx,p.cy,p.r,heat(gmaxT>0?p.t/gmaxT:0));}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
// 검증: ① 개체 수 단조 감소(강착) ② 질량 정확 보존 ③ 운동량 정확 보존 ④ 내부E 증가(소산+강착열).
let accreting=true,massOk=true,pOk=true;
for(let k=1;k<4;k++){if(frames[k].n>frames[k-1].n)accreting=false;if(Math.abs(frames[k].M-frames[0].M)>1e-6)massOk=false;if(Math.abs(frames[k].P-frames[0].P)>1e-4)pOk=false;}
const heated=frames[3].U>frames[0].U*2;
const ok=fs.existsSync(outPath)&&accreting&&massOk&&pOk&&heated;
console.log('\n=== 눈 검증: 강착 세계 — 작은 구체 구름이 몇 천체로 합쳐진다(SW1+SW2) ===');
console.log('  개체 수(강착): '+frames.map(f=>f.n).join(' → ')+'(단조↓)');
console.log('  질량(보존): '+frames.map(f=>f.M.toFixed(1)).join(' → ')+'(불변)');
console.log('  운동량 ΣP_x(보존): '+frames.map(f=>f.P.toFixed(2)).join(' → ')+'(불변)');
console.log('  내부E U(소산+강착열): '+frames.map(f=>f.U.toFixed(0)).join(' → ')+'(증가)');
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
