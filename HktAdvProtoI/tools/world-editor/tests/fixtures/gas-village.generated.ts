// **생성물이다 — 손으로 고치지 않는다.** world:author 가 GAS_VILLAGE.json 에서 낸 방 하나를
// 그대로 굳힌 것이고, 있는 이유는 하나다: **이 저장소가 그것을 컴파일해 보기 위해서**다.
//
// T3 은 값을 글자로 굳혀 content/regions/ 에 넣는다. 값이 맞아도 형이 다르면 그 파일은 서지 못하는데,
// 시험이 글자와 값만 보면 그것을 잡지 못한다 (실제로 traceOp/traceOps 하나가 그렇게 새어 나갔다).
// 여기 굳혀 두면 tsc 가 이 리터럴을 매번 재고, 생성기가 형에서 벗어나는 순간 빌드가 깨진다.
//
// 세계의 방이 아니다 — content/regions/index.ts 가 이 파일을 부르지 않는다.
// 갱신: npm run world:author -- content/authoring/examples/GAS_VILLAGE.json 의 결과와 같아야 한다
//       (tools/world-editor/tests/author.spec.ts 가 글자까지 대조한다)
// 가스로 가득 찬 마을 — depth outer. **world:author 가 낸 뼈대다** (T3).
//
// 손으로 쓴 방들이 지닌 실측 근거(왜 이 반경인가 · 왜 이 깊이인가)가 이 파일에는 없다.
// 생성기가 댄 것은 서기는 하는 방 하나다 — 검사 아홉을 통과하고, 놓인 원천에 걸어 닿는다.
// 값을 손으로 고치는 순간 이 파일은 생성물이 아니라 손으로 쓴 방이 된다 (그래도 좋다).
//
// 이 방의 brief 는 아직 1 가지를 답하지 못했다: birth.
//
// seed 606039532 는 brief 를 해시한 값이다 — 같은 brief 는 언제나 같은 방을 낸다.

import type { RegionSpec } from '../../../../content/regions/spec';
import { ANCHOR_LAYER } from '../../../../content/regions/spec';
import { RESOURCE_LAYER, TRACE_LAYER } from '../../../../content/regions/resource-ecology';

export const GAS_VILLAGE = 'GAS_VILLAGE';

export const GAS_VILLAGE_SPEC: RegionSpec = {
  id: GAS_VILLAGE,
  depth: 'outer',
  space: {
    id: GAS_VILLAGE,
    extent: {
      minX: -20,
      maxX: 20,
      minZ: -20,
      maxZ: 20,
    },
    seed: 606039532,
    ops: [
      {
        id: 'anchor-gas-village-white-king-domain',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'GAS_VILLAGE_WHITE_KING_DOMAIN',
        position: {
          x: 0,
          z: -18,
        },
      },
      {
        id: 'ridge-north',
        kind: 'stamp',
        stamp: 'ridge',
        center: {
          x: 0,
          z: 16,
        },
        radius: 12,
        height: 10,
        falloff: 2,
      },
      {
        id: 'trace-gas-village-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: 'soil-stain:1',
        shape: {
          kind: 'polygon',
          points: [
            {
              x: -20,
              z: -20,
            },
            {
              x: 20,
              z: -20,
            },
            {
              x: 20,
              z: 20,
            },
            {
              x: -20,
              z: 20,
            },
          ],
        },
      },
      {
        id: 'trace-gas-residue',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: 'soil-stain:2',
        shape: {
          kind: 'circle',
          center: {
            x: -9,
            z: 0,
          },
          radius: 7,
        },
      },
      {
        id: 'source-gas-residue',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'GAS_RESIDUE',
        position: {
          x: -9,
          z: 0,
        },
      },
    ],
  },
  resourceEcology: {
    sources: [
      {
        id: 'GAS_RESIDUE',
        materialId: 'GAS_RESIDUE',
        worldCause: 'GAS_POOLING',
        form: 'settled-film',
        carrier: 'residue',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: 'gas-settling',
        harvests: 3,
        recoverySeconds: 60,
        traceOps: [
          'trace-gas-residue',
        ],
      },
    ],
  },
};
