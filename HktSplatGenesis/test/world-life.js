// W-Q2a 검증 (순수 Node) — 게놈 생명 층이 스폰 규칙의 단일 원본이 되는가:
//  ① 게놈 밀도 → 바이옴별 나무 수 (meadow ≫ highland ≥ shore, biomeDensity 비례)
//  ② 하위 호환: life 없으면 기본(BIOME_TREE 폴백) 거동 불변 (기존 world-scatter 회귀 안전)
//  ③ rock 은 rockDensity>0 일 때만 (Bake 전용 종)
//  ④ 스트리밍 연속성: 원점 다른 두 창의 겹침 후보/식생 스플랫 diff 0 (좌표 해시 결정론)
//  ⑤ Bake 식생: 게놈 생명 층으로 나무·바위 스플랫 PLY 생성(정점>0, 헤더 정상)
//  ⑥ world-profile 생명 밴드: 정상 accept · 과범위 reject
//
// 브라우저/GPU 불필요. 사용: node world-life.js
const T = require('../js/terrain-gen.js');
const WP = require('../js/world-profile.js');
require('../js/scatter.js');
const S = global.HktGenesisScatter;
const V = require('../js/vegetation.js');

let pass = 0, fail = 0;
const ok = (name, cond, info) => { console.log(`  ${cond ? 'OK ' : 'FAIL'} · ${name}${info ? ' — ' + info : ''}`); cond ? pass++ : fail++; };

const raw = require('../tools/world-extract/genomes/breeze-meadow.json');
const src = {}; for (const k in raw) if (k[0] !== '_') src[k] = raw[k];
const genome = Object.assign({ seed: 7, extent: 90 }, src);
const chunk = T.create(genome);

// ── ① 게놈 밀도 → 바이옴별 나무 수 ──
const cands = S.candidates(chunk, 0, 0, 60, { life: chunk.params.life });
const treeByBiome = {}; let rocks = 0, trees = 0;
for (const c of cands) {
	if (c.kind === 'tree') { trees++; treeByBiome[c.biome] = (treeByBiome[c.biome] || 0) + 1; }
	else if (c.kind === 'rock') rocks++;
}
ok('meadow 나무 ≫ highland (게놈 밀도 1.0 vs 0.22)', (treeByBiome.meadow || 0) > (treeByBiome.highland || 0) * 2,
	`meadow ${treeByBiome.meadow || 0} · highland ${treeByBiome.highland || 0} · shore ${treeByBiome.shore || 0}`);
ok('나무 다수 생성', trees > 30, `trees ${trees}`);

// ── ② 하위 호환: life 없으면 기본 거동 (rock 0, tree 존재) ──
const plain = T.create(Object.assign({ seed: 7, extent: 90 }, { amp: 0.9, scale: 3.0, octaves: 4, base: 0.5 }));
const cPlain = S.candidates(plain, 0, 0, 40); // life 없음 → BIOME_TREE 폴백
const rockPlain = cPlain.filter((c) => c.kind === 'rock').length;
ok('life 없음 → rock 0 (기존 거동)', rockPlain === 0, `rock ${rockPlain}, tree ${cPlain.filter((c) => c.kind === 'tree').length}`);

// ── ③ rock 은 rockDensity>0 일 때만 ──
ok('게놈 rockDensity>0 → rock 생성', rocks > 0, `rocks ${rocks}`);

// ── ④ 스트리밍 연속성: 원점 다른 두 창의 겹침 diff 0 ──
// 같은 월드좌표를 두 창에서 조회 → 같은 스폰(좌표 해시). 창 A(중심 0), 창 B(중심 24,0) 겹침대 비교.
function keySet(cx, cz, r) {
	const m = {}; for (const c of S.candidates(chunk, cx, cz, r, { life: chunk.params.life })) m[c.key] = c.kind + '@' + c.x.toFixed(3) + ',' + c.z.toFixed(3);
	return m;
}
const A = keySet(0, 0, 40), B = keySet(24, 0, 40);
let overlap = 0, diff = 0;
for (const k in A) if (k in B) { overlap++; if (A[k] !== B[k]) diff++; }
ok('겹침 후보 diff 0 (스트리밍 연속성)', overlap > 0 && diff === 0, `겹침 ${overlap} · diff ${diff}`);

// ── ⑤ Bake 식생 PLY ──
const veg = V.bakePanorama(chunk, 90 * 0.875, 0, 0, {});
const hdrOk = veg.ply && new TextDecoder().decode(veg.ply.subarray(0, 64)).startsWith('ply\nformat binary_little_endian');
ok('Bake 식생 PLY 생성(나무+바위)', !!veg.ply && veg.trees > 0 && veg.rocks > 0 && hdrOk,
	`나무 ${veg.trees} · 바위 ${veg.rocks} · bytes ${veg.ply ? veg.ply.length : 0}`);
// mergePly 정점 수 = 지형 + 식생 합
const vcount = (u8) => parseInt(/element vertex (\d+)/.exec(new TextDecoder().decode(u8.subarray(0, 300)))[1], 10);
const terr = chunk.plyBytes(160, 1.0);
const merged = V.mergePly(terr, veg.ply);
ok('mergePly 정점 = 지형+식생 합', vcount(merged) === vcount(terr) + vcount(veg.ply),
	`merged ${vcount(merged)} = 지형 ${vcount(terr)} + 식생 ${vcount(veg.ply)}`);

// ── ⑥ world-profile 생명 밴드 ──
ok('정상 life accept', WP.validate(genome).ok, JSON.stringify(WP.validate(genome).violations));
const bad = Object.assign({}, genome, { life: Object.assign({}, genome.life, { treeDensity: 1.8, treeSize: 5 }) });
const badV = WP.validate(bad);
ok('과범위 life reject', !badV.ok && badV.violations.some((v) => v.field === 'life.treeDensity'),
	'위반 ' + JSON.stringify(badV.violations.map((v) => v.field)));

console.log(`\n판정: 통과 ${pass} · 실패 ${fail} → ${fail ? '실패' : 'OK'}`);
process.exit(fail ? 1 : 0);
