#!/usr/bin/env sh
# run.bat 과 동일 흐름 (macOS/Linux) — 사용: ./run.sh [봇수=8]
cd "$(dirname "$0")" || exit 1

command -v node >/dev/null || { echo "[오류] Node.js 22+ 필요"; exit 1; }
[ -d node_modules ] || npm install || exit 1

echo "[테스트] 보존 불변식..."
npm test >/dev/null 2>&1 || { echo "[오류] 테스트 실패 — npm test 로 확인"; exit 1; }

node server/index.js &
SERVER_PID=$!
sleep 1
node tools/bots.js "${1:-8}" &
BOTS_PID=$!

echo "시뮬레이션 가동 — 관전: http://localhost:8080/?name=관전자 (Ctrl+C 종료)"
trap 'kill "$SERVER_PID" "$BOTS_PID" 2>/dev/null' INT TERM EXIT
wait
