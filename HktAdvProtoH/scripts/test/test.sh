#!/usr/bin/env bash
# Deterministic 테스트 — 타입체크 + vitest (world / gameview binding / e2e trace)
set -euo pipefail
cd "$(dirname "$0")/../../source"
npx tsc --noEmit
npx vitest run
