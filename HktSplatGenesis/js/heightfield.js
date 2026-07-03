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

	// 삼각형 수프 → heightfield: 각 삼각형을 XZ 격자에 래스터라이즈, 셀 중심의 최대 y 를 기록.
	// transform: 무대 정합 노브와 동일한 변환 (v → offset + Ry(yaw)·(scale·Rx(flip)·v)).
	// 커버되지 않은 셀은 floorY(기본 0) — 지형 밖은 기존 평면 거동.
	function bake(triSoup, opts) {
		const res = opts.res || 128;
		const originX = opts.originX, originZ = opts.originZ, cell = opts.cell;
		const floorY = opts.floorY || 0;
		const t = opts.transform || { x: 0, y: 0, z: 0, scale: 1, yawDeg: 0, flip: false };
		const cy = Math.cos(t.yawDeg * Math.PI / 180), sy = Math.sin(t.yawDeg * Math.PI / 180);
		const fs = t.flip ? -1 : 1; // Rx(π): y→-y, z→-z
		const data = new Float32Array(res * res).fill(-1e9);
		const xf = (i) => { // triSoup[i..i+2] → 월드 (무대 rig 와 동일 변환)
			const x0 = triSoup[i], y0 = triSoup[i + 1] * fs, z0 = triSoup[i + 2] * fs;
			const sx = x0 * t.scale, sy2 = y0 * t.scale, sz = z0 * t.scale;
			return [cy * sx + sy * sz + t.x, sy2 + t.y, -sy * sx + cy * sz + t.z];
		};
		const nTri = triSoup.length / 9;
		for (let ti = 0; ti < nTri; ti++) {
			const a = xf(ti * 9), b = xf(ti * 9 + 3), c = xf(ti * 9 + 6);
			// XZ 투영 barycentric — 수직 벽(퇴화 투영)은 스킵
			const d00x = b[0] - a[0], d00z = b[2] - a[2];
			const d01x = c[0] - a[0], d01z = c[2] - a[2];
			const den = d00x * d01z - d01x * d00z;
			if (Math.abs(den) < 1e-12) continue;
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
		let covered = 0;
		for (let i = 0; i < data.length; i++) {
			if (data[i] < -1e8) data[i] = floorY; else covered++;
		}
		return { data, res, originX, originZ, cell, coverage: covered / data.length };
	}

	global.HktHeightfield = { parseGLB, bake };
})(window);
