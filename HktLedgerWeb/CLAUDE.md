# CLAUDE.md — HktLedgerWeb 작업 규칙 (방법의 권위)

에너지 원장 동기화 MMORPG 웹 프로토타입. 이 문서는 **어떻게 작업하는가**만 정한다 —
방향(어디로)은 [SPINE.md](SPINE.md), 현재(어디까지·다음)는 [STATE.md](STATE.md),
설계 의도 전문(왜)은 [Docs/Design-EnergyConservationSync.md](../Docs/Design-EnergyConservationSync.md).

## 불변 규칙 — 어기면 기능이 아니라 재설계 대상

1. **보존**: 창세(`W:SRC` = 10⁹) 이후 어떤 시퀀스에서도 전 풀 합계 불변. 강제 지점은 `shared/ledger.js` 의 이체 클램프 단 한 곳 — 검증 코드가 아니라 자료구조가 막는다. 잔고 직접 조작 금지.
2. **에너지는 전부 정수**: 상수는 `shared/constants.js` 단일 출처. 부동소수 에너지 금지.
3. **`shared/` 는 외부 의존 0**: 순수 결정론 로직만 — C++ 이식 대상이다. Node/브라우저 API 를 넣는 순간 이식 가능성이 죽는다.
4. **서버는 시뮬레이션하지 않는다**: `server/game.js` 는 회계사 — ① 클램프 ② FIFO 순서 중재 ③ 원장 커밋 ④ relevancy 방송. 이동 적분·연출·세부 판정은 전부 클라이언트.
5. **모든 게임플레이 = 이체 문법**: 새 시스템은 `{from, to, amount, cause}` 이체의 조합으로 기술한다. 이체로 표현 못 하면 이 설계의 반례이므로 STATE 에 정직하게 기록.
6. **틱 플러시 순서 LEAVE→OPS→ENTER**: `shared/protocol.js` 규약. 서버 처리 순서는 리스폰→인텐트 FIFO→재충전→플러시.
7. **좌표는 권위가 아니다**: 비콘은 속도 예산·사거리 검증용. 배치는 동기화하지 않는다 — 시드 유도(`shared/worldgen.js`).

## 읽기 허용목록 — 그 외 읽지 마라

- **필독 3종(전체)**: `CLAUDE.md`(이 문서) · `SPINE.md` · `STATE.md`.
- **코드는 이번 조각이 닿는 파일만**: 파일 지도는 [README.md](README.md) §구조 — 통상 1~3개.
- **읽기 금지**: 옛 `steps/step-NNNN.md`(STATE 가 명시 지시할 때만 예외) · `Docs/` 설계 문서 전문(SPINE 이 필요한 절만 링크한다).

## step 절차 — 한 바퀴 = 한 조각 = 1커밋

1. **읽기** — 위 허용목록.
2. **구현** — STATE §2 NEXT 의 조각 하나만. 새 검증은 `test/` 에 테스트로 남긴다(수동 확인으로 끝내지 않는다).
3. **검증** — `npm test`(전 불변식 회귀) + 동작 확인이 필요하면 `node tools/bots.js 8` 봇 시뮬. 문서의 모든 수치는 이 출력을 그대로 옮긴다 — 손으로 쓰지 않는다.
4. **기록** — `steps/step-NNNN.md` 압축 3절(≤4KB): ① 한 일(어느 파일에 무슨 메커니즘) ② 검증(테스트·시뮬 출력 수치) ③ 불변식 판정 + 정직한 한계. 서사·다음 예고 금지 — *왜*는 SPINE, *다음*은 STATE 소관.
5. **STATE 갱신** — §1~4 는 바뀐 절만 **덮어쓰기**(누적 금지·전체 Write 금지, 절 단위 Edit), §5 INDEX 만 literal 1줄 append(`step | 조각 | 통과+핵심수치 1개`). STATE ≤ 12KB.
6. **닫기** — 델타 1커밋: `HktLedgerWeb step-NNNN: <조각 한 줄>`.

## 금지 사항 (비용·부패 함정)

- 옛 step 문서를 "참고로" 읽지 않는다 — STATE 가 현재의 SSOT 다.
- STATE 를 통째로 다시 쓰지 않는다 — 절 단위 Edit 만.
- HktGameplay/HktInfra 코드를 참조·연동하지 않는다 — 이 트랙은 독립이다(SPINE §0).
- UE5 빌드는 이 트랙과 무관 — 실행하지 않는다.
- 검증 없는 수치를 문서에 쓰지 않는다 — `npm test` 출력이 그림보다 우선.
