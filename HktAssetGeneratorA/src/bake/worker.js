// 베이크 Web Worker (05-phase3 §3.6) — 검을 재생성해 베이크하고 결과 버퍼를 transfer.
// 결정 코드만 import — DOM/three 없음.

import { buildSword } from "../mesh/sword.js";
import { bakeSword } from "./bake.js";

self.onmessage = (event) => {
  const { design, materialGraph, seed, size, operations } = event.data;
  try {
    const t0 = performance.now();
    const sword = buildSword(design, size);
    const result = bakeSword({ merged: sword.merged, design, materialGraph, seed, size, operations });
    const elapsed = performance.now() - t0;
    self.postMessage(
      {
        ok: true,
        baseColor: result.baseColor.buffer,
        normal: result.normal.buffer,
        orm: result.orm.buffer,
        size,
        hash: result.hash,
        elapsed,
      },
      [result.baseColor.buffer, result.normal.buffer, result.orm.buffer],
    );
  } catch (err) {
    self.postMessage({ ok: false, message: err.message });
  }
};
