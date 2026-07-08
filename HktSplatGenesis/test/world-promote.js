// W-Q2c 검증 (순수 Node) — 승격 훅: 시뮬로 올라간 나무를 Bake 식생에서 빼는가:
//  ① 승격 key ⊆ Bake 후보 key (시뮬·Bake 가 같은 셀 격자 공유 = 제외가 실효 있음의 전제)
//  ② excludeKeys → Bake 후보에서 그 key 만 정확히 빠짐(나머지 diff 0, 승격 나무만 사라짐)
//  ③ vegetation.bakePanorama(excludeKeys) → 나무 수 = (제외 전) − (창 안 승격 나무 수)
//  ④ 강등(카메라 이동): 승격 집합 바뀌면 이전 승격 나무가 Bake 에 되돌아옴
//  ⑤ 하위 호환: excludeKeys 없으면 거동 불변(기존 world-life·world-scatter 회귀 안전)
//
// ScatterStream 은 GPU 없이 목 엔진(entities·respawnEntity)으로 구동. 브라우저 불필요.
// 사용: node world-promote.js
const T = require('../js/env/terrain-gen.js');
require('../js/shared/scatter.js');
const S = global.HktGenesisScatter;
const V = require('../js/env/vegetation.js');

let pass = 0, fail = 0;
const ok = (name, cond, info) => { console.log(`  ${cond ? 'OK ' : 'FAIL'} · ${name}${info ? ' — ' + info : ''}`); cond ? pass++ : fail++; };

const raw = require('../tools/world-extract/genomes/breeze-meadow.json');
const src = {}; for (const k in raw) if (k[0] !== '_') src[k] = raw[k];
const world = T.world(Object.assign({ seed: 7 }, src));

// app.js startOpenWorld 이 스트림·Bake 에 주는 것과 동일한 셀 격자(cell 3.4·maxSlope 2.2·jitter 0.8)
// — 이게 맞아야 승격 key 가 Bake key 와 정확히 일치한다.
const CFG = { cell: 3.4, maxSlope: 2.2, jitter: 0.8, campfireRate: 0.2 };
const STREAM_OPTS = Object.assign({ radius: 16, maxActive: 8 }, CFG);

// 목 엔진 — ScatterStream 이 필요로 하는 최소 계약(entities 길이 = 슬롯, respawnEntity(slot, genes))
function mockEngine(slots) {
	return { entities: Array.from({ length: slots }, () => ({})), respawnEntity(s, g) { this.entities[s] = g; } };
}
// presets.js 는 `})(window)` 라 Node 에서 못 실린다 — genesFor 가 참조하는 최소 스텁만 심는다
// (이 검증의 대상은 유전자 내용이 아니라 승격 key 좌표계 정합이라 스텁으로 충분).
global.HktGenesisGenes = { PRESETS: { '나무': {}, '불의 정령': {} }, materialize: (p, e) => ({ emitter: e.slice(), size: 1, emitRadius: 1 }) };

// ── 승격: 원점에서 스트림 갱신 ──
const stream = new S.ScatterStream(mockEngine(8), world, STREAM_OPTS);
const res = stream.update(0, 0);
const promoted = stream.promotedKeys();
const promotedTrees = [...promoted].filter((k) => k[0] === 't');
ok('승격 발생(≤8 슬롯, 나무 다수)', res.active > 0 && promoted.size > 0 && promotedTrees.length > 0,
	`active ${res.active} · 승격 ${promoted.size}(나무 ${promotedTrees.length}) · 후보 ${res.candidates}`);

// ── ① 승격 key ⊆ Bake 후보 key (같은 격자 공유) ──
const bakeR = 20; // 스트림 radius 16 을 덮는 창
const bakeKeys = new Set(S.candidates(world, 0, 0, bakeR, Object.assign({}, CFG, { life: world.params.life })).map((c) => c.key));
const allIn = promotedTrees.every((k) => bakeKeys.has(k));
ok('승격 나무 key ⊆ Bake 후보 key (격자 공유 = 제외 실효)', allIn,
	`누락 ${promotedTrees.filter((k) => !bakeKeys.has(k)).length}/${promotedTrees.length}`);

// ── ②/⑤ excludeKeys → 그 key 만 정확히 빠짐, 나머지 diff 0 ──
const base = S.candidates(world, 0, 0, bakeR, Object.assign({}, CFG, { life: world.params.life }));
const excl = S.candidates(world, 0, 0, bakeR, Object.assign({}, CFG, { life: world.params.life, excludeKeys: promoted }));
const baseKeys = base.map((c) => c.key), exclKeys = new Set(excl.map((c) => c.key));
const removed = baseKeys.filter((k) => !exclKeys.has(k));
const removedAllPromoted = removed.every((k) => promoted.has(k));
const nonExcludedIntact = base.filter((c) => !promoted.has(c.key)).every((c) => exclKeys.has(c.key));
ok('excludeKeys 는 승격 key 만 제거(나머지 diff 0)', removed.length > 0 && removedAllPromoted && nonExcludedIntact,
	`제거 ${removed.length} · 전부승격 ${removedAllPromoted} · 나머지보존 ${nonExcludedIntact}`);
// 하위 호환: excludeKeys 없으면 원본과 동일
ok('excludeKeys 없음 → 후보 불변(회귀 안전)', baseKeys.length === S.candidates(world, 0, 0, bakeR, Object.assign({}, CFG, { life: world.params.life })).length,
	`후보 ${baseKeys.length}`);

// ── ③ vegetation.bakePanorama(excludeKeys) 나무 수 감소 = 창 안 승격 나무 수 ──
const extent = 40; // 창 반폭 — 스트림 radius 16 보다 넉넉(모든 승격 나무 포함)
const veg0 = V.bakePanorama(world, extent, 0, 0, CFG);
const vegX = V.bakePanorama(world, extent, 0, 0, Object.assign({}, CFG, { excludeKeys: promoted }));
// 창(±extent) 안 승격 나무 수 — bakePanorama 가 세는 것과 같은 사각 컷
const promotedTreeInWin = base.filter((c) => c.kind === 'tree' && promoted.has(c.key)
	&& Math.abs(c.x) <= extent && Math.abs(c.z) <= extent).length;
ok('Bake 식생 나무 수 = 제외 전 − 승격 나무(정적 사본 제거)',
	veg0.trees > 0 && vegX.trees === veg0.trees - promotedTreeInWin && promotedTreeInWin > 0,
	`나무 ${veg0.trees}→${vegX.trees} (승격 ${promotedTreeInWin})`);

// ── ④ 강등: 카메라를 멀리 옮기면 승격 집합이 바뀌고, 원래 승격 나무가 Bake 에 되돌아옴 ──
stream.update(120, 0);
const promoted2 = stream.promotedKeys();
const changed = [...promoted].some((k) => !promoted2.has(k)); // 원점 승격 중 일부는 강등됨
const vegBack = V.bakePanorama(world, extent, 0, 0, Object.assign({}, CFG, { excludeKeys: promoted2 }));
// 원점 근처 Bake 는 이제 promoted2(먼 곳)를 제외 → 원점 승격 나무가 되돌아와 veg0 에 근접
ok('강등 → 이전 승격 나무 Bake 복귀', changed && vegBack.trees > vegX.trees && vegBack.trees === veg0.trees,
	`승격 원점 ${promoted.size}→이동후 ${promoted2.size} · 나무 복귀 ${vegX.trees}→${vegBack.trees}(원본 ${veg0.trees})`);

console.log(`\n판정: 통과 ${pass} · 실패 ${fail} → ${fail ? '실패' : 'OK'}`);
process.exit(fail ? 1 : 0);
