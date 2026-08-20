#!/usr/bin/env bash
# FX Lab 원클릭 실행 — 프로젝트 루트를 정적 서빙하고 랩 페이지를 연다.
# 루트를 서빙하는 이유: 랩은 스플랫 런타임을 ../../engine/view-kernel/fx/splat/ 에서 읽는다.
cd "$(dirname "$0")/../.."
PORT=${1:-8200}
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then echo "python3 필요" >&2; exit 1; fi
"$PY" -m http.server "$PORT" &
SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
URL="http://localhost:$PORT/tools/fx-lab/index.html"
if command -v open >/dev/null; then open "$URL"; elif command -v xdg-open >/dev/null; then xdg-open "$URL"; fi
echo "[FX Lab] $URL 서비스 중 — Ctrl+C 로 종료"
wait $SRV
