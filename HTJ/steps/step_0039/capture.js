// step_0039/capture.js — 눈 검증(engine 직접 PNG): SW4 적응 LOD — 멀면 coarse·가까이 fine.
//
//   design/sphere-world.md §6 SW4 — 0034 격자 LOD 의 Lagrangian 판. 관찰자(○) 거리로 구체를 합치고 쪼갠다.
//   3 패널: ① 원본(먼 구체 무리 多·관찰자 멀리) ② coarsen(먼 블록당 1 개 큰 구체로·N↓) ③ refine(관찰자가
//   다가오면 그 영역 coarse 가 다시 fine 으로). 합치고 쪼개도 질량·운동량 정확 보존 — 벌크 불변·모양만 LOD.
//
//   실행: node HTJ/steps/step_0039/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=48, FOURPI_3=4*Math.PI/3, eqR=(n)=>Math.cbrt(n/FOURPI_3);
function sphere(cx,cy,cells,vx,vy){const mass=cells*0.5,px=mass*vx,py=mass*vy;
  return {cx,cy,cz:N/2,mass,px,py,pz:0,Lx:0,Ly:0,Lz:0,KEcm:0.5*mass*(vx*vx+vy*vy),internalKE:0,internalE:cells*0.4,energy:0.5*mass*(vx*vx+vy*vy)+cells*0.4,cells,radius:eqR(cells),temp:0,peak:1,lodMembers:1};}

const bs=8;
// 원본: 4 개 far 블록(관찰자서 멀리)에 작은 구체 떼 多 + near 영역에 fine 몇 개.
function buildScene(){
  const es=[];
  // near 영역(관찰자 근처·왼쪽 아래) fine 구체 4 개.
  for(let i=0;i<4;i++)es.push(sphere(7+(i%2)*4, 38+((i/2)|0)*4, 6, 0.1*i, -0.1*i));
  // far 블록 4 곳에 각 7 개 작은 구체(합쳐질 무리).
  const blocks=[[34,9],[42,11],[10,9],[40,38]];
  for(const [bx,by] of blocks)for(let i=0;i<7;i++)es.push(sphere(bx+(i%4)-1.5, by+((i/4)|0)*2.5-1, 5, 0.05*i, 0.05*i));
  return es;
}
const obsFar=[8,40,N/2];                 // 관찰자: near 영역(왼쪽 아래)
const nearR=10;

const scene=buildScene();
const M0=scene.reduce((s,e)=>s+e.mass,0), P0=scene.reduce((s,e)=>s+e.px,0);
// ② coarsen — 관찰자 멀리서 본 LOD(먼 블록 합침).
const lod=En.adaptLOD(scene,{observer:obsFar,blockSize:bs,nearRadius:nearR});
const M1=lod.entities.reduce((s,e)=>s+e.mass,0), P1=lod.entities.reduce((s,e)=>s+e.px,0);
// ③ refine — 관찰자가 우상단 far 블록[42,11]로 다가옴 → 그 coarse 가 다시 fine.
const obsNear=[42,11,N/2];
const refined=En.adaptLOD(lod.entities,{observer:obsNear,blockSize:bs,nearRadius:nearR});
const M2=refined.entities.reduce((s,e)=>s+e.mass,0), P2=refined.entities.reduce((s,e)=>s+e.px,0);

const panels=[
  {es:scene, obs:obsFar, label:'1) 원본 '+scene.length+' 개'},
  {es:lod.entities, obs:obsFar, label:'2) coarsen '+lod.entities.length+' 개(먼 블록→1)'},
  {es:refined.entities, obs:obsNear, label:'3) refine '+refined.entities.length+' 개(다가온 곳 fine)'},
];

const cellPx=7, panel=N*cellPx, gap=20, pad=20, lab=20;
const Wd=pad*2+panel*3+gap*2, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=12;out[i+1]=14;out[i+2]=20;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
function disc(ox,oy,cx,cy,rad,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=Math.max(cellPx*0.7,rad*cellPx),r2=rp*rp;
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.5+0.5*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(col[0]*f)|0,(col[1]*f)|0,(col[2]*f)|0);}}
function ring(ox,oy,cx,cy,rad,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=rad*cellPx;for(let a=0;a<360;a+=4){const t=a*Math.PI/180;px(sx+Math.cos(t)*rp,sy+Math.sin(t)*rp,col[0],col[1],col[2]);}}
for(let k=0;k<3;k++){
  const ox=pad+k*(panel+gap), oy=pad+lab, p=panels[k];
  box(ox,oy);
  ring(ox,oy,p.obs[0],p.obs[1],nearR,[120,200,120]);            // 관찰자 near 반경(초록 링)
  for(const e of p.es){
    const big=e.radius>2.6;                                     // coarse(합쳐진 큰 구체) = 청록·fine = 주황
    disc(ox,oy,e.cx,e.cy,e.radius, big?[90,180,210]:[230,160,80]);
  }
  px(ox+p.obs[0]*cellPx,oy+p.obs[1]*cellPx,255,255,255);        // 관찰자 위치(○)
}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
const ok=fs.existsSync(outPath)
  && lod.entities.length<scene.length                          // coarsen: N↓
  && refined.entities.length>lod.entities.length              // refine: 다가온 곳 fine 복원
  && Math.abs(M1-M0)<=1e-6+1e-9*M0 && Math.abs(M2-M0)<=1e-6+1e-9*M0   // 질량 보존
  && Math.abs(P1-P0)<=1e-6+1e-9*Math.abs(M0) && Math.abs(P2-P0)<=1e-6+1e-9*Math.abs(M0);
console.log('\n=== 눈 검증: 적응 LOD — 멀면 합치고 가까이서 쪼갠다(SW4) ===');
console.log('  개체 수: 원본 '+scene.length+' → coarsen '+lod.entities.length+'(먼 블록당 1) → refine '+refined.entities.length+'(관찰자 다가온 곳 fine)');
console.log('  질량 보존: '+M0.toFixed(1)+' → '+M1.toFixed(1)+' → '+M2.toFixed(1)+' · 운동량 ΣP_x: '+P0.toFixed(2)+' → '+P1.toFixed(2)+' → '+P2.toFixed(2));
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
