# ④ 버스 — 서버끼리 직접 안 엮이게 하는 신경망

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: 서버가 늘수록 서로 직접 부르면 N×N 그물이 된다. pub/sub 으로 *주소·내부를 서로 모른 채* 구독으로만 전파한다 — 새 소비자 추가가 발행자를 안 건드린다.

---

## 이벤트 버스 ✅ 자라는 중 *(서비스 다음으로 깊게 자람)*

- **푸는 병목**: 직접 RPC 그물 제거(결합 0) + 죽거나 늦거나 흘려도 *결국 전부 도착*(무손실·유계 버퍼·죽은 소비자 감지).
- **지금 어디**: 단순 전송관 → 의미 있는 pub/sub → failover·유계화·소비자 수명관리까지.
  - `step-0004` — 전송 substrate(지연·손실·재정렬·신뢰성 모델).
  - `step-0012` — 토픽 pub/sub.
  - `step-0016` — *서비스 의미*: 발행자 무수정으로 소비자 추가(ServiceBus).
  - `step-0019` — 발신 소비자(ranking) 합류.
  - `step-0033` — 동적 구독.
  - `step-0034` — failover·재구독(진실 원천 = 소비자).
  - `step-0036~0037` — 결과/요청 양경로 무손실(producer replay).
  - `step-0039~0042` — replay 버퍼 유계화·ack 자기-크기조정·seenReqs 유계화.
  - `step-0044` — min-워터마크(모든 소비자 frontier 의 최소로 결과 버퍼 정리).
  - `step-0045` — 소비자 lease/축출.
  - `step-0046~0047` — 다중 게이트웨이 producer 네임스페이스·per-producer seen 워터마크.
  - `step-0048~0050` — lease lifecycle 정합·적응형 leaseSpan(관측 cadence 로 축출 임계 self-size).
- **남은 것**: 버스 물리 분산·per-producer ack·cadence EWMA·라우팅 영속·서버간 인증.

---

> **이 계층 다음 걸음**: 인프로세스 가설 버스를 *물리 분산*(NATS/Redpanda 등가)으로 현실화하고, 서버간 인증을 붙여 "모르는 채 통신"에 신뢰 경계를 더한다.
