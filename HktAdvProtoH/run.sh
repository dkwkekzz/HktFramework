#!/usr/bin/env bash
# HktAdvProtoH 원클릭 실행 (macOS / Linux) — run.bat 과 동일한 동작.
# Cycle 이 확장되어도 이 파일은 그대로 쓴다 — 항상 현재 world/view 를 실행한다.
#
#   ./run.sh              최신 Cycle = 현재 게임 전체
#   ./run.sh C001         C001 까지의 게임만 (이후 Cycle 의 Rule 은 꺼진다)
#   ./run.sh --list       실행 가능한 Cycle 목록
set -euo pipefail
cd "$(dirname "$0")"

usage() {
  cat <<'USAGE'
사용법: ./run.sh [CycleId]

  (인자 없음)   최신 Cycle 까지 = 현재 게임 전체를 실행
  CycleId       그 Cycle 까지의 게임만 실행 (예: C001 또는 C001-stone-mining)
  --list, -l    실행 가능한 Cycle 목록 출력
  --help, -h    이 도움말
USAGE
}

list_cycles() {
  local found=0
  for dir in cycles/*/; do
    [ -d "$dir" ] || continue
    local name id title
    name="$(basename "$dir")"
    id="${name%%-*}"
    title="$(sed -n 's/^# CYCLE [^ ]* — //p' "$dir/01-cycle.md" 2>/dev/null | head -1)"
    printf '  %-6s %s\n' "$id" "${title:-$name}"
    found=1
  done
  [ "$found" = 1 ] || echo "  (cycles/ 에 Cycle 이 없다)"
}

CYCLE=""
case "${1-}" in
  --help|-h) usage; exit 0 ;;
  --list|-l) echo "실행 가능한 Cycle:"; list_cycles; exit 0 ;;
  -*) echo "[오류] 알 수 없는 옵션: $1" >&2; usage >&2; exit 1 ;;
  "") ;;
  *) CYCLE="$1" ;;
esac

# Cycle 지정 시 cycles/ 에 실재하는지 먼저 확인한다 — 브라우저를 띄우기 전에 실패시킨다.
if [ -n "$CYCLE" ]; then
  MATCH=""
  for dir in cycles/*/; do
    [ -d "$dir" ] || continue
    name="$(basename "$dir")"
    if [ "$name" = "$CYCLE" ] || [ "${name%%-*}" = "$CYCLE" ]; then
      MATCH="${name%%-*}"
      break
    fi
  done
  if [ -z "$MATCH" ]; then
    echo "[오류] 알 수 없는 Cycle: $CYCLE" >&2
    echo "실행 가능한 Cycle:" >&2
    list_cycles >&2
    exit 1
  fi
  CYCLE="$MATCH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js 가 필요합니다 — https://nodejs.org 에서 LTS 설치 후 재실행하세요." >&2
  exit 1
fi

echo "[1/2] 의존성 확인/설치 중..."
npm install --no-audit --no-fund

if [ -n "$CYCLE" ]; then
  echo "[2/2] 게임 시작 — $CYCLE 까지의 게임. 종료: Ctrl+C"
  npm run dev -- --open "/?cycle=$CYCLE"
else
  echo "[2/2] 게임 시작 — 최신 Cycle(현재 게임). 종료: Ctrl+C"
  npm run dev -- --open
fi
