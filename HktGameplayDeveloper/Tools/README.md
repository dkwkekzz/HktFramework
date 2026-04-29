# HktGameplayDeveloper Tools

AI Agent 가 코드 수정 후 UE Automation 테스트를 직접 실행/분석/재시도할 수 있도록 하는 헤드리스 러너.

## 파일

| 파일 | 역할 |
|---|---|
| `run_automation_tests.py` | UnrealEditor-Cmd 헤드리스 실행 → `index.json` 파싱 → 구조화된 JSON stdout |
| `.hkt-test.env.example` | 사용자별 엔진/프로젝트 경로 템플릿 |
| `.hkt-test.env` (gitignored) | 실제 설정 — 직접 만들어 채우는 파일 |
| `../.claude/commands/test-fix.md` | `/test-fix` 슬래시 커맨드 — 실행→분석→수정→재실행 루프 |

## 일회성 설정

```bash
cp HktGameplayDeveloper/Tools/.hkt-test.env.example \
   HktGameplayDeveloper/Tools/.hkt-test.env
```

`.hkt-test.env` 안의 두 값만 채운다:
- `UE_ENGINE_PATH` — UE5.6 엔진 루트 (Engine/ 폴더의 부모)
- `UE_PROJECT_FILE` — 호스트 .uproject 절대 경로

## 사용

### 사람이 한 번 실행
```bash
python HktGameplayDeveloper/Tools/run_automation_tests.py --filter HktCore.Story
```

### 에이전트 루프
Claude Code 세션에서:
```
/test-fix HktCore.Story 5
```

## 종료 코드

| 코드 | 의미 |
|---|---|
| 0 | 모든 테스트 통과 |
| 1 | 1개 이상 실패 (출력 JSON 의 `failures[]` 참조) |
| 2 | 실행 자체 실패 (UE 부팅 실패, 빌드 에러, 경로 문제 등) |

## 출력 JSON 스키마

```jsonc
{
  "success": false,
  "total": 47, "passed": 45, "failed": 2, "skipped": 0,
  "duration_seconds": 12.34,
  "filter": "HktCore.Story",
  "failures": [
    {
      "test_name": "FHktStoryV2_MoveStop_Equivalent",
      "full_test_path": "HktCore.Story.V2.MoveStop.Equivalent",
      "errors": ["Expected MoveForce=0 got 12.5"],
      "warnings": [],
      "duration_ms": 18.2
    }
  ],
  "raw_report_path": "/tmp/hkt-automation-XXXX",
  "stderr_tail": "..."
}
```

LLM 에이전트는 `failures[].errors` 만 읽으면 수정 위치 추적 가능 — UE 로그 전체 파싱 불필요.

## CLI 옵션

| 인자 | 설명 |
|---|---|
| `--filter PREFIX` | Automation 테스트 필터 (default: `HktCore`) |
| `--engine PATH` | `UE_ENGINE_PATH` 오버라이드 |
| `--uproject PATH` | `UE_PROJECT_FILE` 오버라이드 |
| `--timeout SEC` | UE 프로세스 타임아웃 (default 1800) |
| `--report-dir DIR` | 리포트 출력 디렉토리. 미지정 시 임시폴더 |
| `--full` | stdout 꼬리 포함 전체 결과 |

설정 우선순위: CLI 인자 > 환경변수 > `.hkt-test.env`.
