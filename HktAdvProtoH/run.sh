#!/usr/bin/env bash
# HktAdvProtoH 원클릭 실행 (macOS / Linux) — 세계 + 클라이언트를 한 프로세스에서.
# run.bat 과 동일한 동작.
#
# 세계와 클라이언트를 따로 띄우려면:
#   ./run-world.sh    세계만
#   ./run-client.sh   클라이언트만
#   ./run-split.sh    둘을 각각 다른 프로세스로 한 번에
#
# Cycle 이 확장되어도 이 파일은 그대로 쓴다 — 항상 현재 world/view 를 실행한다.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js 가 필요합니다 — https://nodejs.org 에서 LTS 설치 후 재실행하세요." >&2
  exit 1
fi

echo "[1/2] 의존성 확인/설치 중..."
npm install --no-audit --no-fund

echo "[2/2] 게임 시작 — 세계와 클라이언트가 한 프로세스에서 돕니다. 종료: Ctrl+C"
npm run dev -- --open
