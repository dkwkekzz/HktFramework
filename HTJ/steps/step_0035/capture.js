// step_0035/capture.js — 눈 검증(engine 직접 PNG): 복셀 별 → 구체 승격 → 구체들이 서로 상호작용.
//
//   사용자 요구 장면: 여러 조밀 덩어리(복셀)가 동결→자동 승격으로 *전부* 구체(개체)가 되고(복셀 사라짐),
//   구체들이 서로 중력으로 끌려 궤도·상호작용한다. 4 프레임(top-down z=중심): 복셀 별 6개 → 막 승격된
//   구체 6개(복셀 0) → 궤도로 흩어진 구체 → 더 진행. = "복셀 안 보이고 구체로 표현되어 상호작용."
//
//   실행: node HTJ/steps/step_0035/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));
const Ac = require(path.resolve(__dirname, '../../engine/htj-activity.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Hy = require(path.resolve(__dirname, '../../engine/htj-hybrid.js'));

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td),0);return Buffer.concat([l,td,cr]);}
function writePNG(file,w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}fs.writeFileSync(file,Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}

const N=32, BS=8, CEN=15.5, ZC=16;
const w=W.createWorld(N); w.addField('therm');
for(const nm of ['mom_x','mom_y','mom_z']) w.addField(nm,{type:Float64Array});
const POS=[[8,16],[24,16],[16,8],[16,24],[10,10],[22,22]];
for(const pq of POS){const cx=pq[0],cy=pq[1];
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=x-cx,dy=y-cy,dz=z-ZC;
    if(dx*dx+dy*dy+dz*dz<=6.25){const i=(z*N+y)*N+x;w.fields.energy[i]=10;w.fields.therm[i]=3;
      w.fields.mom_x[i]=10*(-0.5*(cy-CEN)/8);w.fields.mom_y[i]=10*(0.5*(cx-CEN)/8);}}}
const H={set:Sp.createActiveSet(N,BS),tracker:Ac.createActivityTracker(N,BS),entities:[]};
const COLORS=[[250,180,90],[90,180,250],[160,230,120],[250,120,160],[200,160,250],[250,230,120]];
function entColor(i){return COLORS[i%COLORS.length];}

// 슬라이스 복셀(z=ZC) 스냅 + 개체 위치 스냅.
function snap(){const s=new Float64Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++)s[y*N+x]=w.fields.energy[(ZC*N+y)*N+x];
  return {vox:s, ents:H.entities.map(e=>({cx:e.cx,cy:e.cy,r:e.radius}))};}
function stepOnce(){
  H.set.rebuildFromField(w.fields.energy);
  const mean=w.total('energy')/w.fields.energy.length;
  H.tracker.measure(w.fields.energy,H.set.origins(),{threshold:0});
  const res=Hy.autoPromoteStable(w,H.tracker,{hold:2,eps:Math.max(mean*3,1e-9)});
  for(const e of res.entities)H.entities.push(e);
  if(H.entities.length>=2) En.applyEntityGravity(H.entities,0.2,{G:0.8,soft:3});
  En.stepEntities(H.entities,0.2,{N});
}
const frames=[];
frames.push(snap());          // f0: 복셀 별
for(let i=0;i<3;i++)stepOnce(); frames.push(snap());   // 승격 직후
for(let i=0;i<14;i++)stepOnce(); frames.push(snap());  // 궤도
for(let i=0;i<16;i++)stepOnce(); frames.push(snap());  // 더 진행

const cellPx=6, panel=N*cellPx, gap=18, pad=20, lab=18;
const Wd=pad*2+panel*4+gap*3, Hd=pad*2+lab+panel;
const out=Buffer.alloc(Wd*Hd*4);
for(let i=0;i<out.length;i+=4){out[i]=12;out[i+1]=14;out[i+2]=20;out[i+3]=255;}
function px(x,y,r,g,b){x|=0;y|=0;if(x<0||y<0||x>=Wd||y>=Hd)return;const o=(y*Wd+x)*4;out[o]=r;out[o+1]=g;out[o+2]=b;}
function cell(ox,oy,r,g,b){for(let dy=0;dy<cellPx;dy++)for(let dx=0;dx<cellPx;dx++)px(ox+dx,oy+dy,r,g,b);}
function box(ox,oy){for(let x=0;x<=panel;x++){px(ox+x,oy,42,50,66);px(ox+x,oy+panel,42,50,66);}for(let y=0;y<=panel;y++){px(ox,oy+y,42,50,66);px(ox+panel,oy+y,42,50,66);}}
function disc(ox,oy,cx,cy,rad,col){const sx=ox+cx*cellPx,sy=oy+cy*cellPx,rp=Math.max(cellPx*1.4,rad*cellPx),r2=rp*rp;
  for(let dy=-rp;dy<=rp;dy++)for(let dx=-rp;dx<=rp;dx++){const d2=dx*dx+dy*dy;if(d2>r2)continue;const f=0.5+0.5*(1-Math.sqrt(d2)/rp);px(sx+dx,sy+dy,(col[0]*f)|0,(col[1]*f)|0,(col[2]*f)|0);}}
for(let k=0;k<4;k++){
  const ox=pad+k*(panel+gap), oy=pad+lab;
  box(ox,oy);
  const fr=frames[k];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const v=fr.vox[y*N+x];if(v>1e-9)cell(ox+x*cellPx,oy+y*cellPx,70,110,180);}
  for(let e=0;e<fr.ents.length;e++)disc(ox,oy,fr.ents[e].cx,fr.ents[e].cy,fr.ents[e].r,entColor(e));
}
const outPath=path.join(__dirname,'capture.png');
writePNG(outPath,Wd,Hd,out);
const ok=fs.existsSync(outPath)&&frames[0].vox.some(v=>v>0)&&frames[1].ents.length===POS.length&&!frames[1].vox.some(v=>v>1e-9);
console.log('\n=== 눈 검증: 복셀 별 → 구체 승격 → 구체들이 상호작용 ===');
console.log('  4 프레임: '+frames.map((f,i)=>`구체 ${f.ents.length}·복셀 ${f.vox.filter(v=>v>1e-9).length}`).join(' → '));
console.log('  스크린샷: '+path.relative(process.cwd(),outPath));
console.log('\n결과: '+(ok?'눈 검증 PASS ✅':'FAIL ❌')+'\n');
process.exit(ok?0:1);
