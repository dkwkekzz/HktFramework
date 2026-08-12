#!/usr/bin/env bash
# HktAdvProtoH 원클릭 실행 (macOS / Linux) — run.bat 과 동일한 동작.
# Cycle 이 확장되어도 이 파일은 그대로 쓴다 — 항상 현재 world/view 를 실행한다.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js 가 필요합니다 — https://nodejs.org 에서 LTS 설치 후 재실행하세요." >&2
  exit 1
fi

echo "[1/2] 의존성 확인/설치 중..."
npm install --no-audit --no-fund

echo "[2/2] 게임 시작 — 브라우저가 자동으로 열립니다. 종료: Ctrl+C"
npm run dev -- --open
