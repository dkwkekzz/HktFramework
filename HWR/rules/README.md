# rules — 규칙 보관소

각 규칙은 `rule_NNNN/` 한 폴더에서 관리한다. 절차·계약은 [hwr-task 스킬](../../.claude/skills/hwr-task/SKILL.md) (`/hwr-task`).

규칙 한 벌의 결과물:

- `rule_NNNN.md` — 설계 문서(온전한 규칙 정의)
- `rule_NNNN.js` — 세계 규칙 코드(뷰어/검증 공용 계약, `export default`)
- `scenario.js` — (선택) 규칙을 확인할 시나리오
- `verify_NNNN.js` — 검증(시나리오가 있으면 필수, `node` 로 돌려 확인)

아직 닫힌 규칙 없음. 첫 규칙은 `rule_0001/`.
