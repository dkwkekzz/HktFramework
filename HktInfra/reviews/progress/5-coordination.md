# ⑤ 코디네이션 — "누가 어디에" 의 단일 진실

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: "플레이어 X 는 어느 게이트웨이·어느 존" 과 "어떤 존을 어느 서버가 맡나"를 한 곳이 안다. 어떤 단일 서버도 *영구 중심*이 아니다 — 죽으면 다른 데가 맡고, split-brain(둘이 동시에 주인) 0. 그리고 *소비자가 죽으면 스스로 되살린다*.

---

## 세션/프레즌스 ✅ 자라는 중 *(전용 박스로 독립 → 쓰기·발행·읽기 전 경로 failover-safe)*

- **푸는 병목**: 귓속말·파티·핸드오프가 "X 가 지금 어디" 를 매번 떠돌이로 찾으면 안 된다 — *조회 한 곳*(SSOT). 그 한 곳이 *죽어도* 끊기면 안 되고, *물어보면* 답해야 한다.
- **지금 어디**: 등록 씨앗 → orch 곁붙이 → **독립 박스(PresenceService)** → 그 박스가 *죽어도 살아남고 물어보면 답하는* failover-safe SSOT.
  - `step-0001` — 레지스트리 씨앗(누가 어디에 등록).
  - `step-0055~0063` — 소비자 건강 프레즌스(누가 down/permanent)를 버스로 알고 svc.presence 발행 + presmon 상태 기계 관측(orch 곁붙이 단계).
  - `step-0064~0065` — **전용 박스로 독립**: SSOT+발행을 orch→PresenceService(이중 SSOT 제거) → 보고 버스화(orch 가 박스 *주소를 모름*·완전 decouple·failover 기반).
  - `step-0066~0068` — **failover**: standby 가 같은 보고로 SSOT 그림자 복제(shadow·갭 0)→primary 죽으면 승격해 발행 인계→하트비트 침묵으로 *스스로* 사망 감지(외부 트리거 0).
  - `step-0069~0070` — **읽기 경로**: "지금 상태?" pull 질의(구독 못 한 소비자도 앎)→승격 시 새 주소 공지→질의자 재타깃(질의도 failover 연속).
- **남은 것**: 플레이어 프레즌스 실사용 — 귓속말/파티 *라우터*. self-hb 메아리·재타깃 윈도·다중 standby(경미).

## 오케스트레이터 ✅ 자라는 중 *(failover 에 더해 self-healing 제어 루프 완성)*

- **푸는 병목**: 정적 배치는 한계다 — 존 배치·죽은 노드 인계가 *동적*이어야(주인 둘이면 split-brain). 더해서 *죽은 소비자*는 자동으로 되살아나야(사람 개입 0).
- **지금 어디**: zone failover(주인 정하고 펜싱) → **소비자 self-healing 제어 루프**(죽음 감지→되살리기→확인→재시도→포기→발행).
  - `step-0009~0013` — zone failover: lease·진짜 kill 감지·epoch 펜싱·재-provisioning(split-brain 0). broker lockstep 배리어(검증용 결정론 받침).
  - `step-0056~0060` — **소비자 self-healing 루프**: down 소비자에 recover 명령(소비자 자기 재구독)→recoverAck 확인→미확인 재시도→상한 포기(permanentDown)→건강 판정 svc.presence 발행(반응·치유 로직 분리).
  - `step-0064` — **순수 오케스트레이터로 정리**: 프레즌스 SSOT+발행을 PresenceService 로 넘기고 orch 는 *결정·행동*(recover/retry/포기)만 — 三역할 중 프레즌스 떼냄(치유는 아직 겸함).
- **남은 것**: **진짜 비동기**(lockstep 배리어 해제·가장 큰 빚) · 치유 로직 HealService 분리(orch 가 아직 겸함) · 적응형 recoverTimeout(관측 RTT).

---

> **이 계층 다음 걸음**: ⒜ 가장 큰 빚 — *진짜 비동기*(중앙 lockstep 배리어를 떼고 논리/벡터 클럭·인과 순서로 배리어 없이 결정론·소유자 1). ⒝ 프레즌스 박스는 failover-safe SSOT 까지 섰다(0064~0070) — 다음은 *플레이어 프레즌스 실사용*(귓속말/파티 라우터). ⒞ orch 三역할 중 프레즌스 ✅분리(0064)·*치유(HealService) 분리*는 남음.
