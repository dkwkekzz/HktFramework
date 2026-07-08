// HktSplatGenesis — Bake 식생 레이어 (W-Q2b, classic script, terrain-gen·scatter 의존)
//
// "밀도는 상한을 올려서가 아니라 Bake 로 푼다"(DESIGN W-Q2). 시뮬 개체(MAX_ENTITIES=8)로는
// 초원을 못 채우므로, 나무·바위를 **정적 스플랫**으로 구워 지형 PLY 처럼 Spark(무대)가 그린다 —
// 시뮬 풀(8슬라이스·바이토닉)을 안 거치니 개수 제한이 사실상 없다. 배치 규칙은 scatter.candidates
// (게놈 생명 층 = 단일 원본)와 공유하므로 Bake·시뮬이 같은 좌표를 본다(승격 시 정합).
//
// v0: 절차 스플랫 블롭(나무 = 기둥+수관, 바위 = 회색 타원). 원경은 "생성된 씬"(무대 예외 —
// 근접 상호작용 생명엔 절대 원칙 1 그대로). v1(후속): 시뮬로 배양한 나무를 스냅샷해 인스턴싱.
//
// 결정론: 스플랫별 지터는 좌표(셀 key) 해시로 — Math.random 금지(스트리밍 연속성, 기존 컨벤션).

(function (global) {
	'use strict';

	const SH_C0 = 0.28209479177387814;
	const PLY_PROPS = ['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
		'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];

	// 문자열 key → [0,1) 결정론 해시 (스폰별 변형용, 시드 분리)
	function keyHash(key, salt) {
		let h = salt | 0;
		for (let i = 0; i < key.length; i++) h = (Math.imul(h ^ key.charCodeAt(i), 374761393) + 1) | 0;
		h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	}
	const mix = (a, b, t) => a + (b - a) * t;
	const jit = (key, salt, amp) => (keyHash(key, salt) - 0.5) * 2 * amp; // [-amp, amp]

	const DEFAULT_LIFE = {
		treeSize: 1.0, leaf: [0.24, 0.55, 0.20], leaf2: [0.32, 0.66, 0.26], trunk: [0.30, 0.22, 0.14],
		rock: [0.42, 0.44, 0.48],
	};
	function lifeOf(world, cfg) {
		const l = (cfg && cfg.life) || (world && world.params && world.params.life) || null;
		return Object.assign({}, DEFAULT_LIFE, l || {});
	}

	// 스플랫 하나를 배열에 push — pos(3), rgb(3), opacity(0..1), scale(3), (쿼터니언은 identity)
	function pushSplat(arr, x, y, z, rgb, opacity, sx, sy, sz) {
		arr.push(x, y, z, rgb[0], rgb[1], rgb[2], opacity, sx, sy, sz);
	}

	// 기본 태양 방향(정규화) — world.sun 이 없을 때의 폴백(terrain-gen 기본 태양과 동일 값)
	const DEFAULT_SUN = (() => { const s = [0.55, 0.62, 0.38], l = Math.hypot(s[0], s[1], s[2]); return [s[0] / l, s[1] / l, s[2] / l]; })();
	// 형태 음영 — 수관/바위 중심에서 블롭까지의 방향과 태양의 내적(diffuse). amb 는 그늘면 최저 밝기.
	function formShade(dx, dy, dz, sun, amb) {
		const l = Math.hypot(dx, dy, dz) || 1;
		const d = Math.max((dx * sun[0] + dy * sun[1] + dz * sun[2]) / l, 0);
		return amb + (1 - amb) * d;
	}

	// 단풍 변주 팔레트 — 레퍼런스(스타일라이즈드 오픈월드)의 노랑·주황 나무. 결정론 해시로 소수만.
	const AUTUMN_GOLD = { leaf: [0.74, 0.54, 0.13], leaf2: [0.92, 0.72, 0.22] };
	const AUTUMN_ORANGE = { leaf: [0.78, 0.40, 0.10], leaf2: [0.94, 0.58, 0.16] };
	// 침엽수 비율(바이옴별) — 추운 곳일수록 침엽수. 미상 바이옴은 중립.
	const CONIFER_RATE = { snow: 0.85, mountain: 0.6, plains: 0.15, desert: 0.05 };

	// 2톤 하드 셰이딩(E23) — 태양면/그늘면을 좁은 경계로 딱 나눈다(스타일라이즈드 '각'이 선다).
	// 부드러운 램프(formShade) 대신 임계 스무스스텝: 밝음 1.05 · 그늘 0.58.
	function toonShade(dx, dy, dz, sun) {
		const l = Math.hypot(dx, dy, dz) || 1;
		const d = (dx * sun[0] + dy * sun[1] + dz * sun[2]) / l;
		const t = clamp01((d - 0.02) / 0.28);
		return 0.58 + (1.05 - 0.58) * t * t * (3 - 2 * t);
	}
	const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

	// 나무(E23) — 스타일라이즈드 로브 수관: 굵은 줄기 + 잎 덩어리(로브) 4~5개, 로브 단위
	// 2톤 셰이딩. 퍼지 껍질(작은 블롭 20개) 대신 로브마다 촘촘·불투명 스플랫 소수 —
	// 실루엣이 '브로콜리' 클럼프로 또렷하게 읽힌다(레퍼런스 나무의 형태 언어).
	// gsh: 지면 명암(RGB) — 지형 조명(그림자·AO)과 통합. sun: 지형과 같은 광원.
	function treeSplats(cand, life, arr, gsh, sun) {
		sun = sun || DEFAULT_SUN;
		const k = cand.key, s = life.treeSize * (0.85 + keyHash(k, 5) * 0.6); // 개체별 크기 변주
		const coniferRate = (cand.biome in CONIFER_RATE) ? CONIFER_RATE[cand.biome] : 0.3;
		if (keyHash(k, 3) < coniferRate) return coniferSplats(cand, life, arr, gsh, sun, s);
		// 잎 팔레트 — 소수 단풍(금빛 12% · 주황 6%), 나머지 게놈 잎색
		let leaf = life.leaf, leaf2 = life.leaf2;
		const av = keyHash(k, 4);
		if (av < 0.06) { leaf = AUTUMN_ORANGE.leaf; leaf2 = AUTUMN_ORANGE.leaf2; }
		else if (av < 0.18) { leaf = AUTUMN_GOLD.leaf; leaf2 = AUTUMN_GOLD.leaf2; }
		const h = 2.6 * s, crownR = 1.0 * s;
		const cx = cand.x, cz = cand.z, cy = cand.y + h * 0.68; // 수관 중심
		// 줄기 — 수관 밑으로 확실히 보이게 길고 불투명하게(형태의 기둥). 해시로 살짝 기울임.
		const tr = life.trunk, lean = jit(k, 6, 0.12) * s;
		pushSplat(arr, cx, cand.y + h * 0.18, cz, [tr[0] * gsh[0], tr[1] * gsh[1], tr[2] * gsh[2]], 0.98, 0.09 * s, h * 0.22, 0.09 * s);
		pushSplat(arr, cx + lean * 0.5, cand.y + h * 0.42, cz, [tr[0] * 1.15 * gsh[0], tr[1] * 1.15 * gsh[1], tr[2] * 1.15 * gsh[2]], 0.97, 0.07 * s, h * 0.16, 0.07 * s);
		// 로브(잎 덩어리) — 꼭대기 1 + 둘레 3~4. 로브 하나 = 큰 코어 + 표면 소수 스플랫,
		// 로브 전체가 같은 2톤 명암을 공유해 덩어리 단위로 밝/그늘이 갈린다(각진 느낌의 핵심).
		const nl = 4 + (keyHash(k, 7) > 0.55 ? 1 : 0);
		for (let li = 0; li < nl; li++) {
			let ox, oy, oz;
			if (li === 0) { ox = jit(k, 20, 0.2) * s; oy = crownR * 0.62; oz = jit(k, 21, 0.2) * s; } // 꼭대기 로브
			else {
				const a = ((li - 1) / (nl - 1) + keyHash(k, 30 + li) * 0.18) * 6.2831853;
				ox = Math.cos(a) * crownR * 0.72; oz = Math.sin(a) * crownR * 0.72;
				oy = (keyHash(k, 40 + li) - 0.45) * crownR * 0.5;
			}
			const lr = crownR * (0.48 + keyHash(k, 50 + li) * 0.18);
			const lt = 0.3 + 0.55 * keyHash(k, 60 + li);                 // 로브별 잎색 램프
			const sh = toonShade(ox, oy + crownR * 0.25, oz, sun);       // 로브 단위 2톤(위 보정)
			const base = [mix(leaf[0], leaf2[0], lt) * sh, mix(leaf[1], leaf2[1], lt) * sh, mix(leaf[2], leaf2[2], lt) * sh];
			const col = [base[0] * gsh[0], base[1] * gsh[1], base[2] * gsh[2]];
			// 로브 코어 — 크고 불투명(실루엣 본체)
			pushSplat(arr, cx + ox, cy + oy, cz + oz, col, 0.97, lr * 0.62, lr * 0.52, lr * 0.62);
			// 로브 표면 요철 3개 — 코어보다 살짝 밝거나 어둡게(덩어리 질감), 촘촘·불투명
			for (let i = 0; i < 3; i++) {
				const bx = jit(k, 100 + li * 9 + i, 1), by = jit(k, 200 + li * 9 + i, 0.8), bz = jit(k, 300 + li * 9 + i, 1);
				const bl = Math.hypot(bx, by, bz) || 1;
				const px = cx + ox + bx / bl * lr * 0.5, py = cy + oy + by / bl * lr * 0.42, pz = cz + oz + bz / bl * lr * 0.5;
				const bsh = toonShade(ox + bx / bl * lr, oy + by / bl * lr + crownR * 0.25, oz + bz / bl * lr, sun);
				const bc = [mix(leaf[0], leaf2[0], lt) * bsh * gsh[0], mix(leaf[1], leaf2[1], lt) * bsh * gsh[1], mix(leaf[2], leaf2[2], lt) * bsh * gsh[2]];
				pushSplat(arr, px, py, pz, bc, 0.95, lr * 0.34, lr * 0.30, lr * 0.34);
			}
		}
		// 수관 밑면 그늘 — 캐노피 아래 어두운 덩어리(줄기와 로브를 잇는 그림자 코어)
		const uc = [leaf[0] * 0.35 * gsh[0], leaf[1] * 0.35 * gsh[1], leaf[2] * 0.35 * gsh[2]];
		pushSplat(arr, cx, cy - crownR * 0.42, cz, uc, 0.95, crownR * 0.55, crownR * 0.35, crownR * 0.55);
	}

	// 침엽수(E23) — 촘촘한 원뿔 층 + 2톤. 층 원반은 불투명(또렷한 스커트 실루엣), 꼭대기 스파이어.
	function coniferSplats(cand, life, arr, gsh, sun, s) {
		const k = cand.key, h = 2.9 * s;
		const cx = cand.x, cz = cand.z;
		const leaf = [life.leaf[0] * 0.55, life.leaf[1] * 0.75, life.leaf[2] * 0.7]; // 차가운 침엽 톤
		const tr = life.trunk;
		pushSplat(arr, cx, cand.y + h * 0.14, cz, [tr[0] * gsh[0], tr[1] * gsh[1], tr[2] * gsh[2]], 0.98, 0.08 * s, h * 0.18, 0.08 * s);
		const L = 4;
		for (let li = 0; li < L; li++) {
			const f = li / (L - 1);                       // 0(아래)~1(꼭대기)
			const ly = cand.y + h * (0.30 + 0.52 * f);
			const lr = 0.60 * s * (1 - 0.72 * f);         // 위로 갈수록 좁게
			const csh = 0.62 + 0.43 * f;                  // 위층이 밝다(태양)
			pushSplat(arr, cx, ly, cz, [leaf[0] * csh * gsh[0], leaf[1] * csh * gsh[1], leaf[2] * csh * gsh[2]], 0.97, lr, lr * 0.26, lr);
			for (let i = 0; i < 3; i++) {
				const a = (keyHash(k, 700 + li * 7 + i) + i / 3) * 6.2831853;
				const dx = Math.cos(a), dz = Math.sin(a);
				const sh = toonShade(dx, 0.3, dz, sun);
				const rgb = [leaf[0] * sh * gsh[0], leaf[1] * sh * gsh[1], leaf[2] * sh * gsh[2]];
				pushSplat(arr, cx + dx * lr * 0.65, ly + jit(k, 800 + li * 7 + i, 0.06) * s, cz + dz * lr * 0.65,
					rgb, 0.95, lr * 0.45, lr * 0.30, lr * 0.45);
			}
		}
		// 꼭대기 스파이어 — 세로로 길쭉한 뾰족 끝(침엽 실루엣의 마침표)
		const tipc = [leaf[0] * 1.05 * gsh[0], leaf[1] * 1.05 * gsh[1], leaf[2] * 1.05 * gsh[2]];
		pushSplat(arr, cx, cand.y + h * 0.92, cz, tipc, 0.96, 0.10 * s, h * 0.10, 0.10 * s);
	}

	// 바위 = 회색 타원 블롭 2~3개(지면에 낮게) + 태양면 형태 음영. 급경사에도 놓임.
	function rockSplats(cand, life, arr, gsh, sun) {
		sun = sun || DEFAULT_SUN;
		const k = cand.key, s = 0.5 + keyHash(k, 7) * 0.9;
		const n = 2 + (keyHash(k, 9) > 0.5 ? 1 : 0);
		for (let i = 0; i < n; i++) {
			const dx = jit(k, 10 + i, 0.35 * s), dz = jit(k, 20 + i, 0.35 * s);
			const px = cand.x + dx, pz = cand.z + dz;
			const py = cand.y + 0.12 * s;
			const shade = formShade(dx, 0.5, dz, sun, 0.6) * (0.9 + jit(k, 30 + i, 0.1));
			const rgb = [life.rock[0] * shade * gsh[0], life.rock[1] * shade * gsh[1], life.rock[2] * shade * gsh[2]];
			const rx = 0.34 * s * (0.7 + keyHash(k, 40 + i) * 0.7);
			pushSplat(arr, px, py, pz, rgb, 0.98, rx, rx * 0.6, rx * 0.85);
		}
	}

	// ── E20 지면 클러터(풀·꽃·자갈) — 눈높이 디테일을 밀도가 아니라 '내용'으로 채운다 ──
	// 지면 surfel 을 더 잘게 쪼개는 대신(중심 타일 256격자 = bake 잭), 풀 포기(수직 얇은 스플랫)·
	// 평야 꽃 악센트·산악 자갈을 근접 링 식생 PLY 에 합친다. 타일당 ~1천 스플랫(값싸다).
	// 전역 셀 격자(0.55m) + 좌표·시드 해시 결정론 — 이웃 타일과 이음새 없음, Math.random 금지.
	function cellHash(ix, iz, seed) {
		let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2246822519)) | 0;
		h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	}
	const FLOWER_COLS = [[0.95, 0.93, 0.90], [0.95, 0.80, 0.25], [0.90, 0.38, 0.38], [0.60, 0.58, 0.95]];
	const CLUTTER_KEEP = { plains: 0.62, mountain: 0.30, snow: 0.10, desert: 0.18 }; // 바이옴별 채움 확률
	const GRASS_D = [0.20, 0.45, 0.16], GRASS_L = [0.45, 0.72, 0.28]; // 풀색 램프(어두움→밝음)
	const GRASS_DRY = [0.58, 0.52, 0.26], PEBBLE = [0.45, 0.45, 0.47];
	function clutterSplats(world, x0, z0, size, arr) {
		if (!world.normalAt || !world.shadeRGBAt) return; // 구 world 폴백 — 클러터 없음(무회귀)
		const seed = ((world.params && world.params.seed) | 0) || 0;
		const waterY = (world.waterY != null) ? world.waterY : -1e9;
		const cell = 0.55;
		const u0 = Math.floor(x0 / cell), u1 = Math.floor((x0 + size) / cell);
		const v0 = Math.floor(z0 / cell), v1 = Math.floor((z0 + size) / cell);
		for (let v = v0; v <= v1; v++)
			for (let u = u0; u <= u1; u++) {
				const h0 = cellHash(u, v, seed + 5101);
				if (h0 > 0.65) continue; // 상한 컷 — 바이옴 판정 전에 걸러 bake 비용 절감
				const x = (u + 0.5) * cell + (cellHash(u, v, seed + 5203) - 0.5) * cell * 0.9;
				const z = (v + 0.5) * cell + (cellHash(u, v, seed + 5309) - 0.5) * cell * 0.9;
				if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue; // 타일 창 밖
				const y = world.heightAt(x, z);
				if (y < waterY + 0.06) continue; // 수역·물가 제외
				const b = world.biomeAt(x, z);
				const keep = (b.key in CLUTTER_KEEP) ? CLUTTER_KEEP[b.key] : 0.25;
				if (h0 > keep) continue;
				const n = world.normalAt(x, z);
				if (n[1] < 0.55) continue; // 절벽 제외(암반 노출 자리)
				const gsh = world.shadeRGBAt(x, z, false); // 지형과 같은 조명(그림자·AO·쿨톤)
				const h1 = cellHash(u, v, seed + 5417), h2 = cellHash(u, v, seed + 5501);
				const pebble = (b.key === 'mountain' && h1 < 0.7) || b.key === 'snow';
				if (pebble) { // 자갈 — 낮은 회색 타원
					const r = 0.05 + h2 * 0.07, sh = 0.8 + h1 * 0.3;
					pushSplat(arr, x, y + r * 0.4, z,
						[PEBBLE[0] * sh * gsh[0], PEBBLE[1] * sh * gsh[1], PEBBLE[2] * sh * gsh[2]], 0.95, r, r * 0.6, r * 0.9);
					continue;
				}
				// 풀 포기 — 수직으로 얇은 스플랫(눈높이에서 지면 결을 만드는 주역)
				const dry = b.key === 'desert';
				const hs = 0.10 + h2 * 0.13, t = cellHash(u, v, seed + 5601);
				const gc = dry ? GRASS_DRY : [mix(GRASS_D[0], GRASS_L[0], t), mix(GRASS_D[1], GRASS_L[1], t), mix(GRASS_D[2], GRASS_L[2], t)];
				pushSplat(arr, x, y + hs * 0.5, z,
					[gc[0] * gsh[0], gc[1] * gsh[1], gc[2] * gsh[2]], 0.85, 0.06, hs * 0.55, 0.06);
				// 평야 꽃 악센트(4%) — 풀 끝의 밝은 점(스타일라이즈드 팝, 조명 약하게만)
				if (b.key === 'plains' && h1 < 0.04) {
					const fc = FLOWER_COLS[(cellHash(u, v, seed + 5701) * FLOWER_COLS.length) | 0];
					pushSplat(arr, x, y + hs + 0.02, z, [fc[0] * (0.7 + 0.3 * gsh[0]), fc[1] * (0.7 + 0.3 * gsh[1]), fc[2] * (0.7 + 0.3 * gsh[2])], 0.95, 0.045, 0.04, 0.045);
				}
			}
	}

	// 후보 목록 → 식생 스플랫 배열(10 float/스플랫). 나무·바위만(모닥불은 시뮬 전용).
	// world.shadeAt 이 있으면 스폰 자리의 지면 명암을 곱해 지형 Bake 셰이딩과 통합한다.
	function splatsFor(cands, life, world) {
		const arr = [];
		// E16: 지면 명암을 채널별(RGB)로 — 그림자·AO·하늘 쿨톤이 나무 밑동에도 적용된다.
		// shadeRGBAt 이 없으면(구 world) 스칼라 shadeAt 을 벡터로 승격.
		const shadeV = (world && world.shadeRGBAt) ? ((x, z) => world.shadeRGBAt(x, z, false))
			: (world && world.shadeAt) ? ((x, z) => { const s = world.shadeAt(x, z, false); return [s, s, s]; })
			: (() => [1, 1, 1]);
		const sun = (world && world.sun) || DEFAULT_SUN; // 지형 bake 와 같은 광원
		for (const c of cands) {
			const gsh = shadeV(c.x, c.z);
			if (c.kind === 'tree') treeSplats(c, life, arr, gsh, sun);
			else if (c.kind === 'rock') rockSplats(c, life, arr, gsh, sun);
		}
		return arr;
	}

	// 스플랫 배열(10 float 묶음) → 표준 17속성 3DGS PLY(Uint8Array). 비면 null.
	function plyFromSplats(arr) {
		const N = arr.length / 10;
		if (!N) return null;
		const header = 'ply\nformat binary_little_endian 1.0\n' +
			`element vertex ${N}\n` + PLY_PROPS.map((p) => `property float ${p}`).join('\n') + '\nend_header\n';
		const head = new TextEncoder().encode(header);
		const body = new DataView(new ArrayBuffer(N * 17 * 4));
		let o = 0; const put = (v) => { body.setFloat32(o, v, true); o += 4; };
		const logit = (p) => Math.log(p / (1 - p));
		for (let i = 0; i < N; i++) {
			const b = i * 10;
			const x = arr[b], y = arr[b + 1], z = arr[b + 2];
			const r = arr[b + 3], g = arr[b + 4], bl = arr[b + 5], op = arr[b + 6];
			const sx = arr[b + 7], sy = arr[b + 8], sz = arr[b + 9];
			put(x); put(y); put(z); put(0); put(0); put(0);
			put((r - 0.5) / SH_C0); put((g - 0.5) / SH_C0); put((bl - 0.5) / SH_C0);
			put(logit(Math.min(Math.max(op, 0.01), 0.99)));
			put(Math.log(sx)); put(Math.log(sy)); put(Math.log(sz));
			put(1); put(0); put(0); put(0); // 쿼터니언 (w,x,y,z) — 축 정렬
		}
		const out = new Uint8Array(head.length + body.byteLength);
		out.set(head, 0); out.set(new Uint8Array(body.buffer), head.length);
		return out;
	}

	// ── 파노라마 Bake (concept/preset-shot 단일 창) ──────────────────────────
	// world(terrain-gen) + 창 반폭 extent → 창 전체 식생 PLY. scatter.candidates 로 배치.
	// cfg: { cell, maxSlope, jitter, life, excludeKeys } — 없으면 게놈 생명 층(world.params.life).
	// cfg.excludeKeys(W-Q2c): 시뮬로 승격된 스폰 key 는 candidates 가 걸러 Bake 에서 빠진다.
	function bakePanorama(world, extent, cx, cz, cfg) {
		const S = global.HktGenesisScatter;
		if (!S) throw new Error('scatter.js(HktGenesisScatter) 선행 필요');
		cx = cx || 0; cz = cz || 0;
		const life = lifeOf(world, cfg);
		// 창 반폭을 덮는 반경(대각) — 창 밖 후보는 candidates 가 원형 컷하지만 사각 창을 다 채우려 여유
		const radius = extent * 1.45;
		const cands = S.candidates(world, cx, cz, radius, Object.assign({}, S.PROMOTE_CFG, cfg, { life }));
		// 사각 창(±extent) 안만 남긴다
		const inWin = cands.filter((c) => Math.abs(c.x - cx) <= extent && Math.abs(c.z - cz) <= extent);
		return { ply: plyFromSplats(splatsFor(inWin, life, world)), count: inWin.length,
			trees: inWin.filter((c) => c.kind === 'tree').length, rocks: inWin.filter((c) => c.kind === 'rock').length };
	}

	// ── 타일 Bake (T2 스트리밍) — [x0,x0+size)×[z0,z0+size) 식생 PLY. 링 밀도로 LoD. ──
	// cfg.excludeKeys(W-Q2c): 시뮬 승격된 스폰 key 를 candidates 가 걸러 정적 사본을 뺀다(이중 그리기 제거).
	function bakeTile(world, x0, z0, size, cfg) {
		const S = global.HktGenesisScatter;
		if (!S) throw new Error('scatter.js(HktGenesisScatter) 선행 필요');
		const life = lifeOf(world, cfg);
		const cx = x0 + size / 2, cz = z0 + size / 2;
		const cands = S.candidates(world, cx, cz, size * 0.8, Object.assign({}, S.PROMOTE_CFG, cfg, { life }))
			.filter((c) => c.x >= x0 && c.x < x0 + size && c.z >= z0 && c.z < z0 + size);
		const arr = splatsFor(cands, life, world);
		clutterSplats(world, x0, z0, size, arr); // E20 풀·꽃·자갈 — 같은 근접 링 식생 PLY 에 합류
		return plyFromSplats(arr);
	}

	// 두 PLY(동일 17속성 레이아웃) 를 하나로 합친다 — 무대가 단일 메시만 로드하는 경로(concept/preset-shot)
	// 에서 지형+식생을 한 PLY 로. 정점 수만 더하고 바디를 이어 붙인다(속성 순서 동일 전제).
	function mergePly(a, b) {
		if (!a) return b; if (!b) return a;
		const dec = new TextDecoder();
		function parse(u8) {
			const head = dec.decode(u8.subarray(0, Math.min(u8.length, 4096)));
			const end = head.indexOf('end_header\n');
			if (end < 0) throw new Error('PLY 헤더 없음');
			const hlen = end + 'end_header\n'.length;
			const n = parseInt(/element vertex (\d+)/.exec(head)[1], 10);
			return { n, body: u8.subarray(hlen) };
		}
		const A = parse(a), B = parse(b);
		const header = 'ply\nformat binary_little_endian 1.0\n' +
			`element vertex ${A.n + B.n}\n` + PLY_PROPS.map((p) => `property float ${p}`).join('\n') + '\nend_header\n';
		const head = new TextEncoder().encode(header);
		const out = new Uint8Array(head.length + A.body.length + B.body.length);
		out.set(head, 0); out.set(A.body, head.length); out.set(B.body, head.length + A.body.length);
		return out;
	}

	const api = { splatsFor, plyFromSplats, mergePly, bakePanorama, bakeTile, treeSplats, rockSplats, lifeOf };
	global.HktGenesisVegetation = api;
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
