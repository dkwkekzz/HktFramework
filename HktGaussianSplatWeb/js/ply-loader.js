// HktGaussianSplat Web — 3DGS binary PLY 파서 (UE FHktSplatPlyLoader 와 동일 수학)
// 반환 texData 레이아웃(16 float = 4 RGBA32F texel / splat):
//   [ px,py,pz,opacity | r,g,b,_ | covXX,covXY,covXZ,covYY | covYZ,covZZ,_,_ ]
// 웹 뷰어는 네이티브 좌표계 그대로 사용(축 리매핑/스케일 없음) — 카메라가 방향 처리.

(function (global) {
	'use strict';

	const SH_C0 = 0.28209479177387814;
	const sigmoid = (x) => 1 / (1 + Math.exp(-x));

	const TYPE_SIZE = {
		char: 1, uchar: 1, int8: 1, uint8: 1,
		short: 2, ushort: 2, int16: 2, uint16: 2,
		int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4,
		double: 8, float64: 8,
	};

	function readerFor(type) {
		switch (type) {
			case 'float': case 'float32': return (dv, o) => dv.getFloat32(o, true);
			case 'double': case 'float64': return (dv, o) => dv.getFloat64(o, true);
			case 'uchar': case 'uint8': return (dv, o) => dv.getUint8(o);
			case 'char': case 'int8': return (dv, o) => dv.getInt8(o);
			case 'ushort': case 'uint16': return (dv, o) => dv.getUint16(o, true);
			case 'short': case 'int16': return (dv, o) => dv.getInt16(o, true);
			case 'uint': case 'uint32': return (dv, o) => dv.getUint32(o, true);
			case 'int': case 'int32': return (dv, o) => dv.getInt32(o, true);
			default: return null;
		}
	}

	function parse(arrayBuffer) {
		const bytes = new Uint8Array(arrayBuffer);

		// end_header 위치 탐색
		const marker = 'end_header';
		let headerEnd = -1;
		for (let i = 0; i + marker.length <= bytes.length; i++) {
			let ok = true;
			for (let j = 0; j < marker.length; j++) { if (bytes[i + j] !== marker.charCodeAt(j)) { ok = false; break; } }
			if (ok) { let k = i + marker.length; while (k < bytes.length && bytes[k] !== 10) k++; headerEnd = k + 1; break; }
		}
		if (headerEnd < 0) throw new Error("PLY 헤더('end_header')를 찾지 못함");

		const headerText = new TextDecoder('ascii').decode(bytes.subarray(0, headerEnd));
		const lines = headerText.split(/\r?\n/);

		let format = '', count = 0, inVertex = false, stride = 0;
		const props = []; // {name, offset, read}
		for (const raw of lines) {
			const t = raw.trim().split(/\s+/);
			if (t[0] === 'format') format = t[1];
			else if (t[0] === 'element') { inVertex = (t[1] === 'vertex'); if (inVertex) count = parseInt(t[2], 10); }
			else if (t[0] === 'property' && inVertex) {
				const type = t[1], name = t[t.length - 1];
				const size = TYPE_SIZE[type];
				if (!size) throw new Error('지원하지 않는 PLY 프로퍼티 타입: ' + type);
				props.push({ name, offset: stride, read: readerFor(type) });
				stride += size;
			}
		}
		if (format.indexOf('binary_little_endian') < 0) {
			throw new Error('binary_little_endian PLY 만 지원 (현재: ' + format + ')');
		}
		if (count <= 0) throw new Error('vertex element 없음');

		const byName = {};
		for (const p of props) byName[p.name] = p;
		const req = ['x', 'y', 'z', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
		for (const r of req) if (!byName[r]) throw new Error('3DGS 필수 프로퍼티 누락: ' + r);

		const dv = new DataView(arrayBuffer, headerEnd);
		const G = (p, base) => p.read(dv, base + p.offset);

		const texData = new Float32Array(count * 16);
		const positions = new Float32Array(count * 3);
		let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

		const pX = byName.x, pY = byName.y, pZ = byName.z;
		const pS = [byName.scale_0, byName.scale_1, byName.scale_2];
		const pR = [byName.rot_0, byName.rot_1, byName.rot_2, byName.rot_3];
		const pO = byName.opacity;
		const pD = [byName.f_dc_0, byName.f_dc_1, byName.f_dc_2];

		for (let i = 0; i < count; i++) {
			const base = i * stride;
			const x = G(pX, base), y = G(pY, base), z = G(pZ, base);

			const s0 = Math.exp(G(pS[0], base)), s1 = Math.exp(G(pS[1], base)), s2 = Math.exp(G(pS[2], base));

			// 쿼터니언 (w,x,y,z) 정규화
			let qw = G(pR[0], base), qx = G(pR[1], base), qy = G(pR[2], base), qz = G(pR[3], base);
			const qn = Math.hypot(qw, qx, qy, qz) || 1; qw /= qn; qx /= qn; qy /= qn; qz /= qn;

			// R (3x3, row-major)
			const r00 = 1 - 2 * (qy * qy + qz * qz), r01 = 2 * (qx * qy - qw * qz), r02 = 2 * (qx * qz + qw * qy);
			const r10 = 2 * (qx * qy + qw * qz), r11 = 1 - 2 * (qx * qx + qz * qz), r12 = 2 * (qy * qz - qw * qx);
			const r20 = 2 * (qx * qz - qw * qy), r21 = 2 * (qy * qz + qw * qx), r22 = 1 - 2 * (qx * qx + qy * qy);

			// M = R * diag(s)  (열 스케일)
			const m00 = r00 * s0, m01 = r01 * s1, m02 = r02 * s2;
			const m10 = r10 * s0, m11 = r11 * s1, m12 = r12 * s2;
			const m20 = r20 * s0, m21 = r21 * s1, m22 = r22 * s2;

			// Sigma = M * M^T (상삼각)
			const cXX = m00 * m00 + m01 * m01 + m02 * m02;
			const cXY = m00 * m10 + m01 * m11 + m02 * m12;
			const cXZ = m00 * m20 + m01 * m21 + m02 * m22;
			const cYY = m10 * m10 + m11 * m11 + m12 * m12;
			const cYZ = m10 * m20 + m11 * m21 + m12 * m22;
			const cZZ = m20 * m20 + m21 * m21 + m22 * m22;

			const opacity = pO ? sigmoid(G(pO, base)) : 1.0;
			let cr = 0.5, cg = 0.5, cb = 0.5;
			if (pD[0]) {
				cr = Math.min(1, Math.max(0, 0.5 + SH_C0 * G(pD[0], base)));
				cg = Math.min(1, Math.max(0, 0.5 + SH_C0 * G(pD[1], base)));
				cb = Math.min(1, Math.max(0, 0.5 + SH_C0 * G(pD[2], base)));
			}

			const o = i * 16;
			texData[o + 0] = x; texData[o + 1] = y; texData[o + 2] = z; texData[o + 3] = opacity;
			texData[o + 4] = cr; texData[o + 5] = cg; texData[o + 6] = cb; texData[o + 7] = 0;
			texData[o + 8] = cXX; texData[o + 9] = cXY; texData[o + 10] = cXZ; texData[o + 11] = cYY;
			texData[o + 12] = cYZ; texData[o + 13] = cZZ; texData[o + 14] = 0; texData[o + 15] = 0;

			positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
			if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
			if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
		}

		const center = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
		const radius = 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;

		return { count, texData, positions, bounds: { center, radius } };
	}

	global.HktSplatPly = { parse };
})(window);
