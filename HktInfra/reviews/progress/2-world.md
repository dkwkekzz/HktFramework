# ② 월드 — 결정론 시뮬만 사는 신성한 tick

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: 시뮬 tick 안에는 *시뮬만* 둔다. I/O·트랜잭션·팬아웃을 tick 밖으로 빼면 시뮬 헤드룸이 곧 동접이 된다. *결정론* 덕에 상태를 통째로 안 보내고 입력 로그만으로 같은 세계를 재현한다 — 이게 복제·복원·failover 의 토대.

---

## 존(리전) 서버 🟡 자라는 중 *(현재 전 박스 중 가장 성숙)*

**무슨 서버인가**: 세계의 한 구역을 *결정론 시뮬 전용*으로 돌리는 서버(`src/zone.js`). *비유 — 같은 악보(입력열)를 받은 두 연주자는 같은 연주(상태)에 도달한다.*

**필요한 기능들** (기능마다 다른 이론에 기댄다):

1. **시뮬 *전파 stub*(VM)** ✅ — 왜: 전파를 자극할 이벤트 소스/싱크가 있어야(시뮬 *내부 구현*은 ⛔범위 밖·HktGameplay 소관). / 어떻게: 전파 자극용 최소 결정론 stub(시드+입력→상태) + `ISimCore` 이음새 동결(HktInfra↔시뮬 경계). / 했나: `step-0001` 존 VM stub + `step-0003` `ISimCore` 동결(이음새 — 안쪽 C++ HktCore 는 남이 채움).
2. **복제 = *이벤트 전파 재현*(죽어도 이어받기)** ✅ — 왜: 권위 하나면 죽으면 끝. / 어떻게: 추종자가 *입력열(이벤트)만* 미러해 같은 뷰로 수렴(상태 0바이트 전송·HktInfra 의 결정론=전파 수렴). / 했나: `step-0002~0004` 결정론 *전파* 복제(현실 전송 지연·손실·재정렬에도 desync 597→0). 시뮬 *내부* 비트-결정론은 이음새 뒤 HktGameplay 몫(⛔범위 밖·#1 재분류).
3. **관심 영역(AOI)** ✅ — 왜: 한 존이 온 세계 뷰를 다 보내면 대역 폭발. / 어떻게: 반경 R 안만 뷰로 + 증분(enter/exit/update). / 했나: `step-0005` AOI(대역 51~68%↓) → `step-0007` 증분 AOI(정지 대역 0).
4. **공간 분할 + 권위 핸드오프** ✅ — 왜: 한 존이 세계 전부를 못 맡음·경계 넘는 권위 이동에 공백/이중쓰기 0. / 어떻게: 존 경계 ghost 상호 구독 + 권위 release+acquire *쌍 거래*(소유자 항상 1). / 했나: `step-0006`.
5. **전송 열화 복원** ✅ — 왜: 끊기면 뷰가 깨짐. / 어떻게: ack/재전송·NAK/keyframe. / 했나: `step-0008`(손실 0~30%에도 desync 0).
6. **failover(권위 존 사망 대응)** ✅ — 왜: 권위 존이 죽으면 그 구역 정지. / 어떻게: 추종자(shadow)가 lease 감지로 승격·죽은 추종자 재충원. / 했나: `step-0009` 승격 + `step-0010` 별 프로세스 + `step-0013` 재충원(divergence 0).
7. **동적 경계·N 존** ⬜ — 왜: 오픈월드 = 단일 인스턴스 무한 분할. / 어떻게: 부하 따라 경계 이동·존 증설. / 했나: 미착수(지금은 2존 정적).
8. **다운스트림 AOI 뷰 — 산출·검증·*전파*·*실 클라 수렴*(#9 후속·월드 다운스트림·SPINE §4 경로2 완결·인프로세스)** ✅(인프로세스) — 왜: 브리지 런타임 존(#56·0281~)의 `onTick` 이 세션에 `view_delta`(AOI 뷰)를 산출하지만 *no-op 싱크로 드롭*돼 왔다(SPINE §4 경로2 *월드 다운스트림* = 뷰가 *내려가는* 절반 미배선). 산출만 해도 *누가 받는가*(전파)·*받아서 같은 세계를 보는가*(수렴 desync 0)가 없으면 반쪽. / 어떻게(3층, 기능마다 다른 이론):
   - **⒜ 포착·검증층(0319~0330·sub-arc ✅)** — 런타임 존 net 싱크를 *버퍼링*으로(`topo-actors.js:71`) 보관·orch 읽기 전용 질의로 내용 검증: AOI 정확성(`zoneVisibleIds`==산출 enter)·증분 델타(keyframe1+변경분만·`zoneViewStats`)·exit(`zoneViewExited`)·직렬화(`zoneViewWire`)·격리(`zoneViewSessions`)·이주 연속(`zoneViewReport`)·무굶김(`zoneViewAllKeyed`)·무손실(`zoneViewConserved`)·capstone `downstreamCoherent`. 정리 `0323` 뷰 질의→`orch-views.js`.
   - **⒝ 전파층(0331~0341·sub-arc ✅)** — 버퍼의 뷰를 *실제 전역 net 으로* 송출: orch `_drainZoneEgress`(존 버퍼→게이트웨이 `zoneView`·per-세션 단조 `dseq`)·게이트웨이 수신/세션→클라 라우팅(`downClients`)·신뢰성(ack 자기-크기조정 `zoneEgressBuf`·gap-resync 재전송 `_resendEgress`·타임아웃 재전송 `_retransmitStale`·leave 정리·격리)·capstone `downstreamDeliverCoherent`(손실·lifecycle 무손실 인오더). 이론 = *기존 netcode 패턴의 다운스트림 판*(0008 ack/NAK·0040 bus ack·0058 recoverRetry·0042 seenBound).
   - **⒞ 실 클라 수렴층(0342~0350·sub-arc ✅)** — 전파 종단(spectator addr)을 *수신 전용 실 `DownClient` 액터*(`client.js`)로 교체 → host 권위 AOI == 클라 뷰(**desync 0**): 정적/상호 가시 위치(`zoneAuthSig`)·손실 하 수렴·교차 관찰자 일치(`seenPos`·겹친 뷰 desync 0)·다중 클라/migrate capstone(`convergedTo`)·수신 버퍼 유계화(`downRecvWindow`)·late-join keyframe·대시보드(`downstreamReport`)·E2E grand capstone `downstreamWorldCoherent`(0350·2존·3클라·손실·migrate·late-join 뒤 전 수렴). / 했나: 위 3층 `step-0319`~`0350`. 한계: DownClient·zoneHost 모두 인프로세스 액터(실 OS 프로세스/소켓 spawn=#57)·업스트림 intent 실 클라 경로(경로1) 미연결(#61).

9. **업스트림 intent 실 클라 — 경로1 양방향 실 클라(#61·0421~0430·인프로세스)** ✅(in-proc·잔여=실 OS 프로세스) — 왜: 기능 8 이 *다운스트림*(경로2·존→클라 뷰)을 실 `DownClient` 로 닫았으나(desync 0), *업스트림*(경로1·클라→게이트웨이→존 intent)은 여전히 *합성 주입*(`topo-inject.js` entityOps·net.send 'dc0'→gateway)이었다 — 실 클라가 intent 를 *생성·발신*하지 않았다(#61). 진짜 E2E 는 클라가 *발신*도 해야. / 어떻게(기능마다 다른 이론): 실 클라 액터 `UpClient`(`client.js:264`·kind 'upclient')가 ⒜ *자기 plan 으로 intent 생성*(onTick 이 joinAt 에 zoneEnter·이후 plan 한 발씩 zoneMove·leaveAt 에 zoneLeave·`:292`) ⒝ *게이트웨이로만 발신*(`:299`·은닉·gatewayDirectZone 직접 라우팅·합성 entityOps 대체) ⒞ *자기 AOI 뷰 수신*(onMsg view/view_delta→seen·`:277`·DownClient 동형 — enter 가 uc0 발신이라 게이트웨이가 세션→uc0 바인딩→뷰가 uc0 으로) ⒟ *권위로 수렴*(seenSig()==orch.zoneAuthSig·desync 0) ⒠ *업스트림 회계*(intentLog/intentDelta·발신 intent 전부 권위 반영·발신 손실 0). 발신+수신 = 실 양방향 클라. upClients=null(기본)→미스폰→this.order 불변→reg 0. / 했나: `step-0421` 골격(enter)→`0422` move(plan)→`0423` 양방향 수신→`0424` 수렴 desync0(`upconverge`)→`0425` ≡합성 entityOps 동치(`upvsscript`)→`0426` 다중 클라 인터리빙(`upmulti`)→`0427` leave 생애주기→`0428` 손실 하 수렴(egress 손실→gap-resync·`uplossy` gaps1·resyncs1)→`0429` 업스트림 회계(`upaccount`)→`0430` grand capstone 양방향 E2E(`upe2ecap`·uc0 수렴·b1 제거·보존·발신 회계). *잔여: UpClient/DownClient 모두 in-proc net 액터 — 실 host.js *OS 프로세스/소켓* 경계 업스트림(다운스트림 0361~0370 의 짝·#57 동반·#70)·동치는 권위 귀착(#69 류).*

**지금 어디 / 다음**: 존 하나가 *분할·관심영역·권위 이주·죽어도 부활*까지, 그 위에 **월드 다운스트림 데이터 평면 E2E(0319~0350·#9 후속·SPINE §4 경로2 host→게이트웨이→실 DownClient 수렴 desync 0)** + **업스트림 intent 실 클라(0421~0430·#61·SPINE §4 경로1 실 UpClient 발신→게이트웨이→존→자기 뷰 수신 desync 0·다중 클라·손실 하 수렴·생애주기·보존·발신 회계)** — *양방향 모두 실 클라*로 인프로세스 E2E 완결. 다음 = 실 host.js/UpClient/DownClient *OS 프로세스/소켓* spawn(#57·#70·cluster-run.js)·진짜 비동기(#4)·동적 경계·N 존.

## 인스턴스(던전/매치) 서버 🟡 자라는 중

**무슨 서버인가**: 던전·매치처럼 수요 따라 떴다 사라지는 *일회성* 시뮬 서버(`src/instance.js`). *비유 — 상설 매장(존) vs 팝업 스토어(인스턴스).*

**필요한 기능들**:

1. **수요 탄력 spawn/despawn** ✅ 기본 — 왜: 오픈월드 존과 수명주기를 분리해 탄력 확보. / 어떻게: 활성 인스턴스 집합 SSOT(권위 단일 소유)·spawn 멱등·despawn graceful. / 했나: `step-0201` `InstanceServer` 새 박스·instanceSpawn→active(중복 0) + `step-0202` instanceDespawn→active 제거·retired 누적(일회성 수명 완성). 존(영속 tick)과 수명주기 분리.
2. **클라 라우팅(인스턴스로 입장·이탈)** ✅ — 왜: 플레이어를 띄운 인스턴스로 보내고, 떠나면 자리를 비워야. / 어떻게: player→instance 배정 SSOT(한 player=한 인스턴스·권위 단일 소유)·죽은 인스턴스 거부·재배정 release+acquire 쌍·이탈은 route 해제(release). / 했나: `step-0216` instanceRoute(routes 맵·occupancyOf·게이트웨이 던전 입장 라우팅 토대) + `step-0221` instanceLeave(배정 player route 해제·occupancy 감소·권위 release=0216 acquire 의 짝·미배정 멱등). 미주입이면 휴면(reg 0). *잔여(#50): 직접 instanceDespawn 시 routes 미정리(orphan route 잔존)·단 reap(0222)은 occupancy 0 만 회수해 orphan-safe·instanceLeave 가 player-side 정리 primitive 제공.*
3. **수요 탄력 스케일링(자동 spawn + 자동 despawn)** ✅ — 왜: 부하/대기에 따라 자동 채우고, 수요 하락엔 비운다. / 어떻게: active(kind)<target 이면 부족분 자동 spawn(결정론 auto-id·멱등)·active(kind)>target 이면 빈(occupancy 0) 인스턴스 자동 회수(점유 보호). / 했나: `step-0215` instanceDemand(1→target 탄력 수렴·수요 기반 확장) + `step-0222` instanceReap(active>target 빈 인스턴스 부족분 회수·점유된 건 보호·0215 의 거울=탄력 축소). *잔여: 오케스트레이터가 수요/부하를 판단해 demand/reap 을 *자동* 발신(현재는 명령 주입만)·2차.*

**지금 어디 / 다음**: spawn/despawn + **수요 자동 spawn/despawn(0215·0222)·플레이어 라우팅·이탈(0216·0221)**까지 — 수명주기·배정 양방향 완비. 다음(2차) = 오케스트레이터 수요 자동 연동·orphan route despawn-time 스윕(#50).

---

> **이 계층 다음 걸음**: 정적 2존 → *동적 경계·N 존*. 그래야 "단일 인스턴스가 공간으로 무한 분할" 약속이 선다.
