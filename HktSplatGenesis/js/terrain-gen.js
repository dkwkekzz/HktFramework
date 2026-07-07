// HktSplatGenesis — 절차 지형 생성기 (classic script, 의존성 없음)
//
// T 트랙 핵심: 월드는 `world(x, z) → { height, biome }` 인 **순수 결정론 함수**이고,
// 청크(=창)는 이 함수를 들여다보는 창일 뿐이다. 시드 + 월드 좌표만으로 어느 창이든
// 독립 생성할 수 있으므로 창 경계 연속성이 자동 보장된다 (봉합 코드 불필요).
// 모든 지터·스캐터는 좌표·시드 해시로 — Math.random 금지 (기존 컨벤션).
//
// 이 함수에서 같은 원본으로부터
//  ① 무대 비주얼용 3DGS PLY 바이트 (stage.js → Spark 로드) — 바이옴 팔레트
//  ② 시뮬 collider 용 삼각형 수프 (heightfield.bake 입력 — GLB 왕복 없이 직접)
// 를 굽는다. 무대는 "로드 대상"이므로 지형을 코드로 생성하는 것은 절대 원칙 1 위배가
// 아니다 (생명이 아님 — DESIGN.md 2층 세계 결정 참조).
//
// 다채로움: 저주파 2채널(온도·습도) → 바이옴(평야/산악/사막/설원 + 수역) 을 경계에서
// 보간해 지형 성격(진폭·ridged 비중)과 색을 함께 바꾼다. domain warp 로 격자감을 지우고,
// ridged multifractal 로 산맥 능선을 만든다.
//
// 버블 y 추종(T3): 시뮬 격자 y 중심이 카메라 밑 지형 높이를 따라오므로(engine.bubbleCenter)
// 골짜기가 깊어도 격자가 함께 내려가 L2 이웃 규칙이 산다. 그래서 창 height() 의 floor 클램프는
// 더 이상 "절대 격자 바닥"이 아니라 느슨한 안전 하한(-3)일 뿐 — 고저차 큰 산·계곡이 가능해진다.
// world.heightAt() 은 클램프 없는 순수 원본.

(function (global) {
	'use strict';

	const SH_C0 = 0.28209479177387814;
	const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
	const mix = (a, b, t) => a + (b - a) * t;

	// 정수 격자 해시 → [0,1) — 시드 포함 결정론 (같은 시드 = 같은 지형)
	function latticeHash(ix, iz, seed) {
		let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2246822519)) | 0;
		h = Math.imul(h ^ (h >>> 13), 1274126177);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	}
	const smooth = (t) => t * t * (3 - 2 * t);

	// value noise 한 옥타브 [0,1]
	function valueNoise(x, z, seed) {
		const ix = Math.floor(x), iz = Math.floor(z);
		const fx = smooth(x - ix), fz = smooth(z - iz);
		const a = latticeHash(ix, iz, seed), b = latticeHash(ix + 1, iz, seed);
		const c = latticeHash(ix, iz + 1, seed), d = latticeHash(ix + 1, iz + 1, seed);
		return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
	}

	// value-fBm — 부호 있는 [-1,1] (옥타브마다 시드·위상 분리로 격자 정렬 아티팩트 방지)
	function fbm(x, z, seed, octaves, lac, gain) {
		lac = lac || 2.03; gain = gain || 0.5;
		let a = 0, w = 1, wsum = 0, f = 1;
		for (let o = 0; o < octaves; o++) {
			a += (valueNoise(x * f + o * 17.17, z * f - o * 9.31, seed + o * 101) * 2 - 1) * w;
			wsum += w; w *= gain; f *= lac;
		}
		return a / wsum;
	}

	// ridged multifractal — [0,1], 능선(1)이 날카롭다. 이전 옥타브가 다음을 게이팅해 능선 강조.
	function ridgedFbm(x, z, seed, octaves, lac, gain) {
		lac = lac || 2.03; gain = gain || 0.5;
		let sum = 0, w = 1, wsum = 0, f = 1, prev = 1;
		for (let o = 0; o < octaves; o++) {
			let n = valueNoise(x * f + o * 13.71, z * f - o * 7.19, seed + o * 131) * 2 - 1;
			n = 1 - Math.abs(n);        // 능선
			n *= n;                     // 날카롭게
			n *= prev;                  // 이전 옥타브 게이팅
			prev = clamp01(n * 2);
			sum += n * w; wsum += w; w *= gain; f *= lac;
		}
		return sum / wsum;
	}

	// 스플랫별 지터 해시 (시드 무관 인덱스 지터 — 창 내부 국소 지터)
	const jitterHash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; return ((x >>> 0) / 4294967296); };

	// ── 바이옴 표 (온도·습도 평면의 점) — W1: 코드 상수에서 게놈 데이터로 승격 ──
	// ampMul: relief 진폭 배수 · ridged: 능선 혼합 비중 · scaleMul: 기복 파장 배수 ·
	// warpMul: domain warp 세기 · lo/hi: 저지대→고지대 색 램프 (설선·설원캡은 hi 로)
	//
	// 아래는 **기본 프리셋(temperate)의 바이옴 셋**일 뿐이다 — world(genome) 은 genome.biomeSet
	// 이 있으면 그것을, 없으면 이 기본값을 쓴다. WATER_ID 는 바이옴 수(= biomeSet.length)로
	// 유도하므로 바이옴 개수가 프리셋마다 달라도 성립한다 (기본 4 → WATER_ID 4, 하위 호환).
	const DEFAULT_BIOMES = [
		{ id: 0, key: 'plains', name: '평야', temp: 0.60, humid: 0.52, ampMul: 0.55, scaleMul: 1.00, ridged: 0.05, warpMul: 0.45,
			lo: [0.12, 0.34, 0.14], hi: [0.42, 0.55, 0.24] },
		{ id: 1, key: 'mountain', name: '산악', temp: 0.40, humid: 0.82, ampMul: 1.95, scaleMul: 1.35, ridged: 0.85, warpMul: 0.90,
			lo: [0.32, 0.30, 0.28], hi: [0.90, 0.92, 0.96] },
		{ id: 2, key: 'desert', name: '사막', temp: 0.88, humid: 0.16, ampMul: 0.50, scaleMul: 1.55, ridged: 0.18, warpMul: 0.70,
			lo: [0.60, 0.48, 0.28], hi: [0.86, 0.76, 0.50] },
		{ id: 3, key: 'snow', name: '설원', temp: 0.13, humid: 0.55, ampMul: 1.00, scaleMul: 1.10, ridged: 0.40, warpMul: 0.55,
			lo: [0.68, 0.76, 0.84], hi: [0.95, 0.97, 1.00] },
	];
	const DEFAULT_WATER = { shallow: [0.16, 0.42, 0.55], deep: [0.06, 0.16, 0.42] };

	// 화산재 황무지 — 3바이옴, 붉은/검은 팔레트, 물 없음(수위 밑바닥). 데이터만으로 성격이
	// 완전히 다른 월드가 나온다는 실증(W1 완료 기준 ②). 온·습도 중심을 넓게 벌려 파노라마에
	// 세 바이옴이 함께 보이게 한다.
	const ASHEN_BIOMES = [
		{ id: 0, key: 'ashflat', name: '재평원', temp: 0.55, humid: 0.30, ampMul: 0.60, scaleMul: 1.10, ridged: 0.10, warpMul: 0.50,
			lo: [0.16, 0.11, 0.10], hi: [0.44, 0.31, 0.26] },
		{ id: 1, key: 'lavaridge', name: '용암능선', temp: 0.88, humid: 0.70, ampMul: 1.90, scaleMul: 1.30, ridged: 0.92, warpMul: 0.95,
			lo: [0.34, 0.10, 0.05], hi: [0.98, 0.46, 0.14] },
		{ id: 2, key: 'ashdune', name: '재사구', temp: 0.22, humid: 0.22, ampMul: 0.50, scaleMul: 1.55, ridged: 0.15, warpMul: 0.70,
			lo: [0.30, 0.26, 0.24], hi: [0.60, 0.55, 0.50] },
	];

	// ── 프리셋 = 월드 게놈의 지형·바이옴·수역 층 (relief 전역 + biomeSet + water + waterY) ──
	// 기본값(temperate)의 relief 노브는 world() 기본값과 바이트 동일 — 프리셋 경유가 현행을 재현.
	const PRESETS = {
		temperate: {
			amp: 0.9, scale: 3.0, octaves: 4, base: 0.5, warpAmp: 0.6, warpScale: 9,
			biomeScale: 40, biomeSharp: 22, waterY: -0.2, biomeSet: DEFAULT_BIOMES, water: DEFAULT_WATER,
		},
		ashen: {
			amp: 1.3, scale: 2.6, octaves: 5, base: 0.35, warpAmp: 0.7, warpScale: 8,
			biomeScale: 34, biomeSharp: 20, waterY: -2.0, biomeSet: ASHEN_BIOMES, water: DEFAULT_WATER,
		},
	};
	// 프리셋 깊은 복사 — 호출자가 게놈을 자유롭게 후보정해도 원본 표가 오염되지 않는다.
	function preset(name) {
		const p = PRESETS[name] || PRESETS.temperate;
		return {
			amp: p.amp, scale: p.scale, octaves: p.octaves, base: p.base, warpAmp: p.warpAmp,
			warpScale: p.warpScale, biomeScale: p.biomeScale, biomeSharp: p.biomeSharp, waterY: p.waterY,
			water: { shallow: p.water.shallow.slice(), deep: p.water.deep.slice() },
			biomeSet: p.biomeSet.map((b) => Object.assign({}, b, { lo: b.lo.slice(), hi: b.hi.slice() })),
		};
	}

	// ── 월드 함수: 순수 무한 도메인 world(x,z) ───────────────────────────────
	// params: { seed, amp(전역 진폭), scale(기복 파장 m), octaves, base(평균 높이),
	//           biomeScale(온·습도 파장 m), warpAmp/warpScale(domain warp),
	//           waterY(수위), floor(창 클램프 바닥), biomes(바이옴 활성) }
	function world(params) {
		const P = Object.assign({
			seed: 1, amp: 0.9, scale: 3.0, octaves: 4, base: 0.5,
			biomeScale: 40, warpAmp: 0.6, warpScale: 9, waterY: -0.2,
			floor: -3.0, biomes: true, biomeSharp: 22, // floor: 버블 y 추종 후 느슨한 안전 하한(T3)
		}, params);
		P.seed = P.seed | 0;
		P.octaves = Math.max(1, Math.min(6, Math.round(P.octaves)));
		const yMax = P.base + P.amp * 2.0; // relief 상한 근사(산악 ampMul≈2) — 색 정규화용

		// W1: 바이옴 셋·수역색을 게놈에서 (없으면 기본 프리셋). WATER_ID 는 바이옴 수로 유도.
		const BIOMES = P.biomeSet || DEFAULT_BIOMES;
		const WATER_COL = P.water || DEFAULT_WATER;
		const WATER_ID = BIOMES.length;

		// 온·습도 2채널 [0,1] — 저주파. 팔레트/relief 를 함께 결정한다.
		function climate(x, z) {
			const t = clamp01(0.5 + 0.95 * fbm(x / P.biomeScale + 41.3, z / P.biomeScale - 12.7, P.seed + 711, 3));
			const h = clamp01(0.5 + 0.95 * fbm(x / P.biomeScale - 27.1, z / P.biomeScale + 63.9, P.seed + 919, 3));
			return [t, h];
		}

		// 바이옴 가중 — 온·습도 평면에서 각 바이옴 중심까지 거리의 소프트맥스 (경계 보간)
		function biomeWeights(t, h, out) {
			let sum = 0;
			for (let i = 0; i < BIOMES.length; i++) {
				const b = BIOMES[i];
				const dt = t - b.temp, dh = h - b.humid;
				const e = Math.exp(-(dt * dt + dh * dh) * P.biomeSharp);
				out[i] = e; sum += e;
			}
			const inv = 1 / (sum || 1);
			for (let i = 0; i < BIOMES.length; i++) out[i] *= inv;
			return out;
		}

		// domain warp — 저주파 노이즈로 샘플 좌표를 흔들어 격자감 제거
		function warp(x, z, k, o) {
			const wx = x + k * P.warpAmp * fbm(x / P.warpScale + 5.2, z / P.warpScale + 1.7, P.seed + 333, 2);
			const wz = z + k * P.warpAmp * fbm(x / P.warpScale - 3.9, z / P.warpScale - 8.4, P.seed + 557, 2);
			o[0] = wx; o[1] = wz; return o;
		}

		const _w = new Array(BIOMES.length), _p = [0, 0];

		// relief [-보정]: 바이옴 파라미터로 fBm + ridged 혼합. 순수(클램프 없음).
		function reliefAt(x, z) {
			if (!P.biomes) return fbm(x / P.scale, z / P.scale, P.seed, P.octaves) * P.amp;
			const c = climate(x, z);
			const w = biomeWeights(c[0], c[1], _w);
			let ampMul = 0, scaleMul = 0, ridgedMul = 0, warpMul = 0;
			for (let i = 0; i < BIOMES.length; i++) {
				const b = BIOMES[i];
				ampMul += w[i] * b.ampMul; scaleMul += w[i] * b.scaleMul;
				ridgedMul += w[i] * b.ridged; warpMul += w[i] * b.warpMul;
			}
			warp(x, z, warpMul, _p);
			const sc = P.scale * scaleMul;
			const base = fbm(_p[0] / sc, _p[1] / sc, P.seed, P.octaves);          // [-1,1]
			const rdg = ridgedFbm(_p[0] / sc, _p[1] / sc, P.seed + 47, P.octaves) * 2 - 1; // [-1,1]
			const relief = mix(base, rdg, ridgedMul);
			return P.base + relief * P.amp * ampMul;
		}

		function heightAt(x, z) { return reliefAt(x, z); }             // 순수 원본
		function height(x, z) { return Math.max(reliefAt(x, z), P.floor); } // 창용 클램프

		// 바이옴 판정 — 우세 바이옴 + 수역(높이 기반)
		function biomeAt(x, z) {
			const c = climate(x, z);
			const w = biomeWeights(c[0], c[1], _w);
			let bi = 0; for (let i = 1; i < BIOMES.length; i++) if (w[i] > w[bi]) bi = i;
			const y = reliefAt(x, z);
			if (y < P.waterY) return { id: WATER_ID, key: 'water', name: '수역', temp: c[0], humid: c[1], height: y };
			return { id: BIOMES[bi].id, key: BIOMES[bi].key, name: BIOMES[bi].name, temp: c[0], humid: c[1], height: y };
		}

		// 색 — 바이옴 팔레트를 가중 혼합(경계 연속) + 고도 램프 + 수역 심도 색
		function colorAt(x, z, y) {
			if (y == null) y = reliefAt(x, z);
			if (y < P.waterY) {
				const d = clamp01((P.waterY - y) / 0.8);
				return [mix(WATER_COL.shallow[0], WATER_COL.deep[0], d),
					mix(WATER_COL.shallow[1], WATER_COL.deep[1], d),
					mix(WATER_COL.shallow[2], WATER_COL.deep[2], d)];
			}
			if (!P.biomes) {
				const t = clamp01((y - P.waterY) / Math.max(yMax - P.waterY, 1e-3));
				return [mix(0.20, 0.70, t), mix(0.38, 0.72, t), mix(0.16, 0.75, t)];
			}
			const c = climate(x, z);
			const w = biomeWeights(c[0], c[1], _w);
			const t = clamp01((y - P.waterY) / Math.max(yMax - P.waterY, 1e-3));
			let r = 0, g = 0, bl = 0;
			for (let i = 0; i < BIOMES.length; i++) {
				const b = BIOMES[i];
				r += w[i] * mix(b.lo[0], b.hi[0], t);
				g += w[i] * mix(b.lo[1], b.hi[1], t);
				bl += w[i] * mix(b.lo[2], b.hi[2], t);
			}
			return [r, g, bl];
		}

		// 타일 PLY (T2 청크 스트리밍) — [x0,x0+size)×[z0,z0+size) 를 굽는다.
		// 이음새 정합의 핵심: 스플랫을 **전역 셀 격자**에 배치한다. 셀 크기 cell=size/G,
		// 전역 셀 인덱스 = round(x0/cell)+i. 지터는 셀 인덱스 해시(월드 좌표 기준)로 셀
		// *내부*에 가둔다 — 이웃 타일과 셀이 겹치지도 벌어지지도 않고, 같은 밀도 타일끼리는
		// 같은 격자를 공유하므로 같은 월드 셀 = 같은 스플랫(이음새 없음). splatScale 은
		// 셀 크기에 비례해 커버리지 유지(외곽 저밀도 타일은 스플랫이 자동으로 커진다).
		function tilePly(x0, z0, size, G, splatScale) {
			G = G || 64; splatScale = splatScale || 1;
			const N = G * G, cell = size / G;
			const cx0 = Math.round(x0 / cell), cz0 = Math.round(z0 / cell);
			const header = 'ply\nformat binary_little_endian 1.0\n' +
				`element vertex ${N}\n` +
				['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
					'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3']
					.map((p) => `property float ${p}`).join('\n') + '\nend_header\n';
			const head = new TextEncoder().encode(header);
			const body = new DataView(new ArrayBuffer(N * 17 * 4));
			const sx = cell * 0.95 * splatScale, sy = cell * 0.34 * splatScale;
			const lsx = Math.log(sx), lsy = Math.log(sy);
			let o = 0;
			const put = (v) => { body.setFloat32(o, v, true); o += 4; };
			for (let i = 0; i < N; i++) {
				const cellX = cx0 + (i % G), cellZ = cz0 + ((i / G) | 0);
				const jx = latticeHash(cellX, cellZ, P.seed + 1301) - 0.5;
				const jz = latticeHash(cellX, cellZ, P.seed + 2609) - 0.5;
				const x = (cellX + 0.5) * cell + jx * cell * 0.8;
				const z = (cellZ + 0.5) * cell + jz * cell * 0.8;
				const y = height(x, z);
				const rgb = colorAt(x, z, y);
				const jc = (latticeHash(cellX, cellZ, P.seed + 7717) - 0.5) * 0.05;
				put(x); put(y); put(z); put(0); put(0); put(0);
				put((rgb[0] + jc - 0.5) / SH_C0); put((rgb[1] + jc - 0.5) / SH_C0); put((rgb[2] + jc - 0.5) / SH_C0);
				put(2.44); // opacity 0.92 의 logit
				put(lsx); put(lsy); put(lsx);
				put(1); put(0); put(0); put(0); // 쿼터니언 (w,x,y,z)
			}
			const out = new Uint8Array(head.length + body.byteLength);
			out.set(head, 0);
			out.set(new Uint8Array(body.buffer), head.length);
			return out;
		}

		return {
			params: P, heightAt, height, reliefAt, biomeAt, colorAt, climate, tilePly,
			waterY: P.waterY, floor: P.floor, BIOMES, WATER_ID,
		};
	}

	// ── 창(chunk): 월드의 한 사각 영역을 굽는다 (하위 호환 create) ────────────
	// params: 월드 파라미터 + { extent(반폭 m), cx, cz(월드 중심 좌표) }
	// 두 창이 같은 월드 파라미터·시드면 겹침 영역에서 height/biome 가 수치 일치한다.
	function create(params) {
		const P = Object.assign({ seed: 1, extent: 4.8, cx: 0, cz: 0, amp: 0.9, scale: 3.0, octaves: 4, base: 0.5 }, params);
		const W = world(P);
		const height = W.height;         // 창 좌표는 월드 좌표 — 창 원점과 무관(연속성)

		// collider 삼각형 수프 — heightfield.bake / engine.setOccluder 입력 (생명 좌표 원본)
		function triSoup(G) {
			G = G || 128;
			const ext = P.extent, cx = P.cx, cz = P.cz;
			const soup = new Float32Array(G * G * 18); // 셀당 삼각형 2개 × 정점 3 × 3성분
			const at = (vx, vz) => {
				const x = cx - ext + 2 * ext * vx / G, z = cz - ext + 2 * ext * vz / G;
				return [x, height(x, z), z];
			};
			let o = 0;
			const put = (p) => { soup[o++] = p[0]; soup[o++] = p[1]; soup[o++] = p[2]; };
			for (let vz = 0; vz < G; vz++)
				for (let vx = 0; vx < G; vx++) {
					const a = at(vx, vz), b = at(vx + 1, vz), c = at(vx, vz + 1), d = at(vx + 1, vz + 1);
					put(a); put(c); put(b);
					put(b); put(c); put(d);
				}
			return soup;
		}

		// 무대 비주얼용 3DGS PLY (binary_little_endian, 표준 17 속성) — Uint8Array 반환
		function plyBytes(G, splatScale) {
			G = G || 160;
			splatScale = splatScale || 0.55;
			const N = G * G;
			const header = 'ply\nformat binary_little_endian 1.0\n' +
				`element vertex ${N}\n` +
				['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
					'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3']
					.map((p) => `property float ${p}`).join('\n') + '\nend_header\n';
			const head = new TextEncoder().encode(header);
			const body = new DataView(new ArrayBuffer(N * 17 * 4));
			// 스플랫은 collider 보다 살짝 안쪽 — 가장자리 절벽 스플랫 방지 (fixture 4.2/4.8 비율)
			const spread = P.extent * 0.875, cx = P.cx, cz = P.cz;
			let o = 0;
			const put = (v) => { body.setFloat32(o, v, true); o += 4; };
			for (let i = 0; i < N; i++) {
				const gx = i % G, gz = (i / G) | 0;
				const x = cx - spread + 2 * spread * (gx + jitterHash(i * 3) - 0.5) / (G - 1);
				const z = cz - spread + 2 * spread * (gz + jitterHash(i * 3 + 1) - 0.5) / (G - 1);
				const y = height(x, z);
				const rgb = W.colorAt(x, z, y);
				const j = (jitterHash(i * 7) - 0.5) * 0.05;
				put(x); put(y); put(z); put(0); put(0); put(0);
				put((rgb[0] + j - 0.5) / SH_C0); put((rgb[1] + j - 0.5) / SH_C0); put((rgb[2] + j - 0.5) / SH_C0);
				put(2.44); // opacity 0.92 의 logit
				// 납작한 surfel — 밀도(G)·범위(extent)에 맞춰 splatScale 로 커버리지 유지
				put(Math.log(0.17 * splatScale)); put(Math.log(0.06 * splatScale)); put(Math.log(0.17 * splatScale));
				put(1); put(0); put(0); put(0); // 쿼터니언 (w,x,y,z)
			}
			const out = new Uint8Array(head.length + body.byteLength);
			out.set(head, 0);
			out.set(new Uint8Array(body.buffer), head.length);
			return out;
		}

		return {
			params: P, world: W, height, heightAt: W.heightAt, biomeAt: W.biomeAt,
			colorAt: W.colorAt, waterY: P.waterY, triSoup, plyBytes,
		};
	}

	const api = { create, world, preset, PRESETS, BIOMES: DEFAULT_BIOMES, WATER_ID: DEFAULT_BIOMES.length };
	global.HktGenesisTerrainGen = api;
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
