// HktGaussianSplat Web — 스플랫 파서 (binary/ascii PLY + antimatter15 .splat)
// 반환 texData 레이아웃(16 float = 4 RGBA32F texel / splat):
//   [ px,py,pz,opacity | r,g,b,_ | covXX,covXY,covXZ,covYY | covYZ,covZZ,_,_ ]
// 웹 뷰어는 네이티브 좌표계 그대로 사용(축 리매핑/스케일 없음).

(function (global) {
	'use strict';

	const SH_C0 = 0.28209479177387814;
	const sigmoid = (x) => 1 / (1 + Math.exp(-x));
	const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

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

	// ── 공통: 선형 스케일 + 쿼터니언 + 색/불투명도(0..1) → 데이터 텍스처 기록 ──
	// (PLY 경로는 exp/sigmoid/SH 를 먼저 적용해 여기로 넘긴다)
	function writeSplat(td, pos, i, x, y, z, s0, s1, s2, qw, qx, qy, qz, cr, cg, cb, opacity, bb) {
		const qn = Math.hypot(qw, qx, qy, qz) || 1; qw /= qn; qx /= qn; qy /= qn; qz /= qn;

		const r00 = 1 - 2 * (qy * qy + qz * qz), r01 = 2 * (qx * qy - qw * qz), r02 = 2 * (qx * qz + qw * qy);
		const r10 = 2 * (qx * qy + qw * qz), r11 = 1 - 2 * (qx * qx + qz * qz), r12 = 2 * (qy * qz - qw * qx);
		const r20 = 2 * (qx * qz - qw * qy), r21 = 2 * (qy * qz + qw * qx), r22 = 1 - 2 * (qx * qx + qy * qy);

		const m00 = r00 * s0, m01 = r01 * s1, m02 = r02 * s2;
		const m10 = r10 * s0, m11 = r11 * s1, m12 = r12 * s2;
		const m20 = r20 * s0, m21 = r21 * s1, m22 = r22 * s2;

		const cXX = m00 * m00 + m01 * m01 + m02 * m02;
		const cXY = m00 * m10 + m01 * m11 + m02 * m12;
		const cXZ = m00 * m20 + m01 * m21 + m02 * m22;
		const cYY = m10 * m10 + m11 * m11 + m12 * m12;
		const cYZ = m10 * m20 + m11 * m21 + m12 * m22;
		const cZZ = m20 * m20 + m21 * m21 + m22 * m22;

		const o = i * 16;
		td[o] = x; td[o + 1] = y; td[o + 2] = z; td[o + 3] = opacity;
		td[o + 4] = cr; td[o + 5] = cg; td[o + 6] = cb; td[o + 7] = 0;
		td[o + 8] = cXX; td[o + 9] = cXY; td[o + 10] = cXZ; td[o + 11] = cYY;
		td[o + 12] = cYZ; td[o + 13] = cZZ; td[o + 14] = 0; td[o + 15] = 0;

		pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
		if (x < bb.minX) bb.minX = x; if (y < bb.minY) bb.minY = y; if (z < bb.minZ) bb.minZ = z;
		if (x > bb.maxX) bb.maxX = x; if (y > bb.maxY) bb.maxY = y; if (z > bb.maxZ) bb.maxZ = z;
	}

	function makeResult(count, texData, positions, bb) {
		const center = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2, (bb.minZ + bb.maxZ) / 2];
		const radius = 0.5 * Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY, bb.maxZ - bb.minZ) || 1;
		return { count, texData, positions, bounds: { center, radius } };
	}

	function newBounds() {
		return { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
	}

	// ── PLY 헤더 파싱 (공통) ──
	function parsePlyHeader(bytes) {
		const marker = 'end_header';
		let headerEnd = -1;
		for (let i = 0; i + marker.length <= bytes.length; i++) {
			let ok = true;
			for (let j = 0; j < marker.length; j++) { if (bytes[i + j] !== marker.charCodeAt(j)) { ok = false; break; } }
			if (ok) { let k = i + marker.length; while (k < bytes.length && bytes[k] !== 10) k++; headerEnd = k + 1; break; }
		}
		if (headerEnd < 0) throw new Error("PLY 헤더('end_header')를 찾지 못함");

		const text = new TextDecoder('ascii').decode(bytes.subarray(0, headerEnd));
		let format = '', count = 0, inVertex = false, stride = 0;
		const props = [];
		for (const raw of text.split(/\r?\n/)) {
			const t = raw.trim().split(/\s+/);
			if (t[0] === 'format') format = t[1];
			else if (t[0] === 'element') { inVertex = (t[1] === 'vertex'); if (inVertex) count = parseInt(t[2], 10); }
			else if (t[0] === 'property' && inVertex) {
				const type = t[1], name = t[t.length - 1];
				const size = TYPE_SIZE[type];
				if (!size) throw new Error('지원하지 않는 PLY 프로퍼티 타입: ' + type);
				props.push({ name, type, offset: stride, read: readerFor(type) });
				stride += size;
			}
		}
		if (count <= 0) throw new Error('vertex element 없음');
		return { headerEnd, format, count, props, stride };
	}

	function requireFields(byName) {
		// byName 값은 prop 객체(binary) 또는 인덱스 숫자(ascii, 0 가능) — undefined 만 누락으로 판정.
		const req = ['x', 'y', 'z', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
		for (const r of req) if (byName[r] === undefined) throw new Error('3DGS 필수 프로퍼티 누락: ' + r);
	}

	// ── binary_little_endian PLY ──
	function parsePlyBinary(arrayBuffer, hdr) {
		const { headerEnd, count, props, stride } = hdr;
		const byName = {}; for (const p of props) byName[p.name] = p;
		requireFields(byName);

		const dv = new DataView(arrayBuffer, headerEnd);
		const G = (p, base) => p.read(dv, base + p.offset);
		const pX = byName.x, pY = byName.y, pZ = byName.z;
		const pS = [byName.scale_0, byName.scale_1, byName.scale_2];
		const pR = [byName.rot_0, byName.rot_1, byName.rot_2, byName.rot_3];
		const pO = byName.opacity, pD = [byName.f_dc_0, byName.f_dc_1, byName.f_dc_2];

		const td = new Float32Array(count * 16), pos = new Float32Array(count * 3), bb = newBounds();
		for (let i = 0; i < count; i++) {
			const b = i * stride;
			const opacity = pO ? sigmoid(G(pO, b)) : 1.0;
			let cr = 0.5, cg = 0.5, cb = 0.5;
			if (pD[0]) { cr = clamp01(0.5 + SH_C0 * G(pD[0], b)); cg = clamp01(0.5 + SH_C0 * G(pD[1], b)); cb = clamp01(0.5 + SH_C0 * G(pD[2], b)); }
			writeSplat(td, pos, i, G(pX, b), G(pY, b), G(pZ, b),
				Math.exp(G(pS[0], b)), Math.exp(G(pS[1], b)), Math.exp(G(pS[2], b)),
				G(pR[0], b), G(pR[1], b), G(pR[2], b), G(pR[3], b), cr, cg, cb, opacity, bb);
		}
		return makeResult(count, td, pos, bb);
	}

	// ── ascii PLY ──
	function parsePlyAscii(arrayBuffer, hdr) {
		const { headerEnd, count, props } = hdr;
		const idx = {}; props.forEach((p, i) => { idx[p.name] = i; });
		requireFields(idx);

		const bodyText = new TextDecoder('ascii').decode(new Uint8Array(arrayBuffer, headerEnd));
		// 공백/개행 단일 스트림 토큰화 (라인 경계 무시 — 정점당 props.length 토큰)
		const tok = bodyText.trim().split(/\s+/);
		const np = props.length;
		const F = (name, row) => parseFloat(tok[row * np + idx[name]]);

		const td = new Float32Array(count * 16), pos = new Float32Array(count * 3), bb = newBounds();
		const hasDC = idx.f_dc_0 !== undefined, hasO = idx.opacity !== undefined;
		for (let i = 0; i < count; i++) {
			const opacity = hasO ? sigmoid(F('opacity', i)) : 1.0;
			let cr = 0.5, cg = 0.5, cb = 0.5;
			if (hasDC) { cr = clamp01(0.5 + SH_C0 * F('f_dc_0', i)); cg = clamp01(0.5 + SH_C0 * F('f_dc_1', i)); cb = clamp01(0.5 + SH_C0 * F('f_dc_2', i)); }
			writeSplat(td, pos, i, F('x', i), F('y', i), F('z', i),
				Math.exp(F('scale_0', i)), Math.exp(F('scale_1', i)), Math.exp(F('scale_2', i)),
				F('rot_0', i), F('rot_1', i), F('rot_2', i), F('rot_3', i), cr, cg, cb, opacity, bb);
		}
		return makeResult(count, td, pos, bb);
	}

	// ── antimatter15 .splat (32 bytes/splat) ──
	//   pos: 3×f32 | scale(linear): 3×f32 | color: 4×u8(rgba) | rot: 4×u8((q·128)+128)
	function parseSplat(arrayBuffer) {
		const REC = 32;
		if (arrayBuffer.byteLength % REC !== 0) throw new Error('.splat 크기가 32의 배수가 아님');
		const count = arrayBuffer.byteLength / REC;
		const dv = new DataView(arrayBuffer);
		const u8 = new Uint8Array(arrayBuffer);

		const td = new Float32Array(count * 16), pos = new Float32Array(count * 3), bb = newBounds();
		for (let i = 0; i < count; i++) {
			const b = i * REC;
			const x = dv.getFloat32(b, true), y = dv.getFloat32(b + 4, true), z = dv.getFloat32(b + 8, true);
			const s0 = dv.getFloat32(b + 12, true), s1 = dv.getFloat32(b + 16, true), s2 = dv.getFloat32(b + 20, true);
			const cr = u8[b + 24] / 255, cg = u8[b + 25] / 255, cbb = u8[b + 26] / 255, opacity = u8[b + 27] / 255;
			// rot 바이트는 ply rot_0..3 순서(w,x,y,z) 유지 → (byte-128)/128
			const qw = (u8[b + 28] - 128) / 128, qx = (u8[b + 29] - 128) / 128, qy = (u8[b + 30] - 128) / 128, qz = (u8[b + 31] - 128) / 128;
			// .splat 스케일은 이미 선형(exp 적용 완료) → 그대로 전달
			writeSplat(td, pos, i, x, y, z, s0, s1, s2, qw, qx, qy, qz, cr, cg, cbb, opacity, bb);
		}
		return makeResult(count, td, pos, bb);
	}

	// ── 디스패치 ──
	function parse(arrayBuffer, filename) {
		const bytes = new Uint8Array(arrayBuffer);
		const isPly = bytes.length >= 3 && bytes[0] === 0x70 && bytes[1] === 0x6c && bytes[2] === 0x79; // "ply"
		const name = (filename || '').toLowerCase();

		if (isPly || name.endsWith('.ply')) {
			const hdr = parsePlyHeader(bytes);
			if (hdr.format.indexOf('binary_little_endian') >= 0) return parsePlyBinary(arrayBuffer, hdr);
			if (hdr.format.indexOf('ascii') >= 0) return parsePlyAscii(arrayBuffer, hdr);
			if (hdr.format.indexOf('binary_big_endian') >= 0) throw new Error('binary_big_endian PLY 는 미지원');
			throw new Error('알 수 없는 PLY format: ' + hdr.format);
		}
		if (name.endsWith('.splat') || bytes.length % 32 === 0) {
			return parseSplat(arrayBuffer);
		}
		throw new Error('인식할 수 없는 포맷 (지원: .ply binary/ascii, .splat)');
	}

	global.HktSplatPly = { parse };
})(window);
