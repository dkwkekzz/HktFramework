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

**지금 어디 / 다음**: 존 하나가 *분할·관심영역·권위 이주·죽어도 부활*까지. 다음 = 동적 경계·N 존.

## 인스턴스(던전/매치) 서버 🟡 자라는 중

**무슨 서버인가**: 던전·매치처럼 수요 따라 떴다 사라지는 *일회성* 시뮬 서버(`src/instance.js`). *비유 — 상설 매장(존) vs 팝업 스토어(인스턴스).*

**필요한 기능들**:

1. **수요 탄력 spawn/despawn** ✅ 기본 — 왜: 오픈월드 존과 수명주기를 분리해 탄력 확보. / 어떻게: 활성 인스턴스 집합 SSOT(권위 단일 소유)·spawn 멱등·despawn graceful. / 했나: `step-0201` `InstanceServer` 새 박스·instanceSpawn→active(중복 0) + `step-0202` instanceDespawn→active 제거·retired 누적(일회성 수명 완성). 존(영속 tick)과 수명주기 분리.
2. **클라 라우팅(인스턴스로 입장·이탈)** ✅ — 왜: 플레이어를 띄운 인스턴스로 보내고, 떠나면 자리를 비워야. / 어떻게: player→instance 배정 SSOT(한 player=한 인스턴스·권위 단일 소유)·죽은 인스턴스 거부·재배정 release+acquire 쌍·이탈은 route 해제(release). / 했나: `step-0216` instanceRoute(routes 맵·occupancyOf·게이트웨이 던전 입장 라우팅 토대) + `step-0221` instanceLeave(배정 player route 해제·occupancy 감소·권위 release=0216 acquire 의 짝·미배정 멱등). 미주입이면 휴면(reg 0). *잔여(#50): 직접 instanceDespawn 시 routes 미정리(orphan route 잔존)·단 reap(0222)은 occupancy 0 만 회수해 orphan-safe·instanceLeave 가 player-side 정리 primitive 제공.*
3. **수요 탄력 스케일링(자동 spawn + 자동 despawn)** ✅ — 왜: 부하/대기에 따라 자동 채우고, 수요 하락엔 비운다. / 어떻게: active(kind)<target 이면 부족분 자동 spawn(결정론 auto-id·멱등)·active(kind)>target 이면 빈(occupancy 0) 인스턴스 자동 회수(점유 보호). / 했나: `step-0215` instanceDemand(1→target 탄력 수렴·수요 기반 확장) + `step-0222` instanceReap(active>target 빈 인스턴스 부족분 회수·점유된 건 보호·0215 의 거울=탄력 축소). *잔여: 오케스트레이터가 수요/부하를 판단해 demand/reap 을 *자동* 발신(현재는 명령 주입만)·2차.*

**지금 어디 / 다음**: spawn/despawn + **수요 자동 spawn/despawn(0215·0222)·플레이어 라우팅·이탈(0216·0221)**까지 — 수명주기·배정 양방향 완비. 다음(2차) = 오케스트레이터 수요 자동 연동·orphan route despawn-time 스윕(#50).

---

> **이 계층 다음 걸음**: 정적 2존 → *동적 경계·N 존*. 그래야 "단일 인스턴스가 공간으로 무한 분할" 약속이 선다.
