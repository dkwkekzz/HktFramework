# HktFeature — 오픈월드 MMORPG 규칙 시뮬레이션 기반

> 규칙을 feature 단위로 정의·검증하며 방대한 복잡계를 쌓아 다채로운 게임을 표현한다.
> 엔진 기반은 원장 동기화 모델(HktLedgerWeb 이식) — 서버는 회계사, 클라이언트는 세부 시뮬레이터.

**작업 세션 필독 순서**: [CLAUDE.md](CLAUDE.md)(목표·규칙·방식) → [STATE.md](STATE.md)(현재 상태·feature 명제) → `features/`(각 feature 상세). 이 README 는 사람 진입용 실행 스냅샷이다.

## 실행 — 원클릭 시뮬레이션

설치 → 보존 테스트 → 원장 서버 → 봇 8기 → 관전 브라우저까지 한 번에:

```
run.bat            # Windows
./run.sh [봇수]    # macOS / Linux (관전: http://localhost:8080/?name=관전자)
```

개별 실행:

```bash
npm install
npm start          # 서버만 — http://localhost:8080 (탭 여러 개 = 멀티플레이)
node tools/bots.js 8
npm test           # 규칙 회귀 — 보존 상시 확인
```

## 구조 — 서버/클라 경계가 곧 설계의 경계

```
shared/    결정론 코어 (외부 API 의존 0) — ledger(이체 클램프)·constants·protocol·rng
server/    원장 권위(회계사) — 클램프·커밋·방송·relevancy·체크섬. 시뮬레이션 없음
client/    세부 시뮬레이터 — 이동 적분 + 읽기 전용 관측 뷰어(미러 원장)
tools/     무특권 봇 — 브라우저 클라와 동일 프로토콜로 시뮬 부하 생성(접속·이동)
test/      규칙 회귀 (npm test) — 보존·검증·미러 정합 불변식 상시 검증
```

> **최소 원장 코어**: 지금은 접속·이동·보존만 있는 빈 기반이다. 게임플레이(채집·전투·성장·아이템…)는
> 규칙을 `{from,to,amount,cause}` 이체로 기술하는 **feature 로 하나씩 얹는다** — 그때 인텐트·풀·상수·시각화가 붙는다.

## feature 진행 방식

하나의 직관적 기능(feature)은 **측정 가능한 최종 목적**을 가진다. 그 목적에 도달할 때까지 step 으로 나눠 진행하고 과정을 `features/feature-NNNN-*.md` 에 간단히 남긴다. 모든 명제는 `npm test`(+ 봇 시뮬)로 **언제든 검증**된다. 현재 feature 목록·상태는 [STATE.md](STATE.md).

예) feature-0001 **전 세계의 에너지는 보존된다** — 전 풀 합계 = 10⁹ 불변([features/feature-0001-energy-conservation.md](features/feature-0001-energy-conservation.md)).
