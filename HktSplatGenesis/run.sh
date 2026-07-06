#!/usr/bin/env bash
# HktSplatGenesis 원클릭 실행 (macOS/Linux) — 로컬 정적 서버 + 브라우저 열기
cd "$(dirname "$0")"
PORT=8123

PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then
	echo "[HktSplatGenesis] python3 이 필요합니다." >&2
	exit 1
fi

# tools/serve.py: Range 지원 정적 서버 — .rad LoD 스트리밍 필수 (S4)
"$PY" tools/serve.py "$PORT" &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
sleep 1

URL="http://localhost:$PORT/editor.html"
if command -v open >/dev/null; then open "$URL"; # macOS
elif command -v xdg-open >/dev/null; then xdg-open "$URL"; fi

echo "[HktSplatGenesis] $URL 서비스 중 — Ctrl+C 로 종료"
wait $SERVER_PID
