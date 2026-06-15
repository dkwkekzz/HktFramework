// HktInfra step-0037 — cluster 진입점(broker 멀티프로세스 드라이버). 정리 step: 45KB>30KB 박스 트리거로 cluster.js 를 박스-부품 4개로 분할.
//   기능 0·바이트 동일(verbatim 이동)·export 집합 불변 → reg 0(0034 와 비트 동일). net-core.js 가 부품을 묶듯, 이 진입점이 cluster 부품을 묶는다.
//     · cluster-wire.js        — 길이-프리픽스 프레이밍(frameOf · Framer)
//     · cluster-core.js        — Cluster 클래스(broker 버스 허브·토픽 pub/sub·진짜 kill 생애주기·재-provisioning)
//     · cluster-reconstruct.js — reconstruct(스냅샷 → run() 형태 r 재구성·dead 표기)
//     · cluster-run.js         — computePlacement · runMulti(멀티프로세스 lockstep 드라이버)
//   topology.js 는 여전히 require('./cluster.js').runMulti 로 진입 — 검증 경로 무변경(Node 전용·dual-mode 불요).
'use strict';
const { frameOf, Framer } = require('./cluster-wire.js');
const { Cluster } = require('./cluster-core.js');
const { reconstruct } = require('./cluster-reconstruct.js');
const { runMulti, computePlacement } = require('./cluster-run.js');

module.exports = { runMulti, Cluster, computePlacement, frameOf, Framer };
