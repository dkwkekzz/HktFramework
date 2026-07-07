// HktSplatGenesis — 스캐터·개체 스트리밍 (T4, classic script, 의존성 없음)
//
// "무대는 로드, 생명은 배양"의 오픈월드 판 — 지형(무대)이 T2 링으로 스트리밍되면 생명도
// 같은 원리로 스트리밍된다. 두 조각:
//   ① 결정론 스폰 테이블 `candidates(world, cx, cz, r)` — 월드 함수(terrain-gen) 위에서
//      좌표·시드 해시로 후보를 뽑는다. 청크(창)와 독립: 어느 좌표든 같은 시드 = 같은 스폰
//      (T2 청크 경계 연속성과 같은 원리). Math.random 금지 — 지터·판정 전부 latticeHash.
//   ② `ScatterStream` — 카메라 타깃 주변 거리순 상위 k 스폰만 개체 슬롯(≤8)에 활성화하고,
//      멀어진 슬롯은 가까워진 스폰으로 교체한다. 엔진 슬롯 증분 교체(engine.respawnEntity)를
//      쓰므로 교체 안 된 슬롯의 생명은 계속 시뮬된다(재시드 없음).
//
// 다채로움: 바이옴별 스폰 밀도(숲·평야 무성, 사막·설원 성김, 수역 없음)로 지형 성격에 맞춰
// 생명이 분포한다. 불×나무: 일부 나무 곁에 모닥불 스폰을 함께 두어(호스트 나무와 같은 셀)
// 두 개체가 나란히 스트리밍되면 공유 격자에서 연소가 창발한다 — 임의 월드 좌표에서 성립.

(function (global) {
	'use strict';

	// 정수 격자 해시 → [0,1) — terrain-gen.latticeHash 와 같은 계열(시드 포함 결정론)
	function hash(ix, iz, seed) {
		let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2246822519)) | 0;
		h = Math.imul(h ^ (h >>> 13), 1274126177);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	}

	// 경사(기울기 크기) — heightAt 중심차분. 급경사(절벽) 스폰 배제용.
	function slopeAt(world, x, z, e) {
		e = e || 0.6;
		const hx = world.heightAt(x + e, z) - world.heightAt(x - e, z);
		const hz = world.heightAt(x, z + e) - world.heightAt(x, z - e);
		return Math.hypot(hx, hz) / (2 * e);
	}

	// 바이옴별 나무 밀도 배수 — 다채로움(지형 성격에 맞는 생명 분포). 미상 바이옴은 중립(0.5).
	const BIOME_TREE = {
		plains: 1.0, mountain: 0.7, desert: 0.12, snow: 0.22, water: 0,
		ashflat: 0.35, lavaridge: 0.12, ashdune: 0.18,
	};
	function biomeDensity(key, base) {
		const f = (key in BIOME_TREE) ? BIOME_TREE[key] : 0.5;
		return base * f;
	}

	// 결정론 스폰 후보 — cx,cz 중심 반경 radius 안. 각 스폰은 안정 key(셀 인덱스 기반)로
	// 식별되므로 프레임이 바뀌어도 같은 스폰은 같은 슬롯을 유지한다(재시드 없음의 근거).
	// 반환: [{ x, y, z, kind:'tree'|'campfire', key, biome, host? }]
	function candidates(world, cx, cz, radius, cfg) {
		cfg = Object.assign({ cell: 6.0, treeDensity: 0.5, campfireRate: 0.16, maxSlope: 1.2, jitter: 0.7 }, cfg);
		const seed = ((world.params && world.params.seed) | 0) || 0;
		const cell = cfg.cell, waterY = (world.waterY != null ? world.waterY : -1e9);
		const out = [];
		const u0 = Math.floor((cx - radius) / cell), u1 = Math.floor((cx + radius) / cell);
		const v0 = Math.floor((cz - radius) / cell), v1 = Math.floor((cz + radius) / cell);
		for (let v = v0; v <= v1; v++)
			for (let u = u0; u <= u1; u++) {
				const jx = hash(u, v, seed + 13) - 0.5, jz = hash(u, v, seed + 29) - 0.5;
				const x = (u + 0.5) * cell + jx * cell * cfg.jitter;
				const z = (v + 0.5) * cell + jz * cell * cfg.jitter;
				const dx = x - cx, dz = z - cz;
				if (dx * dx + dz * dz > radius * radius) continue;
				const y = world.heightAt(x, z);
				if (y < waterY + 0.15) continue;                       // 수역·물가 제외
				if (slopeAt(world, x, z) > cfg.maxSlope) continue;     // 급경사(절벽) 제외
				const b = world.biomeAt(x, z);
				if (hash(u, v, seed + 101) > biomeDensity(b.key, cfg.treeDensity)) continue;
				const key = 't:' + u + ',' + v;
				out.push({ x, y, z, kind: 'tree', key, biome: b.key });
				// 일부 나무 곁 모닥불 — 호스트 나무와 같은 셀에서 함께 스트리밍(불×나무 실증)
				if (hash(u, v, seed + 777) < cfg.campfireRate) {
					const fx = x + 0.6, fz = z;
					out.push({ x: fx, y: world.heightAt(fx, fz), z: fz, kind: 'campfire', key: 'f:' + u + ',' + v, host: key });
				}
			}
		return out;
	}

	// 무(void) 개체 — 슬롯 패딩 전용(비활성 슬롯). editor.js VOID_ENTITY 와 동일 규약:
	// 모든 힘 0 + opacity 0(렌더 조기 컬) + emitter y=64(격자 밖이라 이웃 규칙 오염 없음).
	function voidEntity() {
		return {
			cohesion: 0, volatility: 0, updraft: 0, damping: 1, lifeBase: 9999, emitRadius: 0.1,
			flowFreq: 1, flowSpeed: 0, size: 0.005, stretch: 0, opacity: 0, luminosity: 0,
			gravity: 0, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.06, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: [0, 0, 0, 1], colorB: [0, 0, 0, 1], form: 0, emitter: [0, 64, 0],
		};
	}

	// 후보 종류 → 시뮬 입력 유전자. 프리셋(presets.js)을 원본으로 삼되 스폰 위치를 emitter 에
	// 심는다. 나무는 form 2(가지 골격), 모닥불은 축소한 불 정령(app.js 불×나무 튜닝과 동일).
	function genesFor(cand) {
		const G = global.HktGenesisGenes;
		if (!G) throw new Error('presets.js(HktGenesisGenes) 선행 필요');
		const P = G.PRESETS;
		if (cand.kind === 'campfire') {
			const g = G.materialize(P['불의 정령'], [cand.x, 0.35, cand.z]);
			g.emitRadius = 0.22; g.lifeBase = 1.0; g.updraft = 1.5; g.size = 0.03;
			return g;
		}
		return G.materialize(P['나무'], [cand.x, 0.6, cand.z]); // 뿌리 y 는 엔진이 지형 높이로
	}

	// ── 스트리밍 관리: 슬롯 배정 diff → engine.respawnEntity ──────────────────
	// engine.setScene(N, [슬롯 개수만큼의 개체])가 선행돼야 한다(슬롯 = 개체 슬라이스).
	// opts: { radius, maxActive, reserve, cell, treeDensity, campfireRate, maxSlope }
	//   reserve: 앞쪽 예약 슬롯 수 — 스캐터가 건드리지 않는다(슬라이더 개체 등 고정 개체용).
	function ScatterStream(engine, world, opts) {
		this.engine = engine;
		this.world = world;
		this.opts = Object.assign({ radius: 16, cell: 6.0, treeDensity: 0.5, campfireRate: 0.16, maxSlope: 1.2 }, opts);
		const slots = (engine.entities && engine.entities.length) || 0;
		if (!slots) throw new Error('setScene 선행 필요 (엔진 슬롯 없음)');
		this.reserve = this.opts.reserve || 0;
		this.maxActive = Math.min(this.opts.maxActive || (slots - this.reserve), slots - this.reserve);
		this.keyAt = new Array(slots).fill(null); // 슬롯 → 스폰 key(비활성 null)
		this.slotOf = {};                          // 스폰 key → 슬롯
	}

	// 카메라 타깃(월드 xz)으로 활성 스폰을 갱신. 거리순 상위 maxActive 를 활성, 나머지는 void.
	// 반환: { active, spawned, removed, candidates } (하니스 지표).
	ScatterStream.prototype.update = function (cx, cz) {
		const cands = candidates(this.world, cx, cz, this.opts.radius, this.opts);
		for (let i = 0; i < cands.length; i++) {
			const c = cands[i]; c.d2 = (c.x - cx) * (c.x - cx) + (c.z - cz) * (c.z - cz);
		}
		cands.sort((a, b) => a.d2 - b.d2);
		const want = cands.slice(0, this.maxActive);
		const wantKeys = new Set();
		for (const c of want) wantKeys.add(c.key);
		let spawned = 0, removed = 0;
		// 떠난 스폰 → 슬롯 반납(void)
		for (let s = this.reserve; s < this.keyAt.length; s++) {
			const k = this.keyAt[s];
			if (k && !wantKeys.has(k)) { this.engine.respawnEntity(s, voidEntity()); this.keyAt[s] = null; delete this.slotOf[k]; removed++; }
		}
		// 새 스폰 → 빈 슬롯 배정 (이미 활성인 스폰은 건드리지 않음 = 재시드 없음)
		for (const c of want) {
			if (this.slotOf[c.key] != null) continue;
			let s = -1;
			for (let i = this.reserve; i < this.keyAt.length; i++) if (this.keyAt[i] === null) { s = i; break; }
			if (s < 0) break; // 남는 슬롯 없음 (거리순이라 가장 가까운 것들이 이미 차 있음)
			this.keyAt[s] = c.key; this.slotOf[c.key] = s;
			this.engine.respawnEntity(s, genesFor(c));
			spawned++;
		}
		return { active: Object.keys(this.slotOf).length, spawned, removed, candidates: cands.length };
	};

	ScatterStream.prototype.activeKeys = function () { return Object.keys(this.slotOf); };
	ScatterStream.prototype.slotForKey = function (k) { return this.slotOf[k]; };

	const api = { candidates, genesFor, voidEntity, slopeAt, ScatterStream };
	global.HktGenesisScatter = api;
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
