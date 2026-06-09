너는 HWS 시리즈의 "다음 step 한 조각"을 진행하는 자율 세션이다.
현재 작업 디렉토리(cwd)는 `HWS/` 이며, 외부 오케스트레이터가 이미 전용 브랜치를 체크아웃해 두었다.

## 절차 (HWS/CLAUDE.md "Step 루프"를 그대로 따른다)

1. **읽기 (필독 3종)**: `CLAUDE.md`(목표·규칙) · `SPINE.md`(존재론 척추) · `STATE.md`(현재 위치·다음 가설). SPINE 척추 체크 4항을 먼저 숙지한다.
2. **계획**: `STATE.md` §2 NEXT 가 지정한 **단 하나의 조각**만 이번 step 으로 정한다. 더 떠올라도 다음 step 으로 전가한다. 번호는 직전 닫힌 step + 1 (예: 0024 닫혔으면 step-0025).
3. **구현 (law-pipeline 표준 0011~)**:
   - `engine/hws-laws.js` 에 **법칙 함수 1개 + DEFAULTS 노브 1개 + LAW_ORDER 한 자리**를 더한다(노브=0 → early-return = 회귀 0).
   - `step-NNNN/verify.js` (직전 step verify 복사 + 새 모드 1개) · `step-NNNN/panel.js` (직전 panel 복사 + 노브 행 1개) · `step-NNNN.html` 셸(~13줄).
   - 동결된 0001~0010 복사 코어와 닫힌 step 문서는 **건드리지 않는다**.
4. **검증 (게이트 — 반드시 통과)**:
   - `node engine/validate/verify-sim-engine.js` → 마지막 줄 `PASS` (golden 해시 불변, 회귀 0).
   - `node step-NNNN/verify.js all` → 마지막 줄 `PASS` (회귀·보존·결정론·가설 4기둥 + 척추 체크).
   - 통과 못 하면 **step 을 닫지 말고 커밋하지 마라**. 원인을 규명해 코드를 고쳐 재검증한다. 끝내 못 닫으면 변경을 되돌리고(`git checkout -- .`) 그 사유를 마지막에 보고하라.
5. **문서·상태 갱신**:
   - `step-NNNN.md` — 도입부 "6요소 지도" 표 + **"## 0. 쉽게 풀어 쓴 설명"(필수)** + 가설·검증 결과·다음 예고. 의외의 발견/정직한 한계의 *전문*은 여기에만.
   - `STATE.md` — 고정 크기 대시보드 규칙: §1~6 은 **덮어쓰기**(누적 금지), §7 INDEX 만 **1행 append**. §1 NOW 포인터 이동·§2 NEXT 가설 교체·§3 OPEN GAPS 마커 갱신·§4 DURABLE CONSTRAINTS 에 이번 step 의 정전 사실만 추가.
   - 이번 step 이 특정 요소를 진화시켰으면 해당 `step-0001/01~06` 요소 문서의 "검증 현황과 수정 이력"도 갱신한다.
6. **커밋**: 변경 전체를 한 커밋으로. 메시지 형식:
   ```
   HWS step-NNNN: <한 줄 제목>

   <2~4줄 요약: 무엇을 더했나 / 가설 수치 / 회귀·잔차·결정론 결과>

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```

## 경계 (반드시 지킬 것)

- **딱 한 조각만.** 한 step 에 법칙 하나. 나머지는 전가한다.
- **git 플러밍 금지.** 브랜치 생성·push·PR·merge 는 오케스트레이터가 한다. 너는 `git add` + `git commit` 까지만.
- **UE5 빌드 절대 금지.** 이 작업은 순수 JS/node 다. `Build.bat` 등 어떤 엔진 빌드도 호출하지 마라.
- 검증 게이트를 통과 못 한 채로 커밋하지 마라 — 게이트 실패 = step 미완.
- 마지막 출력에 한 줄로 결과를 보고하라: `STEP step-NNNN COMMITTED` 또는 `STEP ABORTED: <사유>`.
