// HktSplatGenesis — S2 지형: collider GLB → heightfield 베이크 (classic script, 의존성 없음)
//
// Marble 의 Collider Mesh(GLB)를 파싱해 삼각형 수프를 얻고, 시뮬 격자 XZ 영역 위에
// 최대 높이(heightfield)를 굽는다. 결과는 engine.setHeightfield 로 GPU 텍스처가 된다.
// three(GLTFLoader)를 쓰지 않는 이유: 이 데이터는 *생명(시뮬)* 쪽 입력이라 vendor three
// 반입 금지 컨벤션이 적용된다 — 필요한 것은 POSITION+indices 뿐이라 최소 파서로 충분.
//
// 한계(의도): TRIANGLES(mode 4) + float32 POSITION 만. Draco/quantized 확장은 거부하고
// 명확한 에러를 낸다 (Marble collider 는 비압축 표준 glTF).

(function (global) {
	'use strict';

	const COMP = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

	// GLB 컨테이너 → glTF JSON + BIN chunk
	function parseGlbChunks(buf) {
		const dv = new DataView(buf);
		if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('GLB 매직 불일치 (.glb 파일인가?)');
		let off = 12, json = null, bin = null;
		while (off < buf.byteLength) {
			const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
			const body = buf.slice(off + 8, off + 8 + len);
			if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
			else if (type === 0x004e4942) bin = body;
			off += 8 + len + (len % 4 ? 4 - len % 4 : 0);
		}
		if (!json || !bin) throw new Error('GLB 청크 누락 (JSON/BIN)');
		return { json, bin };
	}

	function accessorArray(json, bin, idx) {
		const acc = json.accessors[idx];
		const T = COMP[acc.componentType];
		if (!T) throw new Error('미지원 componentType: ' + acc.componentType);
		if (acc.sparse) throw new Error('sparse accessor 미지원');
		const ncomp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
		const bv = json.bufferViews[acc.bufferView];
		const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
		const stride = bv.byteStride || ncomp * T.BYTES_PER_ELEMENT;
		if (stride === ncomp * T.BYTES_PER_ELEMENT) {
			return new T(bin, base, acc.count * ncomp);
		}
		// interleaved — 복사로 풀어낸다
		const out = new T(acc.count * ncomp);
		const dv = new DataView(bin);
		const get = { 5121: 'getUint8', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[acc.componentType];
		for (let i = 0; i < acc.count; i++)
			for (let c = 0; c < ncomp; c++)
				out[i * ncomp + c] = dv[get](base + i * stride + c * T.BYTES_PER_ELEMENT, true);
		return out;
	}

	// column-major mat4 곱/적용 (three 규약과 동일)
	function mat4Mul(a, b) {
		const m = new Float32Array(16);
		for (let c = 0; c < 4; c++)
			for (let r = 0; r < 4; r++)
				m[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
		return m;
	}
	function nodeMatrix(node) {
		if (node.matrix) return new Float32Array(node.matrix);
		const t = node.translation || [0, 0, 0];
		const q = node.rotation || [0, 0, 0, 1];
		const s = node.scale || [1, 1, 1];
		const [x, y, z, w] = q;
		return new Float32Array([
			(1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + w * z)) * s[0], (2 * (x * z - w * y)) * s[0], 0,
			(2 * (x * y - w * z)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + w * x)) * s[1], 0,
			(2 * (x * z + w * y)) * s[2], (2 * (y * z - w * x)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
			t[0], t[1], t[2], 1,
		]);
	}

	// GLB → 월드 좌표 삼각형 수프 (Float32Array, 정점 3개 × 3성분 연속)
	function parseGLB(buf) {
		const { json, bin } = parseGlbChunks(buf);
		const req = json.extensionsRequired || [];
		if (req.length) throw new Error('필수 glTF 확장 미지원: ' + req.join(', ') + ' (비압축 collider 를 사용할 것)');
		const tris = [];
		let triCount = 0;
		function visit(ni, parent) {
			const node = json.nodes[ni];
			const m = mat4Mul(parent, nodeMatrix(node));
			if (node.mesh != null) {
				for (const prim of json.meshes[node.mesh].primitives) {
					if (prim.mode != null && prim.mode !== 4) continue; // TRIANGLES 만
					if (prim.attributes.POSITION == null) continue;
					const pos = accessorArray(json, bin, prim.attributes.POSITION);
					const idx = prim.indices != null ? accessorArray(json, bin, prim.indices) : null;
					const nIdx = idx ? idx.length : pos.length / 3;
					const out = new Float32Array(nIdx * 3);
					for (let k = 0; k < nIdx; k++) {
						const vi = (idx ? idx[k] : k) * 3;
						const x = pos[vi], y = pos[vi + 1], z = pos[vi + 2];
						out[k * 3 + 0] = m[0] * x + m[4] * y + m[8] * z + m[12];
						out[k * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
						out[k * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
					}
					tris.push(out);
					triCount += nIdx / 3;
				}
			}
			for (const c of node.children || []) visit(c, m);
		}
		const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
		const sceneNodes = (json.scenes && json.scenes[json.scene || 0] || {}).nodes || json.nodes.map((_, i) => i);
		for (const ni of sceneNodes) visit(ni, I);
		if (!triCount) throw new Error('삼각형 없음 (TRIANGLES 프리미티브 부재)');
		const all = new Float32Array(tris.reduce((s, a) => s + a.length, 0));
		let o = 0;
		for (const a of tris) { all.set(a, o); o += a.length; }
		return all; // 정점 9 float = 삼각형 1개
	}

	// 삼각형 하나(월드 좌표 a,b,c)를 XZ 격자에 래스터라이즈, 셀 중심의 최대 y 갱신.
	function rasterTri(a, b, c, data, res, originX, originZ, cell) {
		// XZ 투영 barycentric — 수직 벽(퇴화 투영)은 스킵
		const d00x = b[0] - a[0], d00z = b[2] - a[2];
		const d01x = c[0] - a[0], d01z = c[2] - a[2];
		const den = d00x * d01z - d01x * d00z;
		if (Math.abs(den) < 1e-12) return;
		const minU = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - originX) / cell));
		const maxU = Math.min(res - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - originX) / cell));
		const minV = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - originZ) / cell));
		const maxV = Math.min(res - 1, Math.ceil((Math.max(a[2], b[2], c[2]) - originZ) / cell));
		for (let v = minV; v <= maxV; v++) {
			const pz = originZ + v * cell;
			for (let u = minU; u <= maxU; u++) {
				const px = originX + u * cell;
				const w1 = ((px - a[0]) * d01z - (pz - a[2]) * d01x) / den;
				const w2 = ((pz - a[2]) * d00x - (px - a[0]) * d00z) / den;
				if (w1 < -1e-4 || w2 < -1e-4 || w1 + w2 > 1.0001) continue;
				const h = a[1] + w1 * (b[1] - a[1]) + w2 * (c[1] - a[1]);
				const di = v * res + u;
				if (h > data[di]) data[di] = h;
			}
		}
	}

	// triSoup 정점 → 무대 정합 변환(v → offset + Ry(yaw)·(scale·Rx(flip)·v)) 적용
	function makeXform(t) {
		t = t || { x: 0, y: 0, z: 0, scale: 1, yawDeg: 0, flip: false };
		const cy = Math.cos(t.yawDeg * Math.PI / 180), sy = Math.sin(t.yawDeg * Math.PI / 180);
		const fs = t.flip ? -1 : 1; // Rx(π): y→-y, z→-z
		return (arr, i) => {
			const x0 = arr[i], y0 = arr[i + 1] * fs, z0 = arr[i + 2] * fs;
			const sx = x0 * t.scale, sy2 = y0 * t.scale, sz = z0 * t.scale;
			return [cy * sx + sy * sz + t.x, sy2 + t.y, -sy * sx + cy * sz + t.z];
		};
	}

	// 삼각형 수프 → heightfield: 각 삼각형을 XZ 격자에 래스터라이즈, 셀 중심의 최대 y 를 기록.
	// 커버되지 않은 셀은 floorY(기본 0) — 지형 밖은 기존 평면 거동. O(전체 삼각형) —
	// 대용량 실에셋은 buildIndex + bakeIndexed 로 O(창) 경로를 쓴다.
	function bake(triSoup, opts) {
		const res = opts.res || 128;
		const originX = opts.originX, originZ = opts.originZ, cell = opts.cell;
		const floorY = opts.floorY || 0;
		const xf = makeXform(opts.transform);
		const data = new Float32Array(res * res).fill(-1e9);
		const nTri = triSoup.length / 9;
		for (let ti = 0; ti < nTri; ti++)
			rasterTri(xf(triSoup, ti * 9), xf(triSoup, ti * 9 + 3), xf(triSoup, ti * 9 + 6), data, res, originX, originZ, cell);
		let covered = 0;
		for (let i = 0; i < data.length; i++) {
			if (data[i] < -1e8) data[i] = floorY; else covered++;
		}
		return { data, res, originX, originZ, cell, coverage: covered / data.length };
	}

	// T3 시뮬 바닥 가상화 (절차 월드): height(x,z) 함수를 창 위에서 직접 평가한다.
	// triSoup 경유·삼각형 순회 없음 — 비용 O(창), 월드 전체 크기와 무관. 청크 스트리밍
	// 월드의 시뮬 바닥은 이 경로로 굽는다 (커버리지 1 — 함수는 어디서나 값이 있다).
	function bakeFn(heightFn, opts) {
		const res = opts.res || 128;
		const originX = opts.originX, originZ = opts.originZ, cell = opts.cell;
		const data = new Float32Array(res * res);
		for (let v = 0; v < res; v++) {
			const z = originZ + v * cell;
			for (let u = 0; u < res; u++) data[v * res + u] = heightFn(originX + u * cell, z);
		}
		return { data, res, originX, originZ, cell, coverage: 1 };
	}

	// T3 확장성(실에셋): 대용량 collider 삼각형을 월드 XZ 버킷으로 인덱싱한다. transform 은
	// 인덱스 빌드 시 한 번만 적용해 월드 좌표 삼각형으로 저장 — 이후 bakeIndexed 는 창에 걸린
	// 버킷의 삼각형만 순회(O(창)). 한 번 만들어 두고 버블이 움직일 때마다 재사용한다.
	function buildIndex(triSoup, opts) {
		opts = opts || {};
		const bucket = opts.bucket || 4.8;      // 버킷 한 변(m) — 시뮬 버블 반폭
		const xf = makeXform(opts.transform);
		const nTri = triSoup.length / 9;
		const tris = new Float32Array(nTri * 9); // 월드 좌표 삼각형(변환 적용)
		let minX = 1e30, minZ = 1e30, maxX = -1e30, maxZ = -1e30;
		for (let k = 0; k < nTri; k++)
			for (let c = 0; c < 3; c++) {
				const p = xf(triSoup, k * 9 + c * 3);
				tris[k * 9 + c * 3] = p[0]; tris[k * 9 + c * 3 + 1] = p[1]; tris[k * 9 + c * 3 + 2] = p[2];
				if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
				if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
			}
		const nx = Math.max(1, Math.ceil((maxX - minX) / bucket) + 1);
		const nz = Math.max(1, Math.ceil((maxZ - minZ) / bucket) + 1);
		const cells = new Array(nx * nz);
		for (let i = 0; i < cells.length; i++) cells[i] = [];
		for (let k = 0; k < nTri; k++) {
			let tminX = 1e30, tmaxX = -1e30, tminZ = 1e30, tmaxZ = -1e30;
			for (let c = 0; c < 3; c++) {
				const x = tris[k * 9 + c * 3], z = tris[k * 9 + c * 3 + 2];
				if (x < tminX) tminX = x; if (x > tmaxX) tmaxX = x;
				if (z < tminZ) tminZ = z; if (z > tmaxZ) tmaxZ = z;
			}
			const u0 = Math.max(0, Math.floor((tminX - minX) / bucket)), u1 = Math.min(nx - 1, Math.floor((tmaxX - minX) / bucket));
			const v0 = Math.max(0, Math.floor((tminZ - minZ) / bucket)), v1 = Math.min(nz - 1, Math.floor((tmaxZ - minZ) / bucket));
			for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) cells[v * nx + u].push(k);
		}
		return { tris, cells, nx, nz, minX, minZ, bucket, nTri };
	}

	// 인덱스 기반 창 베이크 — tris 는 이미 월드 좌표라 transform 무시. bake 와 동일 결과(창 안).
	function bakeIndexed(index, opts) {
		const res = opts.res || 128;
		const originX = opts.originX, originZ = opts.originZ, cell = opts.cell, floorY = opts.floorY || 0;
		const data = new Float32Array(res * res).fill(-1e9);
		const u0 = Math.max(0, Math.floor((originX - index.minX) / index.bucket));
		const u1 = Math.min(index.nx - 1, Math.floor((originX + res * cell - index.minX) / index.bucket));
		const v0 = Math.max(0, Math.floor((originZ - index.minZ) / index.bucket));
		const v1 = Math.min(index.nz - 1, Math.floor((originZ + res * cell - index.minZ) / index.bucket));
		const tris = index.tris, seen = new Set();
		let touched = 0;
		for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) {
			const arr = index.cells[v * index.nx + u];
			for (let m = 0; m < arr.length; m++) {
				const k = arr[m];
				if (seen.has(k)) continue; seen.add(k); touched++;
				const o = k * 9;
				rasterTri([tris[o], tris[o + 1], tris[o + 2]], [tris[o + 3], tris[o + 4], tris[o + 5]], [tris[o + 6], tris[o + 7], tris[o + 8]], data, res, originX, originZ, cell);
			}
		}
		let covered = 0;
		for (let i = 0; i < data.length; i++) {
			if (data[i] < -1e8) data[i] = floorY; else covered++;
		}
		return { data, res, originX, originZ, cell, coverage: covered / data.length, touched };
	}

	const api = { parseGLB, bake, bakeFn, buildIndex, bakeIndexed };
	global.HktHeightfield = api;
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
