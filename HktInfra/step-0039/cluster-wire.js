// HktInfra step-0039 — cluster 분할 ①: 길이-프리픽스 프레이밍(wire 경계 복원). cluster.js(broker)에서 추출(0030 박스 분할의 cluster 판).
//   기능 0 — frameOf/Framer 를 cluster-core(Cluster)·cluster.js 진입점이 공유. 바이트 동일(verbatim 이동) → reg 0.
'use strict';

// ── 길이-프리픽스 프레이밍 — TCP 바이트 스트림에서 메시지 경계 복원([4바이트 BE 길이][UTF-8 JSON]). 0012 그대로. ──
function frameOf(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const hdr = Buffer.allocUnsafe(4);
  hdr.writeUInt32BE(json.length, 0);
  return { buf: Buffer.concat([hdr, json]), bytes: 4 + json.length };
}
class Framer {
  constructor(onMsg) { this.buf = Buffer.alloc(0); this.onMsg = onMsg; }
  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32BE(0);
      if (this.buf.length < 4 + len) break;       // 프레임 미완 — 다음 청크 대기
      const json = this.buf.toString('utf8', 4, 4 + len);
      this.buf = this.buf.subarray(4 + len);
      this.onMsg(JSON.parse(json));
    }
  }
}

module.exports = { frameOf, Framer };
