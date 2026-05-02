# HktTest Skill — UE5 Automation 테스트 + 자동 실패 수정

UE5 Automation 테스트(HktAutomationTests)를 헤드리스로 실행하고, 실패가 있으면 원인 분석 → 코드 수정 → 재실행을 반복한다.

**사용자가 `/test-fix` 를 명시 호출하면 그대로 실행한다.** HktCore / HktStory / VM 관련 코드를 수정한 직후에는 사용자에게 한 줄 제안("테스트 돌려볼까요?") 만 하고, 자동으로 돌리지는 말 것.

## 사용법

```
/test-fix                 — HktCore 전체 테스트 실행 (수정 루프 5회)
/test-fix HktCore.Story   — 특정 카테고리만
/test-fix HktCore 1       — 1회만 실행 (수정 루프 비활성)
```

## 환경 상수

```
RUNNER     = HktGameplayDeveloper/Tools/run_automation_tests.py
ENV_FILE   = HktGameplayDeveloper/Tools/.hkt-test.env  (UE_ENGINE_PATH / UE_PROJECT_FILE / UE_BUILD_CONFIG)
DEFAULT_FILTER = HktCore
DEFAULT_MAX_ITER = 5
TIMEOUT_SEC = 1800
```

`.hkt-test.env` 가 없으면 `.hkt-test.env.example` 를 복사해 두 경로(`UE_ENGINE_PATH`, `UE_PROJECT_FILE`) 와 `UE_BUILD_CONFIG=DebugGame` 를 채우라고 사용자에게 알려라.

## 실행 절차

### Step 1: 테스트 실행 (단일 명령)

리포트는 안정 경로로 받아 두번째 iteration 에서도 참조 가능하게 한다:

```bash
python HktGameplayDeveloper/Tools/run_automation_tests.py \
  --filter "$FILTER" --timeout 1800 --report-dir /tmp/hkt-report-$ITER
```

타임아웃 600000ms (10분). UE 부팅에 60–180초 걸려도 정상.

종료 코드:
- `0` → **모든 테스트 통과**. 사용자에게 한 줄 요약 보고하고 종료.
- `1` → **실패 존재**. stdout 의 `failures[]` 를 읽어 Step 2 로.
- `2` → **실행 자체 실패**. UE 부팅 / 빌드 / 경로 문제. 즉시 중단하고 stderr_tail 보고.
  - "module ... could not be found" → 빌드가 빠진 컨피그. `UE_BUILD_CONFIG` 확인 후 `/build` 안내.
  - "index.json … 찾지 못함" → UE가 부팅 자체에 실패. 로그(`HktProto/Saved/Logs/HktProto.log`) 확인.

### Step 2: 실패 분석

`failures[]` 의 각 항목에 대해:
1. `full_test_path` 로 테스트 소스 위치 추적
   ```
   Grep("<test_name>", path="HktGameplay*/Source HktGameplayDeveloper/Source")
   ```
2. `errors[]` 메시지에서 의심 모듈/심볼/파일 식별
3. **한 번에 루트 원인 하나** 만 가설로 세움 — 같은 파일에 여러 실패가 몰려있으면 한 묶음으로 처리

### Step 3: 코드 수정

루트 ABSOLUTE 원칙(`CLAUDE.md`) 준수:
- ISP 3-Layer (Intent → Sim → Presentation) 역방향 의존 금지
- HktCore 는 UObject/UWorld 의존 0
- VM 은 WorldState 직접 쓰기 금지 (`FHktVMWorldStateProxy::SetPropertyDirty` 경유)
- `FHktEntityState` 는 직렬화 전용 — 시뮬 로직에서 사용 금지
- Bulk 시스템 루프에서 `GetColumn()` 호이스팅

수정은 **테스트가 가르키는 구체적 결함만** — 리팩토링/추상화 추가 금지.

### Step 4: 재실행

다음 iteration 으로. iter 마다 한 줄 출력:
```
[iter N] passed=A failed=B duration=Cs — fixing: <간단 요약>
```

### Step 5: 종료 조건

- 모든 통과 → `✅ ALL PASSED (iters=N, fixed_files=[...])`
- 최대 횟수 도달 → 마지막 실패 목록 + 시도한 수정 정리해 보고 후 사용자 판단 요청
- **동일 실패 2회 연속 동일 발생** → 즉시 중단 (가설 잘못)
- **새 실패가 이전보다 늘어남** → 즉시 중단 + 회귀 보고

## 실패 패턴 빠른 참조

| 에러 메시지 패턴 | 흔한 원인 | 우선 확인 |
|---|---|---|
| `Expected X got Y` 수치 차이 | VM Op 구현 / WorldState dirty 누락 | `Op_*.cpp`, `FHktVMWorldStateProxy` |
| `nullptr` 접근 | 컬럼 미등록 / 엔티티 archetype 불일치 | `HktCoreProperties.h` 의 `HKT_DEFINE_PROPERTY` |
| Story step 미실행 | precondition tag 불일치 | `Story_*.json` 의 `requireTags` |
| 결정론 실패 | float 비결정 연산 | `HktDeterministicMath` 사용 여부 |
| timeout / crash | 무한루프 / scheduler bug | UE 로그 tail 분석 |

## 주의사항

- 러너는 **레포 루트 기준 상대 경로** 로 호출. 다른 CWD 에서는 절대 경로 사용.
- UE 에디터가 떠 있으면 헤드리스 러너가 동시 실행 불가 — 먼저 종료 안내.
- 빌드 산출물이 없으면(`module ... could not be found`) `/build` 가 선행돼야 함.
- 한국어 인코딩 깨짐은 무시 (Windows cp949).
- HktInsights 가드(`ENABLE_HKT_INSIGHTS`) 가 들어간 코드는 Shipping 빌드에서 제외 — 테스트는 Editor 빌드 기준.
