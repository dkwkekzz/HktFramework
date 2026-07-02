# 외부 감사 — 서버 구현 목적 정합 검토 (2026-07-02 · 기준 step-0480)

> `reviews/progress/*.md` 6계층 진행 지도의 주장("무슨 서버가 무엇을 하나")을 **재현 실행 + 실물 코드 대조**로 검증하고, *실제 게임 투입* 관점의 구조적 격차를 우선순위로 정리한 감사. 권고의 집행 권위는 [../STATE.md](../STATE.md) §2(🔎 블록)·격차 등재는 §3(#16 확장·#75 신규).

## 1. 재현 검증 — 전부 통과 (이 감사가 사실에 근거함의 증거)

| 실행 | 내용 | 결과 |
|---|---|---|
| `node run.js` | 현재 step 검증 전체(영구 28모드) | ALL OK (exit 0) |
| `node run.js spine` | src 누적 회귀(전 역사 불변) | ALL OK (exit 0) |
| `upce2ecap` (HEAD·0480) | 실 UpClient→소켓→실 host.js 자식 존→뷰 되먹임 | 5/5 · 수렴·회계·exactly-once(rs6~18·dup0~10 멱등)·leave — progress/README 수치와 일치 |
| `worldcap` (0350 커밋 worktree) | 월드 다운스트림 E2E(dc0~dc2 수렴·iso) | 5/5 ALL OK |
| `clusterdatacap` (0370 커밋) | 실 child_process 데이터 평면·migrate 상태 보존 | 5/5 ALL OK |
| `coordmergecap` (0420 커밋) | 코디네이터 warm-failover(mig+reprov+kill+promote) | 5/5 ALL OK |
| `mze2ecap` (0470 커밋) | 다중 존 이주 하 async 유계 resync(world==lockstep) | 5/5 ALL OK |

정적 주장 확인: `src/` 실 `Math.random` 0건 · 실 `child_process.spawn`(`cluster-core.js:44`·`host.js` 독립 프로세스·replyCache 멱등 `host.js:67`) · 박스 ≤30KB · orch→zone.js 직접 import 0건 · `coordDesync` 는 실 자식 프로세스 snapshot RPC 대조(`cluster-coord.js:71-75` — by-construction 아님) · async-barrier interior 가드 실물(`async-barrier.js:61-67`) · 존 핸드오프 release+acquire 쌍+handoffId 멱등 ack(`zone.js:72-90`) · 게이트웨이 leave 시 다운스트림 바인딩 정리(`gateway.js:90-91`) · saga/escrow/single-master 불변식 전부 실물 accessor(`svc-exchange-core.js` sagaConsistent/sagaLiveConsistent·`svc-mail-core.js` sagaLivenessConsistent·`svc-guild.js` bankConsistent/rosterConsistent).

**판정: 진행 지도의 ✅ 주장은 프로토타입 수준에서 과장 없이 사실. 문서가 한계(잔여/미착수)를 스스로 정직하게 기록.**

## 2. 구조적 격차 (실전 게임 투입 관점 · 우선순위순)

### ⒜ 검증 커버리지 구멍 — 서비스 계층 실행 가능 검증 0 (#16 확장 · 최우선)
- `engine/verify-kit.js` ORDER(영구 28모드)에 **exchange/mail/guild 참조 0건**. 거래소(0107~0140)·우편(0142~0180)·길드(0181~0200)·귓속말/파티(0064~0106) capstone 모드는 각 step 커밋의 `verify.js` 에만 존재.
- 원격 클론(이 감사 환경)의 HktInfra 이력은 **step-0210 부터** — 0107~0200 구간은 git 재현조차 불가. 해당 박스들은 HEAD 토폴로지에 배선은 되어 있으나(`topo-build.js:89-90`) ops 미주입 시 휴면 — 현재 회귀가 보장하는 건 "로드된다" 뿐.
- **결과**: "수치=verify 출력" 정전 제약이 이 구간에서 실효적으로 깨져 있음. → **승급 라운드 2차**(0231~0240 판): 서비스 saga capstone 재작성 편입 + 시대별 grand capstone(worldcap·clusterdatacap·coordmergecap·mze2ecap·upce2ecap) ORDER 승격.

### ⒝ 추상화 → 실물 전환 시 살아남지 못하는 속성 (정직성은 확인됨 · 전환 설계 필요)
- in-proc 버스의 동기 가시성·결정론 순서 / "durable=별 박스 RAM 도달"(`persist.js:44` 자체 명시) / fsync 인프로세스 모델(`worldlog.js`) / 캐시 백킹=주입 map — NATS/Redis/Postgres 로 바꾸는 순간 전제가 달라짐.
- **살아남는 자산**: 회계 항등식(saga·escrow 보존)·멱등 dedup·release+acquire 쌍 거래·epoch 펜싱 — 프로토콜 불변식이 이 시리즈의 진짜 산출물.
- 구조 관찰: `svc-bus.js` 는 64줄 무보장 토픽 라우터 — replay/ack 워터마크/lease 신뢰성 기계는 **생산자 측 믹스인**(`svc-inventory-bus.js`)에 삶. 실물 브로커 전환 시 "누가 신뢰성을 소유하나" 재설계 지점.

### ⒞ 보안 표면 전무 (문서 인정 · 실서비스 전 필수)
- 서버간 인증 0(존이 게이트웨이 발신 암묵 신뢰·§3 ⬜) · 클라 암호화 0 · 계정 검증 주입 Set(`loginqueue.js:30`) · 티켓 무서명(위조 가능).

### ⒟ 프로덕션 프로파일 부재 (#75 신규)
- reg-0 규칙의 부작용으로 유계 노브 기본값이 전부 무계: `downRecvWindow=0`(무계·`gateway.js:85`)·`capacity=∞`(`loginqueue.js:25`·`cache.js:43`)·`leaseSpan=0`·saga 재시도 무제한. 기본 배포 = 무계 메모리. → 권장값 1벌을 verify 모드로 봉인.

### ⒠ 남은 단일점·스케일 한계 (기존 격차의 심각도 재확인)
- 오케스트레이터/코디네이터 자신의 failover 없음(존·프레즌스·소비자는 있음) · 게이트웨이 단일(풀 ⬜·#74 seam→실 GW) · 정적 2존(동적 경계·N존 ⬜ — "공간 무한 분할" 약속의 핵심) · 부하 척도 = 개수만(tick 비용·대역 미반영).

## 3. 권고 (STATE §2 🔎 블록과 동일 · 다음 step 부터 순서대로)

1. **#16 승급 라운드 2차** — ⒜ 해소. 서비스 계층 재검증 가능성 복원이 최우선 부채.
2. **#74 실 게이트웨이 프로세스 분리** — 기존 권고 유지. 닫히면 클라↔GW↔존 전 구간 실 OS 경계.
3. **#46 금고↔가방 escrow + 서버간 인증 씨앗** — 실전 정합·보안의 최단 경로.
4. **#75 프로덕션 프로파일** — 무계 기본값 리스크를 회귀로 봉인.
