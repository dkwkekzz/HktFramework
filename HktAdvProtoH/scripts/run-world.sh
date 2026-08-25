#!/usr/bin/env bash
# HktAdvProtoH — 세계(서버)만 실행 (macOS / Linux) — run-world.bat 과 동일한 동작.
# 세계가 이 터미널에서 자기 시계로 돈다. 접속자가 없어도 계속 돈다.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-5180}"
export PORT

if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js 가 필요합니다 — https://nodejs.org 에서 LTS 설치 후 재실행하세요." >&2
  exit 1
fi

echo "[1/2] 의존성 확인/설치 중..."
npm install --no-audit --no-fund

echo "[2/2] 세계를 시작합니다 — 포트 ${PORT} / 종료: Ctrl+C"
npm run world
