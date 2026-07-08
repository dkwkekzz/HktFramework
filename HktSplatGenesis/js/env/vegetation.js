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

	// 나무 = 기둥(갈색, 세로로 늘인 소수 스플랫) + 수관(잎색 램프, 둥근 군집). 크기는 게놈 treeSize.
	// gsh: 지면 명암(0.52..1) — 지형 Bake 셰이딩과 통합(그늘 슬로프의 나무는 어둡게).
	function treeSplats(cand, life, arr, gsh) {
		const k = cand.key, s = life.treeSize * (0.82 + keyHash(k, 5) * 0.5); // 개체별 크기 변주
		const h = 1.7 * s, crownR = 0.72 * s, crownY = cand.y + h * 0.62;
		// 기둥 — 아래→위 3단, 세로로 늘인 얇은 스플랫
		const trunkR = 0.11 * s, tr = life.trunk;
		for (let i = 0; i < 3; i++) {
			const ty = cand.y + h * (0.12 + i * 0.16);
			pushSplat(arr, cand.x, ty, cand.z, [tr[0] * gsh, tr[1] * gsh, tr[2] * gsh], 0.95, trunkR, h * 0.14, trunkR);
		}
		// 수관 — 둥근 군집(잎색1↔잎색2 램프로 명암 변주), 위로 갈수록 밝게 · 전체는 지면 명암 gsh
		const n = 11;
		for (let i = 0; i < n; i++) {
			const a = keyHash(k, 100 + i) * 6.2831853;
			const rr = crownR * (0.35 + keyHash(k, 200 + i) * 0.7);
			const yy = crownY + jit(k, 300 + i, 1) * crownR * 0.85;
			const px = cand.x + Math.cos(a) * rr, pz = cand.z + Math.sin(a) * rr;
			const up = ((yy - (crownY - crownR)) / (2 * crownR));           // 0(아래)~1(위)
			const t = 0.3 + 0.7 * up + jit(k, 400 + i, 0.15);
			const sh = gsh * (0.82 + 0.18 * up); // 위쪽(태양 면) 살짝 더 밝게
			const rgb = [mix(life.leaf[0], life.leaf2[0], t) * sh, mix(life.leaf[1], life.leaf2[1], t) * sh, mix(life.leaf[2], life.leaf2[2], t) * sh];
			const blobR = crownR * (0.42 + keyHash(k, 500 + i) * 0.35);
			pushSplat(arr, px, yy, pz, rgb, 0.9, blobR, blobR * 0.85, blobR);
		}
	}

	// 바위 = 회색 타원 블롭 2~3개(지면에 낮게). 급경사에도 놓임. treeSize 무관(자체 크기).
	function rockSplats(cand, life, arr, gsh) {
		const k = cand.key, s = 0.5 + keyHash(k, 7) * 0.9;
		const n = 2 + (keyHash(k, 9) > 0.5 ? 1 : 0);
		for (let i = 0; i < n; i++) {
			const px = cand.x + jit(k, 10 + i, 0.35 * s), pz = cand.z + jit(k, 20 + i, 0.35 * s);
			const py = cand.y + 0.12 * s;
			const shade = gsh * (0.8 + jit(k, 30 + i, 0.18));
			const rgb = [life.rock[0] * shade, life.rock[1] * shade, life.rock[2] * shade];
			const rx = 0.34 * s * (0.7 + keyHash(k, 40 + i) * 0.7);
			pushSplat(arr, px, py, pz, rgb, 0.98, rx, rx * 0.6, rx * 0.85);
		}
	}

	// 후보 목록 → 식생 스플랫 배열(10 float/스플랫). 나무·바위만(모닥불은 시뮬 전용).
	// world.shadeAt 이 있으면 스폰 자리의 지면 명암을 곱해 지형 Bake 셰이딩과 통합한다.
	function splatsFor(cands, life, world) {
		const arr = [];
		const shadeAt = (world && world.shadeAt) ? world.shadeAt : null;
		for (const c of cands) {
			const gsh = shadeAt ? shadeAt(c.x, c.z, false) : 1;
			if (c.kind === 'tree') treeSplats(c, life, arr, gsh);
			else if (c.kind === 'rock') rockSplats(c, life, arr, gsh);
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
