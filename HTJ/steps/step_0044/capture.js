// step_0044/capture.js — 눈 검증(engine 직접 PNG): 강착↔파편 왕복 — 고속 충돌체가 천체를 부수고 파편이 다시 모인다.
//
//   design/sphere-world.md §6 SW3·§4 — 임계가 가른다(빠름→깨짐·느림→합침). 강착 세계(0043)에 쪼개기(0038)를
//   더하면: 뜨거운 천체에 고속 충돌체가 박혀 *파편으로 폭발*하고(N↑), 파편이 중력+소산으로 식어 *다시 합쳐진다*
//   (N↓·재강착). 4 프레임 top-down: 접근 → 충돌 폭발(파편 흩뿌림) → 분산 → 재강착. 크기=질량·색=온도.
//
//   실행: node HTJ/steps/step_0044/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=48, eqR=(n)=>En.equivalentRadius(n);
function body(cx,cy,cells,vx,vy,intE){const m=cells*4;return {cx,cy,cz:24,mass:m,px:m*vx,py:m*vy,pz:0,Lx:0,Ly:0,Lz:0,KEcm:0.5*m*(vx*vx+vy*vy),internalE:intE,energy:0,cells,radius:eqR(cells),temp:0,peak:1};}
let seed=7; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
let ps=[body(26,24,80,0,0,600),body(6,24,10,5.5,0,3)];   // 뜨거운 천체 + 고속 충돌체
for(let i=0;i<8;i++){const dx=(rnd()-0.5)*10+6,dy=(rnd()-0.5)*22;ps.push(body(24+dx,24+dy,6,-0.04*dy,0.02*dx,3));}
const dt=0.08,gopt={G:0.3,soft:5},copt={stiffness:5,damping:10,pad:0.3};
const fopt={shatterKE:40,n:6,dispersalFrac:0.85,spread:1.3,pad:0.4},mopt={vstick:1.2,pad:0.6};
const sumM=es=>es.reduce((s,p)=>s+p.mass,0), sumP=es=>{let x=0;for(const p of es)x+=p.px;return x;};
function snap(){let mxT=0;for(const p of ps){const t=p.internalE/p.mass;if(t>mxT)mxT=t;}
  return {pts:ps.map(p=>({cx:p.cx,cy:p.cy,r:p.radius,t:p.internalE/p.mass})),n:ps.length,M:sumM(ps),P:sumP(ps)};}

function advance(){En.applyEntityGravity(ps,dt,gopt);En.applyEntityContact(ps,dt,copt);En.stepEntities(ps,dt,{N});ps=En.fragmentOnImpact(ps,fopt).entities;ps=En.mergeEntities(ps,mopt).entities;}
// 프레임 시점: 접근 → 충돌 폭발 → 분산 → 재강착. 폭발 시점(≈t50)을 노린다.
const stops=[0,46,62,230];
const frames=[]; let maxN=ps.length;
for(let t=0,fi=0;t<=stops[stops.length-1];t++){
  if(t===stops[fi]){frames.push(snap());fi++;}
  if(fi<stops.length){advance();if(ps.length>maxN)maxN=ps.length;}
}

let gmaxT=0; for(const f of frames)for(const p of f.pts)if(p.t>gmaxT)gmaxT=p.t;
const cellPx=7, panel=N*cellPx, gap=18, pad=20, lab=18;
const Wd=pad*2+panel*4+gap*3, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=10;out[i+1]=12;out[i+2]=18;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
function heat(t){t=Math.max(0,Math.min(1,t));const r=Math.min(255,t*510),g=Math.min(255,Math.max(0,(t-0.3)*510)),b=Math.max(0,(0.4-t)*510)+t*120;return [r|0,g|0,b|0];}
function disc(ox,oy,cx,cy,rad,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=Math.max(cellPx*0.6,rad*cellPx*0.9),r2=rp*rp;
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.5+0.5*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(col[0]*f)|0,(col[1]*f)|0,(col[2]*f)|0);}}
for(let k=0;k<4;k++){const ox=pad+k*(panel+gap), oy=pad+lab; box(ox,oy);
  for(const p of frames[k].pts) disc(ox,oy,p.cx,p.cy,p.r,heat(gmaxT>0?p.t/gmaxT:0));}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
// 검증: ① 폭발(충돌 프레임 N > 시작) ② 재강착(끝 N < 폭발 최대) ③ 질량·운동량 정확 보존.
const burst=frames[1].n>frames[0].n||maxN>frames[0].n;
const reaccrete=frames[3].n<maxN;
let massOk=true,pOk=true; for(let k=1;k<4;k++){if(Math.abs(frames[k].M-frames[0].M)>1e-6)massOk=false;if(Math.abs(frames[k].P-frames[0].P)>1e-4)pOk=false;}
const ok=fs.existsSync(outPath)&&burst&&reaccrete&&massOk&&pOk;
console.log('\n=== 눈 검증: 강착↔파편 왕복 — 부수고 다시 모인다(SW3·임계가 가른다) ===');
console.log('  개체 수(접근→폭발→분산→재강착): '+frames.map(f=>f.n).join(' → ')+`  (최대 ${maxN})`);
console.log('  질량(보존): '+frames.map(f=>f.M.toFixed(1)).join(' → ')+'(불변)');
console.log('  운동량 ΣP_x(보존): '+frames.map(f=>f.P.toFixed(2)).join(' → ')+'(불변)');
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
