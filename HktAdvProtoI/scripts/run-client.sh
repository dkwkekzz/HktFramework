#!/usr/bin/env bash
# HktAdvProtoI — 클라이언트만 실행 (macOS / Linux) — run-client.bat 과 동일한 동작.
# 이 터미널에는 세계가 없다. run-world.sh 로 세계를 먼저 띄워 두면 붙는다.
# 세계가 아직 없어도 뜬다 — "세계에 잇는 중…" 상태로 기다리다 스스로 이어진다.
#
# 다른 PC 의 세계에 붙으려면:  HKT_WORLD_URL=http://192.168.0.10:5180 ./run-client.sh
set -euo pipefail
cd "$(dirname "$0")/.."

HKT_WORLD_URL="${HKT_WORLD_URL:-http://127.0.0.1:5180}"
export HKT_WORLD_URL

if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js 가 필요합니다 — https://nodejs.org 에서 LTS 설치 후 재실행하세요." >&2
  exit 1
fi

echo "[1/2] 의존성 확인/설치 중..."
npm install --no-audit --no-fund

echo "[2/2] 클라이언트를 시작합니다 — 붙을 세계: ${HKT_WORLD_URL} / 종료: Ctrl+C"
npm run client -- --open
