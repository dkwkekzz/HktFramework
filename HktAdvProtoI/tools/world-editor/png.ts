// 최소 PNG 쓰기 — 의존성을 더하지 않는다 (C007 ADDED · spec SPEC-001 · brief §2.4).
//
// node:zlib 의 deflateSync 하나로 8bit RGB(colorType 2) PNG 를 직접 쓴다. 이 도구가 내는 그림은
// 격자 vertex 하나 = 픽셀 하나이므로 크기가 수십×수십이고, 인코더에 요구되는 것은 그것뿐이다 —
// 인터레이스도 팔레트도 알파도 이번 사용처가 쓰지 않으므로 넣지 않는다 (선행 추상화 금지).
//
// **같은 입력은 같은 바이트여야 한다** (SPEC-006). 그래서
//   ① zlib 수준을 9 로 **고정**한다 — 기본값에 맡기면 런타임 설정에 따라 바이트가 흔들릴 수 있다
//   ② 시각(tIME)도 난수도 주석(tEXt)도 섞지 않는다 — 청크는 IHDR · IDAT · IEND 셋뿐이다
//   ③ 필터는 모든 줄에서 0(None) 으로 고정한다 — 줄마다 필터를 고르면 고르는 규칙이 곧
//      결정론의 짐이 된다. 이 크기의 그림에서 압축률은 문제가 아니다

import { deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC32 표 — PNG 명세(Annex D)의 그것. 한 번만 만든다.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 청크 하나 — 길이(4) · 종류(4) · 몸 · CRC(종류+몸) */
function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([head, typed, crc]);
}

/**
 * 8bit RGB PNG 한 장.
 *
 * `rgb` 는 위에서 아래로 읽는 줄 순서이고 한 픽셀당 세 바이트(R · G · B)다 —
 * 길이가 width * height * 3 이 아니면 그림이 아니므로 그 자리에서 멈춘다.
 */
export function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`PNG 크기가 그림이 아니다: ${width}×${height}`);
  }
  if (rgb.length !== width * height * 3) {
    throw new Error(`PNG 화소 수가 크기와 다르다: ${rgb.length} ≠ ${width * height * 3}`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type 2 = truecolor RGB
  ihdr.writeUInt8(0, 10); // compression = deflate
  ihdr.writeUInt8(0, 11); // filter = 표준 다섯
  ihdr.writeUInt8(0, 12); // interlace 없음

  // 줄마다 앞에 필터 바이트 0 을 붙인다
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = rgb[y * stride + i]!;
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
