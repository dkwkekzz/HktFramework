// 샘플 지형 에셋 생성 — assets/worlds/sample-terrain.{ply,glb} (+정합 사이드카)
// Marble 월드가 없어도 무대 탭 [샘플 지형] 버튼이 바로 동작하도록 repo 에 커밋되는
// 유일한 월드 에셋. test/_fixture.js 의 height() 를 공유하므로 하니스 지형과 동일 지물.
//
// 재생성: node tools/gen-sample-terrain.js
const fs = require('fs');
const path = require('path');
const { genTerrainPly, genTerrainGlb } = require('../test/_fixture');

const outDir = path.join(__dirname, '..', 'assets', 'worlds');
fs.mkdirSync(outDir, { recursive: true });

// 밀도 상향(160² = 25.6k 스플랫) + 개별 크기 축소 — 하니스(72²)보다 촘촘한 표면
const ply = genTerrainPly(160, 0.55);
const glb = genTerrainGlb(128);
fs.writeFileSync(path.join(outDir, 'sample-terrain.ply'), ply);
fs.writeFileSync(path.join(outDir, 'sample-terrain.glb'), glb);
// 정합 사이드카 — 생성 지형은 이미 생명 좌표계라 항등
fs.writeFileSync(path.join(outDir, 'sample-terrain.ply.json'),
	JSON.stringify({ x: 0, y: 0, z: 0, scale: 1, yawDeg: 0, flip: false }, null, '\t') + '\n');
console.log(`sample-terrain.ply ${(ply.length / 1e6).toFixed(2)}MB · sample-terrain.glb ${(glb.length / 1e6).toFixed(2)}MB`);
