// HktSplatEnv — 볼류메트릭 구름 bake (E12, classic script, vegetation.plyFromSplats 의존)
//
// 하늘 돔 셰이더의 2D 구름(원경 배경) 위에, 카메라 주변에는 **진짜 3DGS 퍼프 클러스터**를
// 띄운다 — 시점이 움직이면 시차가 생겨 하늘에 깊이가 생긴다(vista 레퍼런스의 뭉게구름).
// 구름 타일은 지형 4배(76.8m) — stage 가 카메라 중심 3×3 링으로 로드/해제한다.
//
// 결정론: 배치·형태 전부 셀 좌표·시드 해시(스트리밍 연속성, Math.random 금지).
// 저주파 value noise 로 '구름 은행'(무리)을 만들고, 은행 안에서만 구름이 스폰된다.

(function (global) {
	'use strict';

	const TILE = 76.8;            // 구름 타일 한 변(지형 타일 4배)
	const CELL = 12.8;            // 스폰 셀 — 타일당 6×6
	const BASE_Y = 24, VARY_Y = 12; // 구름 바닥 고도대(지형 위 충분히)

	function cellHash(ix, iz, seed) {
		let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2246822519)) | 0;
		h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	}
	const smooth = (t) => t * t * (3 - 2 * t);
	function valueNoise(x, z, seed) {
		const ix = Math.floor(x), iz = Math.floor(z);
		const fx = smooth(x - ix), fz = smooth(z - iz);
		const a = cellHash(ix, iz, seed), b = cellHash(ix + 1, iz, seed);
		const c = cellHash(ix, iz + 1, seed), d = cellHash(ix + 1, iz + 1, seed);
		return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
	}
	const mix = (a, b, t) => a + (b - a) * t;
	const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

	const TOP_COL = [0.99, 0.995, 1.0];   // 윗면 — 햇빛 흰색
	const BOT_COL = [0.70, 0.74, 0.84];   // 밑면 — 하늘빛 회청색

	// 한 구름 = 퍼프 8~16개의 수평 타원 클러스터. sun 방향 면이 밝고 밑면이 어둡다.
	function cloudSplats(u, v, seed, sun, arr) {
		const cx = (u + 0.5) * CELL + (cellHash(u, v, seed + 9203) - 0.5) * CELL;
		const cz = (v + 0.5) * CELL + (cellHash(u, v, seed + 9301) - 0.5) * CELL;
		const cy = BASE_Y + cellHash(u, v, seed + 9407) * VARY_Y;
		const s = 3.5 + cellHash(u, v, seed + 9501) * 4.5;          // 구름 반폭
		const n = 8 + ((cellHash(u, v, seed + 9601) * 9) | 0);      // 퍼프 수
		for (let i = 0; i < n; i++) {
			const dx = (cellHash(u * 31 + i, v, seed + 9701) - 0.5) * 2 * s;
			const dz = (cellHash(u, v * 37 + i, seed + 9803) - 0.5) * 2 * s * 0.7;
			const rr = Math.hypot(dx, dz) / s;                        // 중심 0 → 가장자리 1
			if (rr > 1) continue;
			const dy = (cellHash(u + i, v + i, seed + 9907) - 0.3) * s * 0.5 * (1 - rr * 0.6); // 중심이 봉긋
			const up = clamp01(dy / (s * 0.35) * 0.5 + 0.5);          // 0 밑면 → 1 윗면
			const sunside = clamp01((dx * sun[0] + dy * sun[1] + dz * sun[2]) / (s * 0.9) * 0.5 + 0.5);
			const t = clamp01(up * 0.75 + sunside * 0.35);
			const col = [mix(BOT_COL[0], TOP_COL[0], t), mix(BOT_COL[1], TOP_COL[1], t), mix(BOT_COL[2], TOP_COL[2], t)];
			const sig = s * (0.30 + cellHash(u + i * 3, v, seed + 9111) * 0.25) * (1 - rr * 0.45);
			const op = (0.26 + cellHash(u, v + i * 3, seed + 9113) * 0.18) * (1 - rr * 0.5) + (rr < 0.35 ? 0.16 : 0); // 코어 진하게
			// vegetation.plyFromSplats 포맷: x,y,z, r,g,b, opacity, sx,sy,sz (쿼터니언 identity)
			arr.push(cx + dx, cy + dy, cz + dz, col[0], col[1], col[2], op, sig, sig * 0.55, sig);
		}
	}

	// 구름 타일 bake — cov(0..1, 게놈 mood.cloud)로 밀도를 조절. 구름 없으면 null.
	function bakeTile(seed, tx, tz, sun, cov) {
		const V = global.HktGenesisVegetation;
		if (!V) throw new Error('vegetation.js(HktGenesisVegetation) 선행 필요');
		cov = (cov != null) ? cov : 0.45;
		if (cov <= 0.001) return null; // 구름 0 = 볼류메트릭 없음(회귀 안전)
		seed = seed | 0;
		sun = sun || [0.51, 0.63, 0.58];
		const arr = [];
		const u0 = Math.round(tx * TILE / CELL), v0 = Math.round(tz * TILE / CELL);
		const G = Math.round(TILE / CELL);
		for (let dv = 0; dv < G; dv++)
			for (let du = 0; du < G; du++) {
				const u = u0 + du, v = v0 + dv;
				// 저주파 구름 은행 — 은행 안에서만, cov 가 임계를 낮춘다(무리 지는 하늘)
				const bank = valueNoise(u * CELL / 95 + 13.7, v * CELL / 95 - 41.2, seed + 9001);
				if (bank < 0.62 - cov * 0.28) continue;
				if (cellHash(u, v, seed + 9101) > 0.5) continue; // 은행 안 성김
				cloudSplats(u, v, seed, sun, arr);
			}
		return arr.length ? V.plyFromSplats(arr) : null;
	}

	const api = { bakeTile, TILE };
	global.HktGenesisClouds = api;
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
