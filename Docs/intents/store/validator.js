// IntentValidator — window-global, no ESM
// validator.py 와 동일한 검증 로직을 JS 로 구현.
//
// rules 는 site.html 에 삽입된 <script type="application/json" id="validation-rules"> 에서 읽는다.
// 독립적으로 사용할 때는 window.IntentValidator._rules 에 직접 설정해도 된다.
//
// window.IntentValidator = { validate(intents) -> [{id, field, message}] }

const IntentValidator = (() => {
  /**
   * rules.json 을 로드한다.
   * site.html 에서는 <script id="validation-rules"> 태그에서 읽는다.
   */
  function _loadRules() {
    const el = document.getElementById('validation-rules');
    if (el) {
      try { return JSON.parse(el.textContent); } catch (_) { /* pass */ }
    }
    // 폴백: 하드코딩 기본값
    return {
      version: '1',
      id_pattern: '^I-\\d{4}$',
      required_fields: ['id', 'title', 'status'],
      valid_statuses: ['active', 'proposed', 'realized', 'abandoned'],
      max_title_length: 200,
      checks: {
        dag_no_cycle: true,
        parent_child_bidirectional: true,
        refs_exist: true,
      },
    };
  }

  /**
   * Intent 배열을 검증한다.
   *
   * @param {Array} intents  { id, title, status, parents, children, tags, intent, ... }[]
   * @returns {Array}  ValidationError[]  { id, field, message }
   */
  function validate(intents) {
    const rules = _loadRules();
    const errors = [];

    const idPatternRe = new RegExp(rules.id_pattern || '^I-\\d{4}$');
    const requiredFields = rules.required_fields || ['id', 'title', 'status'];
    const validStatuses = new Set(rules.valid_statuses || []);
    const maxTitleLen = rules.max_title_length || 200;
    const checks = rules.checks || {};

    const allIds = new Set(intents.map(it => it.id));

    for (const it of intents) {
      const iid = it.id || '(unknown)';

      // --- required fields ---
      for (const field of requiredFields) {
        const val = it[field];
        if (val === undefined || val === null || String(val).trim() === '') {
          errors.push({ id: iid, field, message: `필수 필드 누락: ${field}` });
        }
      }

      // --- id pattern ---
      if (it.id && !idPatternRe.test(it.id)) {
        errors.push({ id: iid, field: 'id',
          message: `ID 형식 오류 (기대: ${rules.id_pattern}): ${JSON.stringify(it.id)}` });
      }

      // --- status validity ---
      if (validStatuses.size && it.status && !validStatuses.has(it.status)) {
        errors.push({ id: iid, field: 'status',
          message: `유효하지 않은 status: ${JSON.stringify(it.status)}. 허용값: ${[...validStatuses].sort().join(', ')}` });
      }

      // --- title length ---
      if (it.title && it.title.length > maxTitleLen) {
        errors.push({ id: iid, field: 'title',
          message: `title 이 ${maxTitleLen}자를 초과함 (${it.title.length}자)` });
      }

      // --- refs_exist ---
      if (checks.refs_exist) {
        for (const ref of (it.parents || [])) {
          if (!allIds.has(ref)) {
            errors.push({ id: iid, field: 'parents', message: `존재하지 않는 parent ID: ${JSON.stringify(ref)}` });
          }
        }
        for (const ref of (it.children || [])) {
          if (!allIds.has(ref)) {
            errors.push({ id: iid, field: 'children', message: `존재하지 않는 child ID: ${JSON.stringify(ref)}` });
          }
        }
      }
    }

    // --- parent_child_bidirectional ---
    if (checks.parent_child_bidirectional) {
      const intentMap = Object.fromEntries(intents.map(it => [it.id, it]));
      for (const it of intents) {
        for (const childId of (it.children || [])) {
          const child = intentMap[childId];
          if (!child) continue; // refs_exist 에서 이미 잡힘
          if (!(child.parents || []).includes(it.id)) {
            errors.push({ id: it.id, field: 'children',
              message: `${childId} 는 children 에 있지만, ${childId}.parents 에 ${JSON.stringify(it.id)} 가 없음` });
          }
        }
        for (const parentId of (it.parents || [])) {
          const parent = intentMap[parentId];
          if (!parent) continue;
          if (!(parent.children || []).includes(it.id)) {
            errors.push({ id: it.id, field: 'parents',
              message: `${parentId} 는 parents 에 있지만, ${parentId}.children 에 ${JSON.stringify(it.id)} 가 없음` });
          }
        }
      }
    }

    // --- dag_no_cycle (DFS) ---
    if (checks.dag_no_cycle) {
      const intentMap = Object.fromEntries(intents.map(it => [it.id, it]));
      const WHITE = 0, GRAY = 1, BLACK = 2;
      const color = {};
      for (const it of intents) color[it.id] = WHITE;

      function dfs(nodeId) {
        color[nodeId] = GRAY;
        const node = intentMap[nodeId];
        if (node) {
          for (const childId of (node.children || [])) {
            if (!(childId in color)) continue;
            if (color[childId] === GRAY) return true;
            if (color[childId] === WHITE && dfs(childId)) return true;
          }
        }
        color[nodeId] = BLACK;
        return false;
      }

      for (const it of intents) {
        if (color[it.id] === WHITE) {
          if (dfs(it.id)) {
            errors.push({ id: it.id, field: 'children',
              message: `DAG 사이클 감지: ${it.id} 에서 시작하는 순환 참조` });
          }
        }
      }
    }

    return errors;
  }

  return { validate };
})();

window.IntentValidator = IntentValidator;
