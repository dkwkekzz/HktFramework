#!/usr/bin/env bash
# HktSplatLife 원클릭 실행 — 로컬 정적 서버 + 브라우저 열기
cd "$(dirname "$0")"
PORT=${1:-8200}
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then echo "python3 필요" >&2; exit 1; fi
"$PY" -m http.server "$PORT" &
SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
URL="http://localhost:$PORT/index.html"
if command -v open >/dev/null; then open "$URL"; elif command -v xdg-open >/dev/null; then xdg-open "$URL"; fi
echo "[HktSplatLife] $URL 서비스 중 — Ctrl+C 로 종료"
wait $SRV
