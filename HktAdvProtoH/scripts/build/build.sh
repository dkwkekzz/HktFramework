#!/usr/bin/env bash
# Playable Build — source/ 의 웹 빌드 (tsc 타입체크 + vite build)
set -euo pipefail
cd "$(dirname "$0")/../../source"
npm run build
