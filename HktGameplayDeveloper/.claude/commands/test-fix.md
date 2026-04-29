---
name: test-fix
description: HktAutomationTests 를 실행하고 실패 시 코드를 수정 → 재실행하는 자동 반복 루프.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
argument-hint: [filter] [max_iterations]
---

# HktAutomationTests 자동 수정 루프

UE5 Automation 테스트를 헤드리스로 실행하고, 실패한 테스트가 있으면
원인을 분석하여 코드를 수정한 뒤 다시 테스트를 돌리는 과정을 반복한다.

## 인자

- `$1` — 테스트 필터 prefix (선택, default: `HktCore`)
  - 예: `HktCore.Story` / `HktCore.VM.Opcode` / `HktCore`
- `$2` — 최대 반복 횟수 (선택, default: `5`)

## 선행 조건

`HktGameplayDeveloper/Tools/.hkt-test.env` 파일에 두 경로가 설정되어 있어야 한다:
- `UE_ENGINE_PATH` — UE5.6 엔진 루트
- `UE_PROJECT_FILE` — 호스트 .uproject 파일

미설정 시 `Tools/.hkt-test.env.example` 을 복사해 채우라고 사용자에게 알려라.

## 실행 절차

### 1. 환경 검증
```bash
test -f HktGameplayDeveloper/Tools/.hkt-test.env || {
  echo "❌ .hkt-test.env 가 없습니다. .hkt-test.env.example 을 복사해 채워주세요.";
  exit 1;
}
```

### 2. 반복 루프 (최대 $2 회, default 5)

각 iteration 마다:

#### 2-1. 테스트 실행
```bash
python HktGameplayDeveloper/Tools/run_automation_tests.py --filter "$1" --timeout 1800
```

종료 코드:
- `0` → **모든 테스트 통과**. 사용자에게 최종 요약을 보고하고 루프 종료.
- `1` → **실패 존재**. 출력 JSON 의 `failures[]` 를 읽어 다음 단계로.
- `2` → **실행 자체가 실패**. UE 빌드/경로/환경 문제. 즉시 중단하고 사용자에게 보고.

#### 2-2. 실패 분석

`failures[]` 의 각 항목에 대해:
1. `full_test_path` 로 해당 테스트 소스 위치를 추적 (`grep -rn "<test name>" HktGameplay*/Source HktGameplayDeveloper/Source`)
2. `errors[]` 의 메시지에서 의심 모듈/심볼/파일을 식별
3. 한 번에 **루트 원인 하나**만 가설로 세운다 — 같은 파일에 여러 실패가 몰려있다면 한 묶음으로 처리

#### 2-3. 코드 수정

ABSOLUTE 원칙(루트 CLAUDE.md)을 준수:
- ISP 3-Layer (Intent → Sim → Presentation) 역방향 의존 금지
- HktCore 는 UObject/UWorld 의존 0
- VM 은 WorldState 직접 쓰기 금지 (`FHktVMWorldStateProxy::SetPropertyDirty` 경유)
- `FHktEntityState` 는 직렬화 전용. 시뮬 로직에서 사용 금지
- Bulk 시스템 루프에서 `GetColumn()` 호이스팅

수정은 최소 침습 범위로 한정 — 테스트가 가르키는 구체적 결함만 고친다.
리팩토링/추상화 추가는 금지.

#### 2-4. 재실행
다음 iteration 으로 이동.

### 3. 종료 조건

- 모든 테스트 통과 → 성공 메시지 + 수정된 파일 목록 + 총 iteration 수
- 최대 횟수 도달 → 마지막 실패 목록과 그동안의 수정 시도를 정리해 보고하고 사용자 판단 요청
- 동일 실패가 2 iteration 연속 동일하게 반복되면 즉시 중단 (수정이 효과 없음 = 가설 잘못)

## 출력 형식

매 iteration 마다 다음 한 줄을 출력:
```
[iter N] passed=A failed=B duration=Cs — fixing: <간단 요약>
```

종료 시:
```
✅ ALL PASSED  (iters=N, fixed_files=[...])
```
또는
```
⚠️ STOPPED at iter N  (still failing: [...])
```

## 주의

- `run_automation_tests.py` 는 **CWD 기준 상대 경로** 가 아니라 **레포 루트 기준** 으로 호출한다.
  레포 루트가 아니라면 먼저 `cd` 하지 말고 절대 경로 또는 레포 루트 기준 상대 경로를 사용.
- UE 가 한 번 뜨는 데 60-180초가 걸린다. 출력이 멈춘 듯 보여도 timeout 1800s 이내면 정상.
- 빌드 에러(컴파일 실패)는 종료 코드 2 로 나온다 — 이 경우 stderr 와 stdout_tail 을
  확인해 컴파일 메시지를 추적해야 한다.
