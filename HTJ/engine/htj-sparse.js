// htj-sparse.js — HTJ 확장성 레버 1(희소화)의 *컨테이너*: 빈 공간은 0원.
//
//   문제(step_0015 = S1 베이스라인): 조밀 격자 `Float64Array(N³)` 는 비용이 *부피*에 묶인다 —
//   1셀만 찬 세계도 가득 찬 세계와 *같은* 메모리를 쓴다(점유 무관). N=256 이면 장 하나만 134MB.
//
//   처방(design/scalability.md §2 레버 1): 격자를 작은 **블록**(기본 8³)으로 타일링하고,
//   *물질이 있는 블록만* 할당·저장한다. 빈 블록은 미할당 → 읽으면 0. 비용이 *부피*가 아니라
//   **점유한 블록 수**에 비례한다. 이게 step_0015 "점유 무관성"을 깨는 바로 그 구조다.
//
//   이 step(S2 첫 단위)은 *컨테이너 자료구조 자체*만 세운다 — 기존 법칙(htj-*.js)은 건드리지 않는다
//   (회귀 0). 다음 step 이 법칙을 "활성 블록만 순회"로 일반화해 이 컨테이너 위에서 돌린다.
//
//   관문(verify):
//     · 왕복 비트 동일 — dense → SparseField → toDense() 가 *byte 동일*(빈 칸=0 동치).
//     · 점유 비례 메모리 — memBytes ∝ 점유 블록 수 ≪ 조밀 N³·8 (S1 점유 무관성을 뒤집음).
//     · 측정 일치 — total/count/max/min 이 조밀과 정확히 같다.
//     · 지문 재정의 — *활성(비-영) 칸 정규 직렬화* 지문 → 삽입 순서 무관·결정론·조밀과 교차 일치.
//
//   세계(법칙) 그 자체가 아니라 그 *그릇* — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   브라우저(viewer.html)·Node(verify.js) 양쪽에서 동일하게 동작(UMD).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJSparse = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_BLOCK = 8;   // 8³ 블록 = 512칸. OpenVDB·UE5 Sparse Volume 의 작은 버전.

  // 한 셀의 8바이트(Float64)가 *전부 0 비트*인가? — "빈 칸 = bit 0" 정의의 엄밀한 판정.
  //   (수치 0 비교(`v===0`)는 -0 을 0 으로 보아 byte 차이를 놓친다. 왕복 비트 동일을 위해 byte 로 본다.)
  function cellAllZeroBytes(bytes, off) {
    for (let k = 0; k < 8; k++) if (bytes[off + k] !== 0) return false;
    return true;
  }

  // 한 비-영 칸의 지문 기여 — FNV-1a(전역 인덱스 gi 4바이트 ‖ 값 8바이트). 칸마다 유일(gi 포함).
  //   지문은 이 칸별 해시들의 *XOR 누적*(순서 무관)으로 만든다.
  function cellHash(gi, bytes, off) {
    let h = 0x811c9dc5;
    h ^= (gi & 0xff); h = Math.imul(h, 0x01000193);
    h ^= ((gi >>> 8) & 0xff); h = Math.imul(h, 0x01000193);
    h ^= ((gi >>> 16) & 0xff); h = Math.imul(h, 0x01000193);
    h ^= ((gi >>> 24) & 0xff); h = Math.imul(h, 0x01000193);
    for (let k = 0; k < 8; k++) { h ^= bytes[off + k]; h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  // 희소 블록 장(field) — N³ 격자를 bs³ 블록으로 타일링, 비-영 블록만 할당.
  function createSparseField(N, blockSize) {
    N = N | 0;
    if (N <= 0) throw new Error('createSparseField: N must be > 0');
    const bs = (blockSize | 0) || DEFAULT_BLOCK;
    const bcells = bs * bs * bs;                 // 블록당 칸 수
    const nbx = Math.ceil(N / bs);               // 축당 블록 수
    const nBlocksTotal = nbx * nbx * nbx;
    const blocks = new Map();                    // 블록키 → Float64Array(bcells) (할당된 것만)

    function blockKey(bx, by, bz) { return (bz * nbx + by) * nbx + bx; }
    function localIndex(x, y, z) { return (((z % bs) * bs) + (y % bs)) * bs + (x % bs); }

    const self = {
      N, blockSize: bs, blocksPerAxis: nbx, blocksTotal: nBlocksTotal, cellsPerBlock: bcells,

      // ── 셀 접근 ── 미할당 블록은 0. set(…,0) 은 *블록을 새로 만들지 않는다*(빈 공간 0원 불변).
      get(x, y, z) {
        const b = blocks.get(blockKey(x / bs | 0, y / bs | 0, z / bs | 0));
        return b ? b[localIndex(x, y, z)] : 0;
      },
      set(x, y, z, v) {
        const key = blockKey(x / bs | 0, y / bs | 0, z / bs | 0);
        let b = blocks.get(key);
        if (!b) {
          if (v === 0) return;                   // 빈 블록에 0 쓰기 = 무할당(점유 비례 불변)
          b = new Float64Array(bcells);
          blocks.set(key, b);
        }
        b[localIndex(x, y, z)] = v;
      },

      // ── 희소 ↔ 조밀 ──
      // 조밀 Float64Array(N³) → 희소. *비-영 byte 가 하나라도 있는 블록만* 할당(빈 블록 미할당).
      //   byte 단위 판정이라 왕복이 *bit 완벽*(빈 칸=0, -0 같은 비트도 보존).
      toDense() {
        const out = new Float64Array(N * N * N);
        for (const [key, b] of blocks) {
          const bx = key % nbx, by = ((key - bx) / nbx) % nbx, bz = (key - bx - by * nbx) / (nbx * nbx);
          const ox = bx * bs, oy = by * bs, oz = bz * bs;
          for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
            for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
              for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break;
                out[(z * N + y) * N + x] = b[((lz * bs) + ly) * bs + lx];
              }
            }
          }
        }
        return out;
      },

      // ── 측정자(조밀과 정확히 같은 값) — 미할당 블록은 0 이므로 건너뛴다 ──
      total() { let s = 0; for (const b of blocks.values()) for (let i = 0; i < bcells; i++) s += b[i]; return s; },
      count(eps) { eps = eps || 0; let c = 0; for (const b of blocks.values()) for (let i = 0; i < bcells; i++) if (b[i] > eps) c++; return c; },
      max() { let m = -Infinity; let any = false; for (const b of blocks.values()) for (let i = 0; i < bcells; i++) { if (b[i] > m) m = b[i]; any = true; } return any ? m : 0; },
      min() { let m = Infinity; let any = false; for (const b of blocks.values()) for (let i = 0; i < bcells; i++) { if (b[i] < m) m = b[i]; any = true; } return any ? m : 0; },

      // ── 점유/메모리 ── memBytes = 할당된 블록의 byteLength 합(조밀 byteLength 와 직접 비교용).
      activeBlocks() {
        let c = 0;
        for (const b of blocks.values()) { const by = new Uint8Array(b.buffer); for (let i = 0; i < by.length; i++) if (by[i] !== 0) { c++; break; } }
        return c;
      },
      allocatedBlocks() { return blocks.size; },
      memBytes() { let m = 0; for (const b of blocks.values()) m += b.byteLength; return m; },

      // 전부-0 블록을 해제(set 후 0 으로 돌아온 블록 회수) → 점유 비례 불변 복원.
      compact() {
        for (const [key, b] of blocks) {
          const by = new Uint8Array(b.buffer);
          let allZero = true;
          for (let i = 0; i < by.length; i++) if (by[i] !== 0) { allZero = false; break; }
          if (allZero) blocks.delete(key);
        }
        return self;
      },

      // ── 결정론 지문(재정의) ── *비-영 칸*들의 (전역 인덱스 + 8바이트) 해시를 **순서 무관 결합**.
      //   조밀-바이트 지문(htj-world.fingerprint)은 희소와 양립 못 한다(빈 칸 표현·순회 순서가 다름).
      //   대신: 각 비-영 칸마다 hc = FNV-1a(전역 인덱스 gi ‖ 8바이트) 를 따로 구해 **XOR 누적**한다 →
      //     · XOR 은 교환적 → 블록/셀/삽입 순회 순서와 무관(희소 블록순 = 조밀 gi순 결과 동일)
      //     · gi 가 칸마다 유일 → 서로 다른 비-영 칸의 hc 는 충돌 안 함(XOR 상쇄 없음)
      //     · 전부-0 블록은 건너뜀 → 미할당 블록과 *동치*(빈 칸=0)
      //     · 같은 비-영 내용이면 조밀 참조(referenceFingerprint)와 정확히 일치
      fingerprint() {
        let acc = 0;
        for (const [key, b] of blocks) {
          const by = new Uint8Array(b.buffer);
          const bx = key % nbx, byb = ((key - bx) / nbx) % nbx, bz = (key - bx - byb * nbx) / (nbx * nbx);
          const ox = bx * bs, oy = byb * bs, oz = bz * bs;
          for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
            for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
              for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break;
                const loff = (((lz * bs) + ly) * bs + lx) * 8;
                if (cellAllZeroBytes(by, loff)) continue;     // 비-영 칸만(빈 칸=0 동치)
                acc = (acc ^ cellHash((z * N + y) * N + x, by, loff)) >>> 0;   // 순서 무관 결합
              }
            }
          }
        }
        return acc >>> 0;
      }
    };

    self._fromDense = function (dense) {
      const bytes = new Uint8Array(dense.buffer, dense.byteOffset, dense.byteLength);
      for (let bz = 0; bz < nbx; bz++)
        for (let by = 0; by < nbx; by++)
          for (let bx = 0; bx < nbx; bx++) {
            const ox = bx * bs, oy = by * bs, oz = bz * bs;
            // 이 블록에 비-영 byte 칸이 하나라도 있나? — 있으면 할당, 없으면 건너뜀(빈 블록 미할당).
            let nonempty = false;
            for (let lz = 0; lz < bs && !nonempty; lz++) { const z = oz + lz; if (z >= N) break;
              for (let ly = 0; ly < bs && !nonempty; ly++) { const y = oy + ly; if (y >= N) break;
                for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break;
                  if (!cellAllZeroBytes(bytes, ((z * N + y) * N + x) * 8)) { nonempty = true; break; }
                }
              }
            }
            if (!nonempty) continue;
            const blk = new Float64Array(bcells);
            for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
              for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
                for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break;
                  blk[((lz * bs) + ly) * bs + lx] = dense[(z * N + y) * N + x];
                }
              }
            }
            blocks.set(blockKey(bx, by, bz), blk);
          }
      return self;
    };

    return self;
  }

  // 조밀 Float64Array(N³) → 희소 장. (편의 진입점.)
  function fromDense(N, dense, blockSize) {
    return createSparseField(N, blockSize)._fromDense(dense);
  }

  // 참조 지문 — *조밀 배열*에서 SparseField.fingerprint() 와 *같은 규칙*(비-영 칸 정규 직렬화)으로 계산.
  //   희소 지문이 조밀 내용의 충실한 재정의임을 교차 검증하는 데 쓴다(verify).
  function referenceFingerprint(N, dense) {
    const bytes = new Uint8Array(dense.buffer, dense.byteOffset, dense.byteLength);
    const SIZE = N * N * N;
    let acc = 0;
    for (let gi = 0; gi < SIZE; gi++) {
      const off = gi * 8;
      if (cellAllZeroBytes(bytes, off)) continue;
      acc = (acc ^ cellHash(gi, bytes, off)) >>> 0;
    }
    return acc >>> 0;
  }

  // 조밀 장(Float64Array(N³))에서 *비-영 셀이 하나라도 있는 블록*의 원점 목록을 뽑는다.
  //   반환: [[ox,oy,oz], …] (블록키 오름차순 = 결정론). 법칙이 이 목록만 순회하면 빈 블록을
  //   *실제로 건너뛴다* → 비용이 부피(N³)가 아니라 활성 블록에 비례(step_0018 의 첫 실현 절감).
  //   per-cell 법칙(이웃 stencil 없음)은 이 목록으로 조밀과 *비트 동일*하다(빈 블록=전부 0=무변화).
  function activeBlockOrigins(field, N, blockSize) {
    const bs = (blockSize | 0) || DEFAULT_BLOCK;
    const nbx = Math.ceil(N / bs);
    const out = [];
    for (let bz = 0; bz < nbx; bz++)
      for (let by = 0; by < nbx; by++)
        for (let bx = 0; bx < nbx; bx++) {
          const ox = bx * bs, oy = by * bs, oz = bz * bs;
          let nonempty = false;
          for (let lz = 0; lz < bs && !nonempty; lz++) { const z = oz + lz; if (z >= N) break;
            for (let ly = 0; ly < bs && !nonempty; ly++) { const y = oy + ly; if (y >= N) break;
              for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break;
                if (field[(z * N + y) * N + x] !== 0) { nonempty = true; break; }
              }
            }
          }
          if (nonempty) out.push([ox, oy, oz]);
        }
    return out;
  }

  // 활성 블록 집합 — *재스캔 없이 유지*하는 증분 구조(step_0019, S2 레버1 의 "실현 절감"을 진짜로 실현).
  //
  //   문제(step_0018 의 정직한 한계): activeBlockOrigins 는 매 step *전-격자 O(N³)* 를 재스캔해
  //   활성 블록을 찾는다 → 법칙이 빈 블록을 건너뛰어 아낀 만큼을 그 재스캔이 도로 상쇄한다
  //   (step_0018 verify 실측: 재스캔 0.554 ≥ 조밀 0.303). 절감은 활성 집합이 *유지*돼야 실현된다.
  //
  //   처방: 활성 블록 키 집합을 **한 번 빌드**(seed 시 O(N³))한 뒤 step 간 *재사용*하고, 비워진
  //   블록은 *활성 블록만 훑어* 그 자리에서 제거(prune, O(활성)) — 전-격자 재스캔이 없다.
  //   냉각처럼 *단조 비-성장* 법칙(u·factor 는 0 셀을 비-영으로 못 만든다)은 한 번 빌드한 집합이
  //   모든 후속 step 의 유효한 cover 라서 재사용이 안전하다(verify §3 가 이 불변식을 박는다).
  //
  //   결정론: origins() 는 블록키 오름차순 → activeBlockOrigins 와 *동일 순서*(교차 검증). 순서 무관.
  //   이건 *컨테이너/스케줄러 층*(design §5 "가법성")일 뿐 — 법칙 코드를 대체하지 않고, 법칙은 여전히
  //   opts.active=origins() 를 받아 돈다. 렌더·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
  function createActiveSet(N, blockSize) {
    N = N | 0;
    if (N <= 0) throw new Error('createActiveSet: N must be > 0');
    const bs = (blockSize | 0) || DEFAULT_BLOCK;
    const nbx = Math.ceil(N / bs);
    const keys = new Set();          // 활성(비-영) 블록 키
    let lastScanned = 0;             // 마지막 빌드/정리가 *실제로 훑은* 셀 수(재스캔 비용의 실측 증거)

    function keyToOrigin(key) {
      const bx = key % nbx, by = ((key - bx) / nbx) % nbx, bz = (key - bx - by * nbx) / (nbx * nbx);
      return [bx * bs, by * bs, bz * bs];
    }
    // 한 블록(원점 ox,oy,oz)에 비-영 셀이 하나라도 있나? — 있으면 즉시 return(early-out). scanned 누적.
    function blockNonEmpty(field, ox, oy, oz, counter) {
      for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
        for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
          for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break;
            counter.n++;
            if (field[(z * N + y) * N + x] !== 0) return true;
          }
        }
      }
      return false;
    }

    const self = {
      N, blockSize: bs, blocksPerAxis: nbx,
      size() { return keys.size; },
      has(bx, by, bz) { return keys.has((bz * nbx + by) * nbx + bx); },
      lastScannedCells() { return lastScanned; },

      // 한 번 빌드 — 조밀 field 에서 비-영 블록 키를 모은다(O(N³), seed 시 1회). 훑은 셀 수 기록.
      rebuildFromField(field) {
        keys.clear();
        const counter = { n: 0 };
        for (let bz = 0; bz < nbx; bz++)
          for (let by = 0; by < nbx; by++)
            for (let bx = 0; bx < nbx; bx++) {
              if (blockNonEmpty(field, bx * bs, by * bs, bz * bs, counter)) keys.add((bz * nbx + by) * nbx + bx);
            }
        lastScanned = counter.n;
        return self;
      },

      // 결정론 순서(블록키 오름차순)의 활성 블록 원점 목록 — opts.active 로 법칙에 넘긴다.
      //   activeBlockOrigins 와 *같은 순서*(둘 다 키 오름차순) → 비트 동일 보장.
      origins() {
        const sorted = [...keys].sort((a, b) => a - b);
        const out = new Array(sorted.length);
        for (let i = 0; i < sorted.length; i++) out[i] = keyToOrigin(sorted[i]);
        return out;
      },

      // 비워진 블록 제거(재스캔 *없이*) — *활성 블록만* 훑어 전부 0 이면 키 제거. 반환=제거 수.
      //   훑는 범위가 활성 블록 칸뿐 → O(활성), 전-격자 O(N³) 아님(이게 step_0018 한계를 닫는 핵심).
      prune(field) {
        const counter = { n: 0 };
        let removed = 0;
        for (const key of [...keys]) {
          const o = keyToOrigin(key);
          if (!blockNonEmpty(field, o[0], o[1], o[2], counter)) { keys.delete(key); removed++; }
        }
        lastScanned = counter.n;
        return removed;
      },

      // ── *번지는* stencil 법칙(확산 등)용 halo + 증분 활성화(step_0020) ──
      //
      //   냉각(step_0019)은 단조 비-성장이라 활성 집합이 *줄기만* 했다 — 한 번 빌드 후 고정이 안전했다.
      //   그러나 확산·advect 처럼 *번지는* 법칙은 비-영 셀을 한 칸씩 넓힌다(0 셀이 비-영 이웃의 flux 를
      //   받아 비-영이 됨). 활성 블록만 돌면 그 경계 번짐을 *놓쳐* 조밀과 달라진다. → 두 가지가 필요:
      //     · halo — 활성 블록 + 그 6-면 이웃 블록까지 함께 순회(번짐이 닿을 수 있는 칸을 모두 덮음).
      //       증명: 비-영 셀은 활성 블록에만 산다 → 비-영 셀의 면-이웃은 활성 블록이거나 그 면-이웃 블록
      //       (=halo). active∪halo 밖 셀은 자신·모든 이웃이 0 → 확산 결과 불변 → 건너뛰어도 비트 동일.
      //     · 증분 활성화 — 번져서 비-영이 된 halo 블록을 집합에 *추가*(이웃 깨움). 전선이 자라남.
      //   둘 다 O(활성)·전-격자 재스캔 없음(halo 는 활성 블록의 이웃만, 활성화는 후보 목록만 훑음).

      // 활성 블록 ∪ 그 6-면 이웃 블록의 원점 목록(중복 제거·결정론 키 오름차순). 격자 밖 블록은 제외.
      //   *번지는* 법칙은 이 목록을 opts.active 로 받아 돈다(halo 까지 처리 → 경계 번짐 포착).
      originsWithHalo() {
        const set = new Set();
        const off = [[0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
        for (const key of keys) {
          const bx = key % nbx, by = ((key - bx) / nbx) % nbx, bz = (key - bx - by * nbx) / (nbx * nbx);
          for (let d = 0; d < off.length; d++) {
            const nx = bx + off[d][0], ny = by + off[d][1], nz = bz + off[d][2];
            if (nx < 0 || ny < 0 || nz < 0 || nx >= nbx || ny >= nbx || nz >= nbx) continue;
            set.add((nz * nbx + ny) * nbx + nx);
          }
        }
        const sorted = [...set].sort((a, b) => a - b);
        const out = new Array(sorted.length);
        for (let i = 0; i < sorted.length; i++) out[i] = keyToOrigin(sorted[i]);
        return out;
      },

      // 증분 활성화 — 후보 원점 목록(보통 originsWithHalo 결과) 중 *비-영이 된* 블록을 집합에 추가.
      //   반환=새로 추가된 블록 수. 후보만 훑으므로 O(활성)(전-격자 재스캔 아님). 번짐 전선을 따라간다.
      activateFrom(field, origins) {
        const counter = { n: 0 };
        let added = 0;
        for (let i = 0; i < origins.length; i++) {
          const ox = origins[i][0], oy = origins[i][1], oz = origins[i][2];
          const key = ((oz / bs | 0) * nbx + (oy / bs | 0)) * nbx + (ox / bs | 0);
          if (keys.has(key)) continue;                       // 이미 활성 → 건너뜀
          if (blockNonEmpty(field, ox, oy, oz, counter)) { keys.add(key); added++; }
        }
        lastScanned = counter.n;
        return added;
      }
    };
    return self;
  }

  return { createSparseField, fromDense, referenceFingerprint, activeBlockOrigins, createActiveSet, DEFAULT_BLOCK, VERSION: 2 };
});
