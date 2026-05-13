// GitHubStore — window-global, no ESM
// IntentStore 의 GitHub 백엔드 구현체.
//
// IndexedDB 에 config(owner, repo, token, branch)를 저장한다.
// GraphQL createCommitOnBranch 뮤테이션으로 낙관적 잠금 커밋.
//
// window.GitHubStore = GitHubStore

// ──────────────────────────────────────────────
// 내부 유틸리티
// ──────────────────────────────────────────────

/** UTF-8 문자열을 base64 로 인코딩 (한국어 등 멀티바이트 포함) */
function _btoaUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/** base64 를 UTF-8 문자열로 디코딩 (한국어 등 멀티바이트 포함) */
function _atobUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/** IndexedDB 헬퍼 — Promise 래핑 */
function _openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('intentsys', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config');
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function _dbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function _dbPut(db, store, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function _dbDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

// ──────────────────────────────────────────────
// 단순 YAML frontmatter 파서 (우리 포맷 전용)
// ──────────────────────────────────────────────

/**
 * .md 파일 텍스트에서 frontmatter + body 를 파싱한다.
 *
 * 지원 포맷:
 *   ---
 *   key: value
 *   list_key: [a, b, c]
 *   block_list:
 *   - item1
 *   - item2
 *   ---
 *
 *   ## Intent
 *
 *   본문
 */
function _parseMd(text) {
  // frontmatter 분리
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/);
  if (!fmMatch) return { id: '', title: '', status: '', parents: [], children: [], tags: [], goals: [], intent: '', created_at: '', updated_at: '' };

  const fmText = fmMatch[1];
  const body = fmMatch[2] || '';

  // YAML 라인 파서
  const fm = {};
  const lines = fmText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 블록 리스트 항목 (들여쓰기 "- ")
    if (/^\s+-\s/.test(line)) { i++; continue; }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    if (rest === '' || rest === null) {
      // 다음 줄이 블록 리스트인지 확인
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s/.test(lines[j])) {
        items.push(lines[j].replace(/^\s+-\s*/, '').trim());
        j++;
      }
      fm[key] = items;
      i = j;
      continue;
    }

    // 인라인 배열 [a, b, c]
    const arrMatch = rest.match(/^\[([^\]]*)\]$/);
    if (arrMatch) {
      const inner = arrMatch[1].trim();
      fm[key] = inner === '' ? [] : inner.split(',').map(s => s.trim()).filter(Boolean);
      i++;
      continue;
    }

    fm[key] = rest;
    i++;
  }

  // ## Intent 섹션 추출 — JS regex 는 \Z 미지원이라 수동으로 자른다.
  let intentText = '';
  const headerRe = /^##\s+Intent\s*$/m;
  const headerMatch = body.match(headerRe);
  if (headerMatch) {
    const after = body.slice(headerMatch.index + headerMatch[0].length);
    const next = after.search(/^##\s+/m);
    intentText = (next === -1 ? after : after.slice(0, next)).trim();
  }

  return {
    id: fm['id'] || '',
    title: fm['title'] || '',
    status: fm['status'] || '',
    created_at: fm['created_at'] || '',
    updated_at: fm['updated_at'] || '',
    parents: Array.isArray(fm['parents']) ? fm['parents'] : [],
    children: Array.isArray(fm['children']) ? fm['children'] : [],
    tags: Array.isArray(fm['tags']) ? fm['tags'] : [],
    goals: Array.isArray(fm['goals']) ? fm['goals'] : [],
    intent: intentText,
  };
}

/** Intent 객체를 .md 텍스트로 직렬화한다 */
function _serializeIntent(intent) {
  // 현재 시각을 브라우저 로컬 시간대로 표현
  const now = new Date();
  const tzOff = -now.getTimezoneOffset(); // minutes, positive = east
  const sign = tzOff >= 0 ? '+' : '-';
  const absOff = Math.abs(tzOff);
  const tzHH = String(Math.floor(absOff / 60)).padStart(2, '0');
  const tzMM = String(absOff % 60).padStart(2, '0');
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const iso = local.toISOString().slice(0, 19) + `${sign}${tzHH}:${tzMM}`;

  const created = intent.created_at || iso;
  const updated = iso;

  function fmtList(arr) {
    if (!arr || arr.length === 0) return '[]';
    return '[' + arr.join(', ') + ']';
  }

  const lines = [
    '---',
    `id: ${intent.id}`,
    `title: ${intent.title}`,
    `status: ${intent.status}`,
    `created_at: ${created}`,
    `updated_at: ${updated}`,
    `parents: ${fmtList(intent.parents)}`,
    `children: ${fmtList(intent.children)}`,
    `tags: ${fmtList(intent.tags)}`,
  ];
  if (intent.goals && intent.goals.length) lines.push(`goals: ${fmtList(intent.goals)}`);
  lines.push('---');
  const fm = lines.join('\n');

  const body = `\n## Intent\n\n${intent.intent || ''}`;
  return fm + '\n' + body + '\n';
}

// ──────────────────────────────────────────────
// GitHubStore
// ──────────────────────────────────────────────

class GitHubStore extends IntentStore {
  /**
   * @param {Object} cfg
   * @param {string} cfg.owner
   * @param {string} cfg.repo
   * @param {string} [cfg.token]   미설정 시 비인증 읽기 (공개 저장소 한정, 60 req/h IP 제한).
   * @param {string} [cfg.branch]  기본은 호출 측에서 결정. 일반적으로 token 있으면 'intents/draft', 없으면 'main'.
   * @param {string} [cfg.intentsPath='Docs/intents']
   */
  constructor({ owner, repo, token, branch, intentsPath = 'Docs/intents' } = {}) {
    super();
    this.owner = owner;
    this.repo = repo;
    this.token = token || undefined;
    this.branch = branch || (this.token ? 'intents/draft' : 'main');
    this.intentsPath = intentsPath;
    this._headSha = null;
    this._branchEnsured = false;  // 쓰기 전 _ensureHead 가 실제로 브랜치 존재를 검증/생성했는가
    this._etag = null;
  }

  // ── Config (IndexedDB) ──────────────────────

  /** IndexedDB 에서 GitHub 설정을 읽는다. @returns {Promise<Object|null>} */
  static async loadConfig() {
    const db = await _openDb();
    return _dbGet(db, 'config', 'github');
  }

  /** IndexedDB 에 GitHub 설정을 저장한다. */
  static async saveConfig(cfg) {
    const db = await _openDb();
    return _dbPut(db, 'config', 'github', cfg);
  }

  /** IndexedDB 에서 GitHub 설정을 삭제한다. */
  static async clearConfig() {
    const db = await _openDb();
    return _dbDelete(db, 'config', 'github');
  }

  // ── 내부 헬퍼 ──────────────────────────────

  /** GitHub REST API 기본 헤더. 토큰이 없으면 Authorization 생략(공개 저장소 비인증 읽기 허용). */
  _headers() {
    const h = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  /** 쓰기 작업 전 토큰 보유 확인. */
  _requireToken() {
    if (!this.token) throw new Error('쓰기 작업에는 GitHub 토큰이 필요합니다. ⚙ 설정에서 PAT를 입력하세요.');
  }

  /** GitHub REST API base URL */
  _api(path) {
    return `https://api.github.com${path}`;
  }

  /**
   * 브랜치 HEAD SHA 를 취득한다.
   * 브랜치가 없으면 main 에서 생성한다.
   */
  async _ensureHead() {
    if (this._branchEnsured) return;
    const headers = this._headers();
    // 모바일 브라우저(특히 iOS Safari) 는 GitHub API 의 Cache-Control: private, max-age=60
    // 응답을 디스크 캐시에 저장해 stale HEAD SHA 를 돌려준다. 브랜치 기반 조회는 가변값이므로
    // 항상 네트워크로 우회 (no-store) — content-addressable 한 git/blobs, git/trees 는 그대로 둔다.
    const url = this._api(`/repos/${this.owner}/${this.repo}/commits?sha=${encodeURIComponent(this.branch)}&per_page=1`);
    let resp = await fetch(url, { headers, cache: 'no-store' });

    if (resp.status === 404 || resp.status === 422) {
      // main HEAD 취득
      const mainResp = await fetch(
        this._api(`/repos/${this.owner}/${this.repo}/commits?sha=main&per_page=1`),
        { headers, cache: 'no-store' }
      );
      if (!mainResp.ok) throw new Error(`main HEAD 취득 실패: ${mainResp.status}`);
      const mainCommits = await mainResp.json();
      const mainSha = mainCommits[0].sha;

      // 브랜치 생성
      const createResp = await fetch(
        this._api(`/repos/${this.owner}/${this.repo}/git/refs`),
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: `refs/heads/${this.branch}`, sha: mainSha }),
        }
      );
      if (!createResp.ok) {
        const err = await createResp.json().catch(() => ({}));
        if (createResp.status === 403) {
          throw new Error(
            `브랜치 생성 권한 부족 (403). PAT 권한을 Contents: Read and write 로 갱신하거나, ` +
            `GitHub 웹에서 main 으로부터 '${this.branch}' 브랜치를 미리 만들어 주세요.`
          );
        }
        throw new Error(`브랜치 생성 실패: ${createResp.status} ${err.message || ''}`);
      }
      this._headSha = mainSha;
      this._branchEnsured = true;
      return;
    }

    if (!resp.ok) throw new Error(`브랜치 commits 취득 실패: ${resp.status}`);
    const commits = await resp.json();
    this._headSha = commits[0].sha;
    this._branchEnsured = true;
  }

  // ── CRUD ───────────────────────────────────

  /**
   * 모든 Intent 목록을 GitHub 에서 읽는다.
   *
   * 구조: 1 + 1 + N 회 호출
   *   1) commits ?sha=branch&per_page=1 — HEAD commit + tree SHA
   *   2) git/trees/{treeSha}?recursive=1 — 전체 파일 목록 (1 호출, 깊은 트리 포함)
   *   N) git/blobs/{blobSha}            — 각 Intent .md (Promise.all 병렬)
   *
   * 브랜치 미존재(404) 시 빈 배열 반환 — 자동 생성하지 않는다 (읽기 전용 의도 보존).
   * 첫 쓰기에서 _ensureHead 가 main 으로부터 브랜치를 만든다.
   *
   * @returns {Promise<Array>}
   */
  async list() {
    const headers = this._headers();

    // 1) HEAD commit SHA 와 tree SHA
    //    설정 브랜치(예: intents/draft) 가 아직 없으면 main 에서 읽는다.
    //    쓰기 시 _ensureHead 가 main 으로부터 설정 브랜치를 만든다.
    let readBranch = this.branch;
    let commitsResp = await fetch(
      this._api(`/repos/${this.owner}/${this.repo}/commits?sha=${encodeURIComponent(readBranch)}&per_page=1`),
      { headers, cache: 'no-store' }
    );
    if (commitsResp.status === 404 && readBranch !== 'main') {
      readBranch = 'main';
      commitsResp = await fetch(
        this._api(`/repos/${this.owner}/${this.repo}/commits?sha=main&per_page=1`),
        { headers, cache: 'no-store' }
      );
    }
    if (commitsResp.status === 404) {
      // main 도 없으면 정말 빈 결과.
      return [];
    }
    if (!commitsResp.ok) throw new Error(`commits 가져오기 실패: ${commitsResp.status}`);
    const commits = await commitsResp.json();
    if (!Array.isArray(commits) || !commits.length) return [];
    this._headSha = commits[0].sha;
    const treeSha = commits[0].commit && commits[0].commit.tree && commits[0].commit.tree.sha;
    if (!treeSha) throw new Error('commit 응답에 tree SHA 없음');

    // 2) 재귀 트리
    const treeResp = await fetch(
      this._api(`/repos/${this.owner}/${this.repo}/git/trees/${treeSha}?recursive=1`),
      { headers }
    );
    if (!treeResp.ok) throw new Error(`tree 가져오기 실패: ${treeResp.status}`);
    const treeData = await treeResp.json();

    // 3) Intent 파일만 필터링 (intentsPath 직속, I-NNNN.md 형식, 깊이 1)
    const prefix = `${this.intentsPath}/`;
    const intentEntries = (treeData.tree || []).filter(t =>
      t && t.type === 'blob' &&
      typeof t.path === 'string' &&
      t.path.startsWith(prefix) &&
      /^I-\d{4}\.md$/.test(t.path.slice(prefix.length))
    );

    // 4) 각 blob 병렬 페치 (base64). branch 명에 슬래시(`intents/draft`) 가 있어도
    //    SHA 기반 git/blobs API 는 ref 모호성이 없다.
    const fetches = intentEntries.map(async entry => {
      const blobResp = await fetch(
        this._api(`/repos/${this.owner}/${this.repo}/git/blobs/${entry.sha}`),
        { headers }
      );
      if (!blobResp.ok) return null;
      const blobData = await blobResp.json();
      const text = _atobUtf8((blobData.content || '').replace(/\n/g, ''));
      const parsed = _parseMd(text);
      return { ...parsed, baseVersion: this._headSha };
    });

    const intents = (await Promise.all(fetches)).filter(Boolean);
    intents.sort((a, b) => a.id.localeCompare(b.id));
    return intents;
  }

  /**
   * 특정 ID 의 Intent 를 읽는다.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async get(id) {
    await this._ensureHead();
    const path = `${this.intentsPath}/${id}.md`;
    const resp = await fetch(
      this._api(`/repos/${this.owner}/${this.repo}/contents/${path}?ref=${encodeURIComponent(this.branch)}`),
      { headers: this._headers(), cache: 'no-store' }
    );
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`get(${id}) 실패: ${resp.status}`);
    const data = await resp.json();
    const content = _atobUtf8(data.content.replace(/\n/g, ''));
    const parsed = _parseMd(content);
    return { ...parsed, baseVersion: this._headSha };
  }

  /**
   * 새 Intent 를 생성한다. input 에는 id 필드가 없어야 한다.
   * @param {Object} input  { title, status, intent, parents, children, tags }
   * @returns {Promise<Object>} 생성된 Intent (id, baseVersion 포함)
   */
  async create(input) {
    this._requireToken();
    const existing = await this.list();
    const nums = existing
      .map(it => {
        const m = it.id.match(/^I-(\d{4})$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    const id = `I-${String(next).padStart(4, '0')}`;

    const intent = { ...input, id };
    const additions = [{
      path: `${this.intentsPath}/${id}.md`,
      contents: _btoaUtf8(_serializeIntent(intent)),
    }];

    // 양방향 일관성 — 부모의 children 과 자식의 parents 에 자기 자신을 미러링.
    const byId = Object.fromEntries(existing.map(it => [it.id, it]));
    for (const pid of intent.parents || []) {
      const parent = byId[pid];
      if (!parent || (parent.children || []).includes(id)) continue;
      const updated = { ...parent, children: [...(parent.children || []), id] };
      additions.push({
        path: `${this.intentsPath}/${pid}.md`,
        contents: _btoaUtf8(_serializeIntent(updated)),
      });
    }
    for (const cid of intent.children || []) {
      const child = byId[cid];
      if (!child || (child.parents || []).includes(id)) continue;
      const updated = { ...child, parents: [...(child.parents || []), id] };
      additions.push({
        path: `${this.intentsPath}/${cid}.md`,
        contents: _btoaUtf8(_serializeIntent(updated)),
      });
    }

    const newOid = await this._graphqlCommit({
      headline: `intent: ${id} 추가 — ${intent.title}`,
      additions,
      deletions: [],
    });

    this._headSha = newOid;
    return { ...intent, baseVersion: newOid };
  }

  /**
   * 기존 Intent 를 갱신한다.
   * @param {string} id
   * @param {Object} patch
   * @param {string} baseVersion  낙관적 잠금 버전 토큰
   * @returns {Promise<Object>}
   * @throws {StaleError}
   */
  async update(id, patch, baseVersion) {
    this._requireToken();
    const all = await this.list();
    const byId = Object.fromEntries(all.map(it => [it.id, it]));
    const current = byId[id];
    if (!current) throw new Error(`Intent ${id} 를 찾을 수 없음`);

    const merged = { ...current, ...patch, id };
    const additions = [{
      path: `${this.intentsPath}/${id}.md`,
      contents: _btoaUtf8(_serializeIntent(merged)),
    }];

    // 부모/자식 관계의 추가·제거를 affected 다른 intent .md 에도 미러링.
    const oldParents = new Set(current.parents || []);
    const newParents = new Set(merged.parents || []);
    const oldChildren = new Set(current.children || []);
    const newChildren = new Set(merged.children || []);
    const touched = new Set();
    function pushAddition(intent) {
      if (touched.has(intent.id)) return;
      touched.add(intent.id);
      additions.push({
        path: `${this.intentsPath}/${intent.id}.md`,
        contents: _btoaUtf8(_serializeIntent(intent)),
      });
    }
    const pushAdd = pushAddition.bind(this);

    // parents 추가됨 → 그 부모의 children 에 id 추가
    for (const pid of newParents) {
      if (oldParents.has(pid)) continue;
      const parent = byId[pid]; if (!parent) continue;
      if ((parent.children || []).includes(id)) continue;
      pushAdd({ ...parent, children: [...(parent.children || []), id] });
    }
    // parents 제거됨 → 그 부모의 children 에서 id 제거
    for (const pid of oldParents) {
      if (newParents.has(pid)) continue;
      const parent = byId[pid]; if (!parent) continue;
      pushAdd({ ...parent, children: (parent.children || []).filter(c => c !== id) });
    }
    // children 추가됨 → 그 자식의 parents 에 id 추가
    for (const cid of newChildren) {
      if (oldChildren.has(cid)) continue;
      const child = byId[cid]; if (!child) continue;
      if ((child.parents || []).includes(id)) continue;
      pushAdd({ ...child, parents: [...(child.parents || []), id] });
    }
    // children 제거됨 → 그 자식의 parents 에서 id 제거
    for (const cid of oldChildren) {
      if (newChildren.has(cid)) continue;
      const child = byId[cid]; if (!child) continue;
      pushAdd({ ...child, parents: (child.parents || []).filter(p => p !== id) });
    }

    const newOid = await this._graphqlCommit({
      headline: `intent: ${id} 수정 — ${merged.title}`,
      additions,
      deletions: [],
      expectedHeadOid: baseVersion,
    });

    this._headSha = newOid;
    return { ...merged, baseVersion: newOid };
  }

  /**
   * Intent 를 삭제한다.
   * @param {string} id
   * @param {string} baseVersion
   * @returns {Promise<void>}
   * @throws {StaleError}
   */
  async remove(id, baseVersion) {
    this._requireToken();
    const all = await this.list();
    const byId = Object.fromEntries(all.map(it => [it.id, it]));
    const current = byId[id];

    const additions = [];
    if (current) {
      // 부모의 children 에서 id 제거, 자식의 parents 에서 id 제거.
      for (const pid of current.parents || []) {
        const parent = byId[pid]; if (!parent) continue;
        const updated = { ...parent, children: (parent.children || []).filter(c => c !== id) };
        additions.push({
          path: `${this.intentsPath}/${pid}.md`,
          contents: _btoaUtf8(_serializeIntent(updated)),
        });
      }
      for (const cid of current.children || []) {
        const child = byId[cid]; if (!child) continue;
        const updated = { ...child, parents: (child.parents || []).filter(p => p !== id) };
        additions.push({
          path: `${this.intentsPath}/${cid}.md`,
          contents: _btoaUtf8(_serializeIntent(updated)),
        });
      }
    }

    const newOid = await this._graphqlCommit({
      headline: `intent: ${id} 삭제`,
      additions,
      deletions: [{ path: `${this.intentsPath}/${id}.md` }],
      expectedHeadOid: baseVersion,
    });

    this._headSha = newOid;
  }

  /**
   * 변경 이벤트를 폴링으로 구독한다. (8초 간격, ETag)
   * @param {Function} onChange  ({ type, id, occurredAt }) 콜백
   * @returns {Function} unsubscribe 함수
   */
  subscribe(onChange) {
    let etag = null;
    let active = true;
    // subscribe 호출 시점의 HEAD SHA — 첫 폴링 전 외부 변경 감지에 사용
    const knownSha = this._headSha;

    const poll = async () => {
      if (!active) return;
      try {
        const url = this._api(
          `/repos/${this.owner}/${this.repo}/commits?sha=${encodeURIComponent(this.branch)}&path=${encodeURIComponent(this.intentsPath)}&per_page=1`
        );
        const reqHeaders = { ...this._headers() };
        if (etag) reqHeaders['If-None-Match'] = etag;

        const resp = await fetch(url, { headers: reqHeaders, cache: 'no-store' });

        if (resp.status === 404) {
          // 브랜치 부재 — 폴링 영구 비활성화 (첫 저장 시 브랜치가 생성되면 그때 다시 시작).
          active = false;
          return;
        } else if (resp.status === 304) {
          // 변경 없음
        } else if (resp.ok) {
          const newEtag = resp.headers.get('ETag');
          const commits = await resp.json();
          const latestSha = commits[0]?.sha;
          const occurredAt = commits[0]?.commit?.author?.date || new Date().toISOString();

          if (etag === null) {
            // 첫 번째 폴링: subscribe 이후 외부 변경이 있었는지 SHA로 감지
            if (knownSha && latestSha && latestSha !== knownSha) {
              onChange({ type: 'update', id: null, occurredAt });
            }
          } else if (newEtag !== etag) {
            // 이후 폴링: ETag 변경으로 감지
            onChange({ type: 'update', id: null, occurredAt });
          }

          if (newEtag) etag = newEtag;
        }
      } catch (e) {
        // 폴링 실패 무시 (네트워크 오류 등)
        console.warn('GitHubStore.subscribe poll error:', e);
      }

      if (active) setTimeout(poll, 8000);
    };

    setTimeout(poll, 8000);

    return () => { active = false; };
  }

  // ── GraphQL ─────────────────────────────────

  /**
   * createCommitOnBranch GraphQL 뮤테이션으로 파일을 커밋한다.
   *
   * @param {Object} opts
   * @param {string} opts.headline  커밋 메시지 제목
   * @param {Array}  opts.additions  [{path, contents}]  contents = base64
   * @param {Array}  opts.deletions  [{path}]
   * @param {string} [opts.expectedHeadOid]  낙관적 잠금 OID
   * @returns {Promise<string>} 새 커밋 OID
   * @throws {StaleError} expectedHeadOid 불일치 시
   */
  async _graphqlCommit({ headline, additions = [], deletions = [], expectedHeadOid } = {}) {
    // 쓰기 시 매번 브랜치 존재를 보장 — 없으면 main 에서 생성. _branchEnsured 가 캐시.
    await this._ensureHead();

    const oid = expectedHeadOid !== undefined ? expectedHeadOid : this._headSha;

    const mutation = `
      mutation CreateCommit($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit { oid }
        }
      }
    `;

    const variables = {
      input: {
        branch: {
          repositoryNameWithOwner: `${this.owner}/${this.repo}`,
          branchName: this.branch,
        },
        message: { headline },
        fileChanges: { additions, deletions },
        expectedHeadOid: oid,
      },
    };

    const resp = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...this._headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!resp.ok) throw new Error(`GraphQL 요청 실패: ${resp.status}`);

    const result = await resp.json();

    if (result.errors && result.errors.length > 0) {
      // STALE 에러 감지
      const staleErr = result.errors.find(e =>
        (e.extensions && e.extensions.code === 'STALE') ||
        (e.message && e.message.toLowerCase().includes('stale'))
      );
      if (staleErr) {
        throw new StaleError(`STALE: ${staleErr.message}`);
      }
      throw new Error(`GraphQL 오류: ${result.errors.map(e => e.message).join('; ')}`);
    }

    const newOid = result.data?.createCommitOnBranch?.commit?.oid;
    if (!newOid) throw new Error('GraphQL 응답에 commit OID 없음');

    return newOid;
  }

  // ── PR 생성 ─────────────────────────────────

  /**
   * intents/draft → main PR 을 생성한다.
   * @param {string} title
   * @param {string} [body]
   * @returns {Promise<string>} PR URL
   */
  async createPR(title, body = '') {
    this._requireToken();
    const resp = await fetch(
      this._api(`/repos/${this.owner}/${this.repo}/pulls`),
      {
        method: 'POST',
        headers: { ...this._headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          head: this.branch,
          base: 'main',
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`PR 생성 실패: ${resp.status} ${err.message || ''}`);
    }

    const data = await resp.json();
    return data.html_url;
  }
}

// window 전역 노출
window.GitHubStore = GitHubStore;
