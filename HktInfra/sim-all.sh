#!/usr/bin/env sh
# ============================================================================
# HktInfra 원클릭 전(全) 서버 시뮬레이션 — sim-all.bat 의 macOS/Linux/CI 판.
#   한 번의 실행으로 모든 서버(엣지·월드·서비스·버스·코디네이션·데이터)를
#   headless 로 띄워 시뮬레이션하고 검증한다.
#
#   [1/3] node run.js        — 현재 step 전 서버 검증 (verify all · 실 멀티프로세스)
#   [2/3] node run.js spine  — 전 역사 불변 회귀 (모든 박스/서버 누적 회귀)
#   [3/3] node run.js report — 실 멀티프로세스 녹화 → report.html
#
#   사용:  ./sim-all.sh          (전 서버 시뮬 + 검증 + report.html 생성)
#          ./sim-all.sh live     (node run.js live — http://localhost:8080 상주)
# ============================================================================
cd "$(dirname "$0")" || exit 1

command -v node >/dev/null || { echo "[오류] Node.js 22+ 필요 — https://nodejs.org"; exit 1; }

# ── live 모드: 실시간 모니터 서버 상주 (선택) ──────────────────────────────
if [ "$1" = "live" ]; then
  echo "[live] 실시간 모니터 서버 기동 — http://localhost:8080 (Ctrl+C 종료)"
  exec node run.js live
fi

echo "[1/3] 현재 step 전(全) 서버 시뮬 검증 (verify all · 실 멀티프로세스)..."
node run.js        || { echo "[오류] verify 실패 — 위 출력 확인"; exit 1; }

echo ""
echo "[2/3] 전 역사 불변 회귀 (spine · 모든 박스/서버)..."
node run.js spine  || { echo "[오류] spine 회귀 실패 — 위 출력 확인"; exit 1; }

echo ""
echo "[3/3] 실 멀티프로세스 녹화 → report.html ..."
node run.js report || { echo "[오류] report 생성 실패 — 위 출력 확인"; exit 1; }

echo ""
echo "============================================================================"
echo " 전 서버 시뮬레이션 완료 — 모든 검증 통과."
echo " 타임라인 리포트: $(pwd)/report.html"
echo "============================================================================"

# 데스크톱 환경이면 리포트를 자동으로 연다 (헤드리스/CI 면 조용히 넘어감).
if command -v xdg-open >/dev/null 2>&1; then xdg-open report.html >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then open report.html >/dev/null 2>&1 &
fi
