// 절차 지형 fixture — S 트랙 하니스 공용. 같은 height() 로 PLY(무대 비주얼)와
// GLB(collider)를 만들므로 두 파일이 정확히 정합된다. 무대는 "로드 대상"이라
// fixture 를 코드로 만드는 것은 절대 원칙 1 위배가 아니다 (생명이 아님).
//
// 주의: 골짜기 최저가 시뮬 격자 바닥(y = -0.8)보다 낮으면 그 영역에서 L2 이웃
// 규칙이 꺼진다(격자 밖) — 진폭 합 1.08 + 오프셋 0.35 = 범위 [-0.73, 1.43] 유지.

const SH_C0 = 0.28209479177387814;

function height(x, z) {
	return 0.55 * Math.sin(0.9 * x) * Math.cos(0.7 * z) +
		0.35 * Math.sin(1.7 * z + 1.3) * Math.cos(1.3 * x - 0.7) +
		0.18 * Math.sin(2.6 * x + 2.1 * z) + 0.35;
}

const hash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; return ((x >>> 0) / 4294967296); };

// 3DGS PLY (binary_little_endian, 표준 17 속성) — 무대 비주얼용 스플랫 지형
// G: 한 변 스플랫 수 (하니스 72, 샘플 에셋은 tools/gen-sample-terrain.js 가 밀도 상향)
function genTerrainPly(G = 72, splatScale = 1) {
	const N = G * G;
	const header = 'ply\nformat binary_little_endian 1.0\n' +
		`element vertex ${N}\n` +
		['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
			'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3']
			.map((p) => `property float ${p}`).join('\n') + '\nend_header\n';
	const body = Buffer.alloc(N * 17 * 4);
	let o = 0;
	const put = (v) => { body.writeFloatLE(v, o); o += 4; };
	for (let i = 0; i < N; i++) {
		const gx = i % G, gz = (i / G) | 0;
		const x = -4.2 + 8.4 * (gx + hash(i * 3) - 0.5) / (G - 1);
		const z = -4.2 + 8.4 * (gz + hash(i * 3 + 1) - 0.5) / (G - 1);
		const y = height(x, z);
		// 팔레트: 계곡 짙은 녹색 → 풀 → 바위 → 설선 (높이 밴드 + 지터)
		const t = Math.max(0, Math.min(1, (y + 0.73) / 2.16));
		let r, g, b;
		if (t < 0.45) { const u = t / 0.45; r = 0.10 + 0.18 * u; g = 0.30 + 0.20 * u; b = 0.12 + 0.07 * u; }
		else if (t < 0.8) { const u = (t - 0.45) / 0.35; r = 0.28 + 0.18 * u; g = 0.50 - 0.09 * u; b = 0.19 + 0.20 * u; }
		else { const u = (t - 0.8) / 0.2; r = 0.46 + 0.45 * u; g = 0.41 + 0.51 * u; b = 0.39 + 0.56 * u; }
		const j = (hash(i * 7) - 0.5) * 0.06;
		put(x); put(y); put(z); put(0); put(0); put(0);
		put((r + j - 0.5) / SH_C0); put((g + j - 0.5) / SH_C0); put((b + j - 0.5) / SH_C0);
		put(2.44); // opacity 0.92 의 logit
		// 납작한 surfel — 밀도(G)를 올리면 splatScale 로 개별 크기를 줄여 커버리지 유지
		put(Math.log(0.17 * splatScale)); put(Math.log(0.06 * splatScale)); put(Math.log(0.17 * splatScale));
		put(1); put(0); put(0); put(0); // 쿼터니언 (w,x,y,z)
	}
	return Buffer.concat([Buffer.from(header, 'ascii'), body]);
}

// collider GLB — 같은 height() 의 삼각형 격자 메시 (POSITION + uint32 indices, 비압축)
function genTerrainGlb(G = 96) {
	const V = (G + 1) * (G + 1);
	const pos = new Float32Array(V * 3);
	const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
	for (let vz = 0; vz <= G; vz++)
		for (let vx = 0; vx <= G; vx++) {
			const x = -4.8 + 9.6 * vx / G, z = -4.8 + 9.6 * vz / G;
			const y = height(x, z);
			const o = (vz * (G + 1) + vx) * 3;
			pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
			for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pos[o + c]); mx[c] = Math.max(mx[c], pos[o + c]); }
		}
	const idx = new Uint32Array(G * G * 6);
	let k = 0;
	for (let vz = 0; vz < G; vz++)
		for (let vx = 0; vx < G; vx++) {
			const a = vz * (G + 1) + vx, b = a + 1, c = a + G + 1, d = c + 1;
			idx[k++] = a; idx[k++] = c; idx[k++] = b;
			idx[k++] = b; idx[k++] = c; idx[k++] = d;
		}
	const posB = Buffer.from(pos.buffer), idxB = Buffer.from(idx.buffer);
	const json = JSON.stringify({
		asset: { version: '2.0' },
		scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: V, type: 'VEC3', min: mn, max: mx },
			{ bufferView: 1, componentType: 5125, count: idx.length, type: 'SCALAR' },
		],
		bufferViews: [
			{ buffer: 0, byteOffset: 0, byteLength: posB.length },
			{ buffer: 0, byteOffset: posB.length, byteLength: idxB.length },
		],
		buffers: [{ byteLength: posB.length + idxB.length }],
	});
	const pad4 = (n) => (n % 4 ? 4 - n % 4 : 0);
	const jsonB = Buffer.concat([Buffer.from(json, 'utf8'), Buffer.alloc(pad4(json.length), 0x20)]);
	const binB = Buffer.concat([posB, idxB, Buffer.alloc(pad4(posB.length + idxB.length))]);
	const head = Buffer.alloc(12 + 8 + 8);
	head.writeUInt32LE(0x46546c67, 0); // 'glTF'
	head.writeUInt32LE(2, 4);
	head.writeUInt32LE(12 + 8 + jsonB.length + 8 + binB.length, 8);
	head.writeUInt32LE(jsonB.length, 12);
	head.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
	const binHead = Buffer.alloc(8);
	binHead.writeUInt32LE(binB.length, 0);
	binHead.writeUInt32LE(0x004e4942, 4); // 'BIN\0'
	return Buffer.concat([head.slice(0, 20), jsonB, binHead, binB]);
}

// 페이지 컨텍스트 주입용 height() 소스 — 지표 계산이 같은 지형을 참조하게
const HEIGHT_SRC = height.toString();

module.exports = { height, genTerrainPly, genTerrainGlb, HEIGHT_SRC };
