// HktSplatGenesis — 스캐터·개체 스트리밍 (T4, classic script)
//
// 절차 월드의 결정론 스폰 테이블(terrain-gen world.scatter)에서 카메라 반경 안 후보를
// 뽑아 거리순으로 엔진 개체 슬롯에 채운다. 멀어진 스폰은 void 로, 가까워진 스폰은 빈
// 슬롯으로 — 개체 상한 8을 "슬롯 재활용"으로 넘겨 월드를 나무·바위로 채운다. 슬롯 교체는
// engine.setEntitySlot(부분 업로드)로만 — setScene 전체 재초기화 없음(장면·성장 시계 보존).
//
// 절대 원칙 2: 새 존재는 새 코드 경로가 아니라 유전자 값 — kind → 프리셋 매핑뿐이다.

(function (global) {
	'use strict';

	const KIND_PRESET = { tree: '나무', rock: '돌골렘', slime: '슬라임', fire: '불의 정령' };
	const KIND_Y = { tree: 0.3, rock: 0.25, slime: 0.5, fire: 0.6 }; // 지상고(0.x m) — 엔진이 지형 높이 가산

	const G = () => global.HktGenesisGenes;

	// 비활성 슬롯: 화면 밖(opacity 0 = 렌더 VS 컬) + 격자 밖(y=64) + 불활성 — editor void 패딩과 동일 원리
	function voidGenes() {
		const g = G().materialize(G().PRESETS['슬라임'], [0, 64, 0]);
		g.opacity = 0; g.binding = 0; g.cohesion = 0; g.gravity = 0; g.viscosity = 0;
		g.mortality = 0; g.lifeBase = 1e9; g.growRate = 0; g.heatEmit = 0; g.fleshK = 0; g.form = 0;
		return g;
	}

	function genesFor(sp) {
		const preset = KIND_PRESET[sp.kind] || '슬라임';
		const y = KIND_Y[sp.kind] != null ? KIND_Y[sp.kind] : 0.4;
		return G().materialize(G().PRESETS[preset], [sp.x, y, sp.z]);
	}

	let engine = null, world = null, cfg = null;
	let slotKey = [];          // slot -> 스폰 key (또는 null=void)
	let lastCenterKey = null;

	// 관리 슬롯 [slotStart, slotStart+slotCount) 를 스트리밍에 쓴다. 앞쪽 슬롯은 고정 개체용으로 예약 가능.
	function configure(eng, w, opts) {
		engine = eng; world = w;
		cfg = Object.assign({ radius: 22, slotStart: 0, slotCount: 8, cell: 6, density: 0.5 }, opts);
		slotKey = new Array(eng.entities.length).fill(null);
		for (let i = 0; i < cfg.slotCount; i++) { engine.setEntitySlot(cfg.slotStart + i, voidGenes()); }
		lastCenterKey = null;
	}

	// 카메라 월드 좌표로 활성 스폰 갱신. 중심이 2m 이상 움직였을 때만 재계산(값싸다).
	function update(cx, cz, opts) {
		if (!world) return;
		const ck = Math.round(cx / 2) + ',' + Math.round(cz / 2);
		if (!(opts && opts.force) && ck === lastCenterKey) return;
		lastCenterKey = ck;
		const R = cfg.radius, s0 = cfg.slotStart, sc = cfg.slotCount;
		const near = world.scatter(cx - R, cz - R, 2 * R, { cell: cfg.cell, density: cfg.density })
			.filter((s) => Math.hypot(s.x - cx, s.z - cz) <= R)
			.sort((a, b) => (a.x - cx) * (a.x - cx) + (a.z - cz) * (a.z - cz) - ((b.x - cx) * (b.x - cx) + (b.z - cz) * (b.z - cz)))
			.slice(0, sc);
		const want = new Set(near.map((s) => s.key));
		// 1) 범위 이탈 슬롯 → void
		for (let i = 0; i < sc; i++) { const s = s0 + i; if (slotKey[s] && !want.has(slotKey[s])) { engine.setEntitySlot(s, voidGenes()); slotKey[s] = null; } }
		// 2) 새 스폰 → 빈 슬롯 (이미 든 스폰은 그대로 — 성장 시계 보존, 불필요한 재시드 없음)
		const held = new Set(); for (let i = 0; i < sc; i++) if (slotKey[s0 + i]) held.add(slotKey[s0 + i]);
		for (const sp of near) {
			if (held.has(sp.key)) continue;
			let slot = -1; for (let i = 0; i < sc; i++) { const s = s0 + i; if (!slotKey[s]) { slot = s; break; } }
			if (slot < 0) break; // 슬롯 없음 — 더 먼 스폰은 이번엔 생략
			engine.setEntitySlot(slot, genesFor(sp)); slotKey[slot] = sp.key; held.add(sp.key);
		}
	}

	// 하니스/디버그: 활성 스폰 목록 (슬롯·key·emitter)
	function active() {
		const out = [];
		for (let i = 0; i < cfg.slotCount; i++) { const s = cfg.slotStart + i; if (slotKey[s]) out.push({ slot: s, key: slotKey[s], emitter: engine.entities[s].emitter }); }
		return out;
	}

	const api = { configure, update, active, genesFor, voidGenes, KIND_PRESET };
	global.HktGenesisScatter = api;
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
