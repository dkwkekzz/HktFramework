#!/usr/bin/env bash
# HktAdvProtoH — 세계와 클라이언트를 각각 다른 프로세스로 실행 (macOS / Linux).
# run-split.bat 과 동일한 동작이며, 두 로그가 이 터미널에 함께 찍힌다.
# Ctrl+C 한 번으로 둘 다 멈춘다.
set -euo pipefail
cd "$(dirname "$0")"

export PORT="${PORT:-5180}"
export HKT_WORLD_URL="${HKT_WORLD_URL:-http://127.0.0.1:${PORT}}"

if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js 가 필요합니다 — https://nodejs.org 에서 LTS 설치 후 재실행하세요." >&2
  exit 1
fi

echo "의존성 확인/설치 중... (두 프로세스가 동시에 설치하지 않도록 먼저 끝낸다)"
npm install --no-audit --no-fund

world_pid=""
client_pid=""
cleanup() {
  trap - INT TERM EXIT
  [ -n "$world_pid" ] && kill "$world_pid" 2>/dev/null || true
  [ -n "$client_pid" ] && kill "$client_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[세계] 시작 — 포트 ${PORT}"
npm run world & world_pid=$!

sleep 2   # 세계가 포트를 잡을 시간 (없어도 클라이언트가 알아서 다시 잇는다)

echo "[클라이언트] 시작 — 붙을 세계: ${HKT_WORLD_URL}"
npm run client -- --open & client_pid=$!

echo
echo "둘 다 실행 중입니다. 종료: Ctrl+C"
wait
