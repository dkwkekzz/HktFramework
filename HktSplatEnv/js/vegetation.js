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

	// 나무(E13) — 종(활엽/침엽)·단풍 변주 + 태양면/그늘면 형태 음영. 크기는 게놈 treeSize.
	// gsh: 지면 명암(0.52..1) — 지형 Bake 셰이딩과 통합(그늘 슬로프의 나무는 어둡게).
	// sun: 정규화 태양 방향(world.sun) — 지형과 같은 광원으로 수관 음영을 굽는다.
	function treeSplats(cand, life, arr, gsh, sun) {
		sun = sun || DEFAULT_SUN;
		const k = cand.key, s = life.treeSize * (0.82 + keyHash(k, 5) * 0.5); // 개체별 크기 변주
		const coniferRate = (cand.biome in CONIFER_RATE) ? CONIFER_RATE[cand.biome] : 0.3;
		if (keyHash(k, 3) < coniferRate) return coniferSplats(cand, life, arr, gsh, sun, s);
		// 잎 팔레트 — 소수 단풍(금빛 12% · 주황 6%), 나머지 게놈 잎색
		let leaf = life.leaf, leaf2 = life.leaf2;
		const av = keyHash(k, 4);
		if (av < 0.06) { leaf = AUTUMN_ORANGE.leaf; leaf2 = AUTUMN_ORANGE.leaf2; }
		else if (av < 0.18) { leaf = AUTUMN_GOLD.leaf; leaf2 = AUTUMN_GOLD.leaf2; }
		const h = 1.8 * s, crownR = 0.78 * s;
		const cx = cand.x, cz = cand.z, cy = cand.y + h * 0.66; // 수관 중심
		// 기둥 — 아래→위 3단, 세로로 늘인 얇은 스플랫(해시로 살짝 기울여 개체 변주)
		const trunkR = 0.10 * s, tr = life.trunk, lean = jit(k, 6, 0.10) * s;
		for (let i = 0; i < 3; i++) {
			const ty = cand.y + h * (0.10 + i * 0.15), lx = lean * i / 3;
			pushSplat(arr, cx + lx, ty, cz, [tr[0] * gsh[0], tr[1] * gsh[1], tr[2] * gsh[2]], 0.95, trunkR, h * 0.13, trunkR);
		}
		// 수관 코어 — 어두운 내부 블롭(껍질 클러스터 틈으로 배경 대신 그늘이 보이게 = 깊이감)
		for (let i = 0; i < 4; i++) {
			const dx = jit(k, 40 + i, 1), dy = jit(k, 50 + i, 0.7), dz = jit(k, 60 + i, 1);
			const rr = crownR * 0.35;
			const rgb = [leaf[0] * 0.45 * gsh[0], leaf[1] * 0.45 * gsh[1], leaf[2] * 0.45 * gsh[2]];
			pushSplat(arr, cx + dx * rr, cy + dy * rr, cz + dz * rr, rgb, 0.95, crownR * 0.5, crownR * 0.42, crownR * 0.5);
		}
		// 수관 껍질 — 작은 잎 클러스터 20개를 타원 껍질에 배치, 태양면은 밝고 그늘면은 어둡다
		const n = 20;
		for (let i = 0; i < n; i++) {
			// 껍질 방향 — 3축 해시 → 정규화(위쪽 살짝 비중)
			let dx = jit(k, 100 + i, 1), dy = jit(k, 200 + i, 1) * 0.8 + 0.15, dz = jit(k, 300 + i, 1);
			const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
			const rr = crownR * (0.55 + keyHash(k, 400 + i) * 0.45);
			const px = cx + dx * rr, py = cy + dy * rr * 0.85, pz = cz + dz * rr; // 세로 살짝 눌러 활엽 실루엣
			const t = 0.25 + 0.6 * keyHash(k, 500 + i);
			const sh = formShade(dx, dy, dz, sun, 0.45); // 태양면/그늘면 — 구형 입체감의 핵심
			const rgb = [mix(leaf[0], leaf2[0], t) * sh * gsh[0], mix(leaf[1], leaf2[1], t) * sh * gsh[1], mix(leaf[2], leaf2[2], t) * sh * gsh[2]];
			const blobR = crownR * (0.22 + keyHash(k, 600 + i) * 0.16); // 예전 0.42~0.77 → 절반 이하(클럼피 실루엣)
			pushSplat(arr, px, py, pz, rgb, 0.92, blobR, blobR * 0.8, blobR);
		}
	}

	// 침엽수 — 납작 원반 층 + 링 클러스터를 쌓은 원뿔. 어두운 청록 팔레트(게놈 잎색을 차갑게).
	function coniferSplats(cand, life, arr, gsh, sun, s) {
		const k = cand.key, h = 2.3 * s;
		const cx = cand.x, cz = cand.z;
		const leaf = [life.leaf[0] * 0.55, life.leaf[1] * 0.75, life.leaf[2] * 0.7]; // 차가운 침엽 톤
		const tr = life.trunk;
		pushSplat(arr, cx, cand.y + h * 0.12, cz, [tr[0] * gsh[0], tr[1] * gsh[1], tr[2] * gsh[2]], 0.95, 0.09 * s, h * 0.16, 0.09 * s);
		const L = 5;
		for (let li = 0; li < L; li++) {
			const f = li / (L - 1);                       // 0(아래)~1(꼭대기)
			const ly = cand.y + h * (0.28 + 0.62 * f);
			const lr = 0.62 * s * (1 - 0.78 * f);         // 위로 갈수록 좁게
			// 층 중심 원반 + 둘레 클러스터 4개 — 층별 링이 원뿔 실루엣을 만든다
			const csh = 0.55 + 0.45 * f;                  // 위층이 밝다(태양)
			pushSplat(arr, cx, ly, cz, [leaf[0] * csh * gsh[0], leaf[1] * csh * gsh[1], leaf[2] * csh * gsh[2]], 0.94, lr, lr * 0.3, lr);
			for (let i = 0; i < 4; i++) {
				const a = (keyHash(k, 700 + li * 7 + i) + i / 4) * 6.2831853;
				const dx = Math.cos(a), dz = Math.sin(a);
				const sh = formShade(dx, 0.35, dz, sun, 0.45);
				const rgb = [leaf[0] * sh * gsh[0], leaf[1] * sh * gsh[1], leaf[2] * sh * gsh[2]];
				pushSplat(arr, cx + dx * lr * 0.7, ly + jit(k, 800 + li * 7 + i, 0.08) * s, cz + dz * lr * 0.7,
					rgb, 0.9, lr * 0.5, lr * 0.35, lr * 0.5);
			}
		}
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
		return plyFromSplats(splatsFor(cands, life, world));
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
