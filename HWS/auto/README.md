# HWS 자율 step 루프 (A안 — 헤드리스)

`STATE.md` 의 "다음 step"을 **매번 새 세션**으로 진행하고, 검증을 통과하면 PR 생성·머지 후
다음 step 으로 넘어가는 루프. 사용자가 그린 흐름:

> 새 세션 → `STATE.md` 다음 Step → 검증 → PR → merge → 새 세션 → 반복

매 반복은 `claude -p` 단발 호출이라 **세션이 매번 완전히 새것**(컨텍스트 오염 없음)이다.

## 구성

| 파일 | 역할 |
|---|---|
| `run-loop.ps1` | 오케스트레이터(PowerShell). 브랜치·검증 게이트·PR·머지·재동기화를 통제 |
| `step-prompt.md` | 매 세션에 주는 지시문(HWS Step 루프 + 경계 규칙). 자유롭게 수정 가능 |

## 사전 준비 (1회)

1. **워킹트리 정리** — 현재 `Docs/HWS → HWS` 이동이 미커밋 상태다. 루프는 *깨끗한 트리*를 요구하므로
   먼저 이 rename 을 커밋해 둔다:
   ```powershell
   git add -A
   git commit -m "HWS: Docs/HWS → 루트 HWS 로 이동"
   ```
2. **gh 로그인** — 세션 프롬프트에서 `! gh auth login` 으로 직접 로그인(권장) 하거나 터미널에서 실행.
3. (선택) **머지 게이트를 원격 CI 로도** — 지금은 로컬 verify(`verify-sim-engine.js` + `step-NNNN/verify.js all`)
   가 게이트다. 자기 PR 을 자기가 머지하므로, 원하면 동일 verify 를 GitHub Actions 필수 체크로 추가해 이중화하라.

## 사용

```powershell
# 먼저 1회만 — 한 step 만들고 머지까지 (흐름 검증)
pwsh HWS/auto/run-loop.ps1 -MaxIterations 1

# 머지 없이 한 step 만 만들어 로컬에서 검토
pwsh HWS/auto/run-loop.ps1 -NoMerge

# 흐름이 확인되면 여러 step 연속
pwsh HWS/auto/run-loop.ps1 -MaxIterations 5

# 브랜치 보호(필수 리뷰/체크)가 걸려 있고 관리자라면
pwsh HWS/auto/run-loop.ps1 -MaxIterations 5 -AdminMerge
```

언제든 `Ctrl+C` 로 중단할 수 있다. 실패 시(검증 미통과·커밋 없음·머지 실패)에는 **루프가 멈추고
해당 브랜치를 남겨** 둬서 직접 들여다볼 수 있다.

## 한 반복의 동작

1. `main` 동기화 → 다음 step 번호 산출(`step-NNNN.md` 최대값+1) → `hws/step-NNNN` 브랜치 생성
2. **새 `claude -p` 세션**(cwd=`HWS/`) 실행 → 구현 + 자체 4기둥 검증 + 커밋 (push/PR/merge 는 안 함)
3. **머지 게이트**: `node engine/validate/verify-sim-engine.js` 와 `node step-NNNN/verify.js all` 둘 다 exit 0
4. 전진 확인: `step-NNNN.md` 생성됨 + `main` 대비 커밋 ≥ 1
5. `push` → `gh pr create --fill` → `gh pr merge --squash --delete-branch` → `main` 재동기화

## 주의

- **자연 종료 없음** — HWS 는 "큰 목표"를 향한 무한 점진 시리즈라 `STATE.md` 에 완료 마커가 없다.
  종료는 `-MaxIterations` 상한과 `Ctrl+C` 로만. 무한 루프로 돌리지 말 것.
- **자가 머지 리스크** — 사람 검토 게이트가 없다. 로컬 verify 가 최소 품질선이며, 시리즈의 "회귀 0 +
  닫힌 장부 + 결정론 + 가설" 4기둥이 그 핵심이다. 의심스러우면 `-NoMerge` 로 돌려 사람이 PR 을 검토·머지.
- **권한** — 무인 운영을 위해 기본적으로 `claude --dangerously-skip-permissions` 로 실행한다
  (`-SkipPermissions:$false` 면 `acceptEdits` 모드 — Bash 호출마다 멈출 수 있어 무인엔 부적합).
  이 디렉토리(JS/node 문서 작업)에 한정된 자동화임을 전제로 한 선택이다.
- **UE5 빌드 안 함** — 프롬프트가 엔진 빌드를 명시적으로 금지한다. 순수 JS/node 검증만 돈다.
