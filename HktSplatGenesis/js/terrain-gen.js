// HktSplatGenesis — 에디터 절차 지형 생성기 (classic script, 의존성 없음)
//
// 시드 기반 value-noise fBm 으로 height(x,z) 를 만들고, 같은 함수에서
//  ① 무대 비주얼용 3DGS PLY 바이트 (stage.js → Spark 로드)
//  ② 시뮬 collider 용 삼각형 수프 (heightfield.bake 입력 — GLB 왕복 없이 직접)
// 를 굽는다. test/_fixture.js 와 같은 원리(단일 height 원본 → PLY·collider 정합)의
// 브라우저·시드 매개변수판. 무대는 "로드 대상"이므로 지형을 코드로 생성하는 것은
// 절대 원칙 1 위배가 아니다 (생명이 아님 — DESIGN.md 2층 세계 결정 참조).
//
// 주의: 골짜기 최저가 시뮬 격자 바닥(y = -0.8)보다 낮으면 그 영역에서 L2 이웃
// 규칙이 꺼진다 (test/_fixture.js 와 동일 주의) — height 는 -0.72 로 클램프한다.

(function (global) {
	'use strict';

	const SH_C0 = 0.28209479177387814;

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

	// 스플랫별 지터 해시 (fixture 의 hash(i) 대응 — 시드 무관 배치 지터용)
	const jitterHash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; return ((x >>> 0) / 4294967296); };

	// 높이 밴드 팔레트: 계곡 짙은 녹색 → 풀 → 바위 → 설선 (test/_fixture.js 와 동일 밴드)
	function bandColor(t) {
		if (t < 0.45) { const u = t / 0.45; return [0.10 + 0.18 * u, 0.30 + 0.20 * u, 0.12 + 0.07 * u]; }
		if (t < 0.8) { const u = (t - 0.45) / 0.35; return [0.28 + 0.18 * u, 0.50 - 0.09 * u, 0.19 + 0.20 * u]; }
		const u = (t - 0.8) / 0.2; return [0.46 + 0.45 * u, 0.41 + 0.51 * u, 0.39 + 0.56 * u];
	}

	// params: { seed, extent(반폭 m), amp(진폭), scale(기복 크기 m), octaves, base(평균 높이) }
	function create(params) {
		const P = Object.assign({ seed: 1, extent: 4.8, amp: 0.9, scale: 3.0, octaves: 4, base: 0.35 }, params);
		P.seed = P.seed | 0;
		P.octaves = Math.max(1, Math.min(6, Math.round(P.octaves)));

		function height(x, z) {
			let a = 0, w = 1, wsum = 0, f = 1 / Math.max(P.scale, 0.3);
			for (let o = 0; o < P.octaves; o++) {
				// 옥타브마다 시드·위상 분리 — 격자 정렬 아티팩트 방지
				a += (valueNoise(x * f + o * 17.17, z * f - o * 9.31, P.seed + o * 101) * 2 - 1) * w;
				wsum += w; w *= 0.5; f *= 2.03;
			}
			// 골짜기가 격자 바닥(-0.8) 아래로 내려가지 않게 클램프 (상단 주석)
			return Math.max(P.base + (a / wsum) * P.amp, -0.72);
		}

		// collider 삼각형 수프 — heightfield.bake / engine.setOccluder 입력 (생명 좌표 원본)
		function triSoup(G) {
			G = G || 128;
			const ext = P.extent;
			const soup = new Float32Array(G * G * 18); // 셀당 삼각형 2개 × 정점 3 × 3성분
			const at = (vx, vz) => {
				const x = -ext + 2 * ext * vx / G, z = -ext + 2 * ext * vz / G;
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
			const spread = P.extent * 0.875;
			const yMin = -0.72, yMax = P.base + P.amp;
			let o = 0;
			const put = (v) => { body.setFloat32(o, v, true); o += 4; };
			for (let i = 0; i < N; i++) {
				const gx = i % G, gz = (i / G) | 0;
				const x = -spread + 2 * spread * (gx + jitterHash(i * 3) - 0.5) / (G - 1);
				const z = -spread + 2 * spread * (gz + jitterHash(i * 3 + 1) - 0.5) / (G - 1);
				const y = height(x, z);
				const t = Math.max(0, Math.min(1, (y - yMin) / Math.max(yMax - yMin, 1e-3)));
				const rgb = bandColor(t);
				const j = (jitterHash(i * 7) - 0.5) * 0.06;
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

		return { params: P, height, triSoup, plyBytes };
	}

	global.HktGenesisTerrainGen = { create };
})(window);
