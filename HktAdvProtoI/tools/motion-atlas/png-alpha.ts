// PNG Alpha Reader — 의존성 없는 최소 PNG 디코더.
//
// 프레임 사각형 검출에 필요한 것은 "어느 픽셀에 그림이 있는가" 뿐이므로
// 색은 버리고 **알파 채널만** 뽑는다. 그래서 색 공간·감마·인터레이스 해제 같은
// 일반 디코더의 부담을 지지 않는다.
//
// 지원: bitDepth 8·16, colorType 0/2/3/4/6, 비인터레이스.
//       (인터레이스 PNG 는 흔히 쓰이지 않으므로 명시적으로 거부한다 — 조용히 틀리는 것보다 낫다)

import { inflateSync } from 'node:zlib';

export interface AlphaImage {
  width: number;
  height: number;
  /** width*height 크기. 0 = 완전 투명, 255 = 완전 불투명 */
  alpha: Uint8Array;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function readPngAlpha(bytes: Buffer): AlphaImage {
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('PNG 시그니처가 아니다');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  let transparency: Buffer | null = null;

  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString('ascii', pos + 4, pos + 8);
    const body = bytes.subarray(pos + 8, pos + 8 + length);

    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8]!;
      colorType = body[9]!;
      if (body[12] !== 0) throw new Error('인터레이스 PNG 는 지원하지 않는다');
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    } else if (type === 'tRNS') {
      transparency = Buffer.from(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }

  const channels = CHANNELS[colorType];
  if (!channels) throw new Error(`지원하지 않는 colorType ${colorType}`);
  if (bitDepth !== 8 && bitDepth !== 16) {
    // 1·2·4비트는 팔레트/그레이 저해상도 — 모션 시트로 쓰일 일이 없다.
    throw new Error(`지원하지 않는 bitDepth ${bitDepth}`);
  }

  const bytesPerSample = bitDepth / 8;
  const bytesPerPixel = channels * bytesPerSample;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idat));

  const line = new Uint8Array(stride);
  let prev = new Uint8Array(stride);
  const alpha = new Uint8Array(width * height);

  // 알파를 어디서 읽을지 — 채널이 있으면 그 위치, 없으면 tRNS 나 불투명 고정
  const alphaOffset = colorType === 4 ? bytesPerSample : colorType === 6 ? 3 * bytesPerSample : -1;

  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++]!;
    line.set(raw.subarray(read, read + stride));
    read += stride;
    unfilter(line, prev, filter, bytesPerPixel, stride);

    const rowStart = y * width;
    if (alphaOffset >= 0) {
      for (let x = 0; x < width; x++) alpha[rowStart + x] = line[x * bytesPerPixel + alphaOffset]!;
    } else if (colorType === 3 && transparency) {
      // 팔레트 — tRNS 가 인덱스별 알파를 준다. 표에 없는 인덱스는 불투명이다.
      for (let x = 0; x < width; x++) {
        const index = line[x * bytesPerPixel]!;
        alpha[rowStart + x] = index < transparency.length ? transparency[index]! : 255;
      }
    } else {
      alpha.fill(255, rowStart, rowStart + width);
    }

    prev = Uint8Array.prototype.slice.call(line);
  }

  return { width, height, alpha };
}

// PNG 스캔라인 필터 해제 (RFC 2083 §6)
function unfilter(
  line: Uint8Array,
  prev: Uint8Array,
  filter: number,
  bpp: number,
  stride: number,
): void {
  switch (filter) {
    case 0:
      return;
    case 1:
      for (let i = bpp; i < stride; i++) line[i] = (line[i]! + line[i - bpp]!) & 255;
      return;
    case 2:
      for (let i = 0; i < stride; i++) line[i] = (line[i]! + prev[i]!) & 255;
      return;
    case 3:
      for (let i = 0; i < stride; i++) {
        const left = i >= bpp ? line[i - bpp]! : 0;
        line[i] = (line[i]! + ((left + prev[i]!) >> 1)) & 255;
      }
      return;
    case 4:
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? line[i - bpp]! : 0;
        const b = prev[i]!;
        const c = i >= bpp ? prev[i - bpp]! : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pick = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        line[i] = (line[i]! + pick) & 255;
      }
      return;
    default:
      throw new Error(`알 수 없는 스캔라인 필터 ${filter}`);
  }
}
