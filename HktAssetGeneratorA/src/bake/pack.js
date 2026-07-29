// 최종 채널 패킹 (원본 §2.2, 05-phase3 §3.5).
// BaseColor: sRGB 8bit (primitive 색이 sRGB 저작 — 이중 변환 없음)
// Normal / ORM: linear 8bit. ORM: R=AO, G=Roughness, B=Metallic.
// 양자화는 여기서 한 번만 — 해시 대상은 이 Uint8 버퍼다 (02-architecture §5).

const to8 = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255);

export function packBaseColor(color, size) {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = to8(color[i * 4]);
    out[i * 4 + 1] = to8(color[i * 4 + 1]);
    out[i * 4 + 2] = to8(color[i * 4 + 2]);
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function packNormal(normal, size) {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    // 미채움 영역은 평평한 노멀 (0,0,1)
    const nz = normal[i * 4 + 2];
    if (nz === 0) {
      out[i * 4] = 128; out[i * 4 + 1] = 128; out[i * 4 + 2] = 255; out[i * 4 + 3] = 255;
      continue;
    }
    out[i * 4] = to8(normal[i * 4] * 0.5 + 0.5);
    out[i * 4 + 1] = to8(normal[i * 4 + 1] * 0.5 + 0.5);
    out[i * 4 + 2] = to8(nz * 0.5 + 0.5);
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function packORM(ao, rough, metal, size) {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = to8(ao[i]);
    out[i * 4 + 1] = to8(rough[i]);
    out[i * 4 + 2] = to8(metal[i]);
    out[i * 4 + 3] = 255;
  }
  return out;
}
