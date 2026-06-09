<#
.SYNOPSIS
  HWS 자율 step 루프 (A안 — 헤드리스).
  매 반복 = 완전히 새 claude -p 세션이 STATE.md 의 다음 step 한 조각을 진행 →
  검증 게이트 통과 시 → 브랜치 PR 생성 → main 으로 merge → 다음 반복.

.DESCRIPTION
  한 반복의 흐름:
    1. main 동기화 (checkout + ff-only pull)
    2. 다음 step 번호 산출 → 전용 브랜치 hws/step-NNNN 생성
    3. fresh `claude -p` 세션 실행 (step-prompt.md) — 구현 + 자체 검증 + 커밋
    4. 머지 게이트: verify-sim-engine.js + step-NNNN/verify.js all (둘 다 exit 0)
    5. 전진 확인 (새 step-NNNN.md 존재 + main 대비 커밋 ≥1)
    6. push → gh pr create → gh pr merge --squash → main 재동기화
  어느 단계든 실패하면 루프를 멈추고 브랜치를 남겨 둔다(검사용).

.PARAMETER MaxIterations
  진행할 step 개수. 기본 1 (먼저 1회로 검증한 뒤 늘려라). 무한 시리즈이므로 자연 종료는 없다.

.PARAMETER NoMerge
  커밋·검증까지만 하고 push/PR/merge 는 건너뛴다(브랜치 로컬 검토용).

.PARAMETER AdminMerge
  gh pr merge 에 --admin 을 붙여 브랜치 보호 필수 체크/리뷰를 우회한다(관리자 권한 필요).

.PARAMETER SkipPermissions
  claude 를 --dangerously-skip-permissions 로 실행(무인 운영 기본값 $true).
  $false 면 --permission-mode acceptEdits 로 실행(Bash 호출마다 멈출 수 있음 → 무인엔 부적합).

.EXAMPLE
  pwsh HWS/auto/run-loop.ps1 -MaxIterations 1
  pwsh HWS/auto/run-loop.ps1 -MaxIterations 5 -AdminMerge
  pwsh HWS/auto/run-loop.ps1 -NoMerge        # 머지 없이 한 step 만 만들어 검토
#>
[CmdletBinding()]
param(
  [int]$MaxIterations = 1,
  [switch]$NoMerge,
  [switch]$AdminMerge,
  [bool]$SkipPermissions = $true
)

$ErrorActionPreference = 'Stop'

# ── 경로 ──────────────────────────────────────────────────────────
$RepoRoot   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$HwsDir     = Join-Path $RepoRoot 'HWS'
$PromptFile = Join-Path $PSScriptRoot 'step-prompt.md'

function Log([string]$m) { Write-Host "[hws-loop] $m" -ForegroundColor Cyan }
function Die([string]$m) { Write-Host "[hws-loop] ABORT: $m" -ForegroundColor Red; exit 1 }

# ── 사전 점검 ─────────────────────────────────────────────────────
if (-not (Test-Path $PromptFile)) { Die "프롬프트 파일 없음: $PromptFile" }
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Die "claude CLI 가 PATH 에 없음" }
if (-not (Get-Command node   -ErrorAction SilentlyContinue)) { Die "node 가 PATH 에 없음" }
if (-not $NoMerge) {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Die "gh CLI 가 PATH 에 없음 (-NoMerge 면 불필요)" }
  gh auth status | Out-Null   # stdout 만 버림(stderr 리다이렉트 금지 — 5.1 에서 NativeCommandError 유발)
  if ($LASTEXITCODE -ne 0) { Die "gh 미인증. 먼저 'gh auth login' 실행" }
}

# 워킹트리가 깨끗해야 함 (이동/미커밋 변경이 step 커밋에 섞이는 것 방지)
$dirty = git -C $RepoRoot status --porcelain
if ($dirty) { Die "워킹트리에 미커밋 변경이 있음. 먼저 정리/커밋 후 실행하라.`n$dirty" }

function Get-NextStepId {
  $nums = Get-ChildItem -Path $HwsDir -Filter 'step-*.md' -File | ForEach-Object {
    if ($_.BaseName -match '^step-(\d{4})$') { [int]$Matches[1] }
  }
  if (-not $nums) { Die "step-NNNN.md 를 찾지 못함 ($HwsDir)" }
  # [int] 캐스팅 필수 — Measure-Object.Maximum 이 double 을 반환하면 {0:D4} 가 깨진다
  $max = [int](($nums | Measure-Object -Maximum).Maximum)
  'step-{0:D4}' -f ($max + 1)
}

# ── 루프 ──────────────────────────────────────────────────────────
for ($i = 1; $i -le $MaxIterations; $i++) {
  Log "===== 반복 $i / $MaxIterations ====="

  # 1) main 동기화
  git -C $RepoRoot checkout main;        if ($LASTEXITCODE -ne 0) { Die "main 체크아웃 실패" }
  if (-not $NoMerge) {
    git -C $RepoRoot pull --ff-only origin main; if ($LASTEXITCODE -ne 0) { Die "main pull 실패" }
  }

  # 2) 다음 step + 브랜치
  $stepId = Get-NextStepId
  $branch = "hws/$stepId"
  Log "다음 step = $stepId / 브랜치 = $branch"
  $branchExists = git -C $RepoRoot branch --list $branch   # 없으면 빈 출력·stderr 없음(rev-parse 와 달리 안전)
  if ($branchExists) { Die "브랜치 $branch 가 이미 존재. 정리 후 재실행." }
  git -C $RepoRoot checkout -b $branch;  if ($LASTEXITCODE -ne 0) { Die "브랜치 생성 실패" }

  # 3) fresh claude 세션 (cwd = HWS)
  $prompt = Get-Content -Raw -Encoding UTF8 -Path $PromptFile   # PS5.1 기본 인코딩(ANSI)로 읽으면 한글 깨짐
  $permArgs = if ($SkipPermissions) { @('--dangerously-skip-permissions') }
              else { @('--permission-mode','acceptEdits') }
  Log "claude 세션 시작 ($stepId)…"
  Push-Location $HwsDir
  try {
    claude -p $prompt @permArgs
    $claudeExit = $LASTEXITCODE
  } finally { Pop-Location }
  if ($claudeExit -ne 0) { Die "claude 세션 실패 (exit $claudeExit). 브랜치 $branch 남김." }

  # 4) 머지 게이트 — 회귀 해시 + step 4기둥
  Log "검증 게이트 실행…"
  Push-Location $HwsDir
  try {
    node engine/validate/verify-sim-engine.js
    $regOk = ($LASTEXITCODE -eq 0)
    node "$stepId/verify.js" all
    $verOk = ($LASTEXITCODE -eq 0)
  } finally { Pop-Location }
  if (-not $regOk) { Die "verify-sim-engine FAIL (회귀/골든 드리프트). 브랜치 $branch 남김." }
  if (-not $verOk) { Die "$stepId/verify.js all FAIL (4기둥 미통과). 브랜치 $branch 남김." }

  # 5) 전진 확인
  if (-not (Test-Path (Join-Path $HwsDir "$stepId.md"))) { Die "$stepId.md 가 생성되지 않음. 브랜치 남김." }
  $commitCount = [int](git -C $RepoRoot rev-list --count "main..$branch")
  if ($commitCount -lt 1) { Die "main 대비 커밋이 없음 (claude 가 커밋 안 함). 브랜치 남김." }
  Log "게이트 PASS · 커밋 $commitCount 개 · $stepId.md 생성 확인"

  if ($NoMerge) { Log "-NoMerge: 브랜치 $branch 를 남기고 종료."; break }

  # 6) push → PR → merge → 재동기화
  git -C $RepoRoot push -u origin $branch; if ($LASTEXITCODE -ne 0) { Die "push 실패. 브랜치 남김." }
  $title = "HWS $stepId"
  gh pr create --repo (gh repo view --json nameWithOwner -q .nameWithOwner) `
    --base main --head $branch --title $title --fill
  if ($LASTEXITCODE -ne 0) { Die "gh pr create 실패. 브랜치 남김." }

  $mergeArgs = @($branch, '--squash', '--delete-branch')
  if ($AdminMerge) { $mergeArgs += '--admin' }
  gh pr merge @mergeArgs
  if ($LASTEXITCODE -ne 0) { Die "gh pr merge 실패 (브랜치 보호?). -AdminMerge 검토. 브랜치 남김." }
  Log "$stepId merge 완료."

  git -C $RepoRoot checkout main;               if ($LASTEXITCODE -ne 0) { Die "main 복귀 실패" }
  git -C $RepoRoot pull --ff-only origin main;  if ($LASTEXITCODE -ne 0) { Die "merge 후 main pull 실패" }
}

Log "루프 종료 (요청한 $MaxIterations 회 처리)."

