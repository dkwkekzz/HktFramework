#!/usr/bin/env bash
# 모션 시트 정적 분석 (macOS / Linux) — scan-motions.bat 과 동일한 동작.
#
# motions/ 안의 시트를 훑어 프레임이 실제로 놓인 자리를 찾아내고
# view/motion/motion-atlas.generated.ts 를 다시 만든다.
#
# 평소에는 실행할 필요가 없다 — ./run.sh 로 게임을 띄우면 개발 서버가 시작할 때,
# 그리고 motions/ 가 바뀔 때마다 알아서 돌린다.
# 시트를 새로 넣거나 갈아 끼운 뒤 결과를 눈으로 확인하고 싶을 때 쓴다.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js 가 필요합니다 — https://nodejs.org 에서 LTS 설치 후 재실행하세요." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[준비] 의존성 설치 중..."
  npm install --no-audit --no-fund
fi

npm run motions:scan
