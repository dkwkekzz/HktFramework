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
  const fmMatch = text.match(/\A?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/);
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

  // ## Intent 섹션 추출
  const intentMatch = body.match(/^##\s+Intent\s*\r?\n([\s\S]*?)(?=^##\s+|\Z)/m);
  const intentText = intentMatch ? intentMatch[1].trim() : '';

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
  // 현재 시각을 +09:00 오프셋으로 표현
  const now = new Date();
  const offsetMs = -now.getTimezoneOffset() * 60000;
  const local = new Date(now.getTime() + offsetMs);
  const iso = local.toISOString().replace('Z', '+09:00');

  const created = intent.created_at || iso;
  const updated = iso;

  function fmtList(arr) {
    if (!arr || arr.length === 0) return '[]';
    return '[' + arr.join(', ') + ']';
  }

  const fm = [
    '---',
    `id: ${intent.id}`,
    `title: ${intent.title}`,
    `status: ${intent.status}`,
    `created_at: ${created}`,
    `updated_at: ${updated}`,
    `parents: ${fmtList(intent.parents)}`,
    `children: ${fmtList(intent.children)}`,
    `tags: ${fmtList(intent.tags)}`,
    '---',
  ].join('\n');

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
   * @param {string} cfg.token
   * @param {string} [cfg.branch='intents/draft']
   * @param {string} [cfg.intentsPath='Docs/intents']
   */
  constructor({ owner, repo, token, branch = 'intents/draft', intentsPath = 'Docs/intents' } = {}) {
    super();
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.branch = branch;
    this.intentsPath = intentsPath;
    this._headSha = null;
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

  /** GitHub REST API 기본 헤더 */
  _headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
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
    const headers = this._headers();
    const url = this._api(`/repos/${this.owner}/${this.repo}/commits?sha=${encodeURIComponent(this.branch)}&per_page=1`);
    let resp = await fetch(url, { headers });

    if (resp.status === 404 || resp.status === 422) {
      // main HEAD 취득
      const mainResp = await fetch(
        this._api(`/repos/${this.owner}/${this.repo}/commits?sha=main&per_page=1`),
        { headers }
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
        throw new Error(`브랜치 생성 실패: ${createResp.status} ${err.message || ''}`);
      }
      this._headSha = mainSha;
      return;
    }

    if (!resp.ok) throw new Error(`브랜치 commits 취득 실패: ${resp.status}`);
    const commits = await resp.json();
    this._headSha = commits[0].sha;
  }

  // ── CRUD ───────────────────────────────────

  /**
   * 모든 Intent 목록을 GitHub 에서 읽는다.
   * @returns {Promise<Array>}
   */
  async list() {
    await this._ensureHead();
    const headers = this._headers();

    // 디렉토리 목록
    const dirResp = await fetch(
      this._api(`/repos/${this.owner}/${this.repo}/contents/${this.intentsPath}?ref=${encodeURIComponent(this.branch)}`),
      { headers }
    );
    if (!dirResp.ok) throw new Error(`디렉토리 목록 취득 실패: ${dirResp.status}`);
    const entries = await dirResp.json();

    const mdFiles = Array.isArray(entries)
      ? entries.filter(e => /^I-\d{4}\.md$/.test(e.name))
      : [];

    const intents = [];
    for (const entry of mdFiles) {
      const fileResp = await fetch(
        this._api(`/repos/${this.owner}/${this.repo}/contents/${entry.path}?ref=${encodeURIComponent(this.branch)}`),
        { headers }
      );
      if (!fileResp.ok) continue;
      const fileData = await fileResp.json();
      const content = atob(fileData.content.replace(/\n/g, ''));
      const parsed = _parseMd(content);
      intents.push({ ...parsed, baseVersion: this._headSha });
    }

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
      { headers: this._headers() }
    );
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`get(${id}) 실패: ${resp.status}`);
    const data = await resp.json();
    const content = atob(data.content.replace(/\n/g, ''));
    const parsed = _parseMd(content);
    return { ...parsed, baseVersion: this._headSha };
  }

  /**
   * 새 Intent 를 생성한다. input 에는 id 필드가 없어야 한다.
   * @param {Object} input  { title, status, intent, parents, children, tags }
   * @returns {Promise<Object>} 생성된 Intent (id, baseVersion 포함)
   */
  async create(input) {
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
    const content = _serializeIntent(intent);
    const path = `${this.intentsPath}/${id}.md`;

    const newOid = await this._graphqlCommit({
      headline: `intent: ${id} 추가 — ${intent.title}`,
      additions: [{ path, contents: _btoaUtf8(content) }],
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
    const current = await this.get(id);
    if (!current) throw new Error(`Intent ${id} 를 찾을 수 없음`);

    const merged = { ...current, ...patch, id };
    const content = _serializeIntent(merged);
    const path = `${this.intentsPath}/${id}.md`;

    let newOid;
    try {
      newOid = await this._graphqlCommit({
        headline: `intent: ${id} 수정 — ${merged.title}`,
        additions: [{ path, contents: _btoaUtf8(content) }],
        deletions: [],
        expectedHeadOid: baseVersion,
      });
    } catch (e) {
      if (e.name === 'StaleError') throw e;
      throw e;
    }

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
    const path = `${this.intentsPath}/${id}.md`;

    const newOid = await this._graphqlCommit({
      headline: `intent: ${id} 삭제`,
      additions: [],
      deletions: [{ path }],
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

    const poll = async () => {
      if (!active) return;
      try {
        const url = this._api(
          `/repos/${this.owner}/${this.repo}/commits?sha=${encodeURIComponent(this.branch)}&path=${encodeURIComponent(this.intentsPath)}&per_page=1`
        );
        const reqHeaders = { ...this._headers() };
        if (etag) reqHeaders['If-None-Match'] = etag;

        const resp = await fetch(url, { headers: reqHeaders });

        if (resp.status === 304) {
          // 변경 없음
        } else if (resp.ok) {
          const newEtag = resp.headers.get('ETag');
          if (etag !== null && newEtag !== etag) {
            const commits = await resp.json();
            const occurredAt = commits[0]?.commit?.author?.date || new Date().toISOString();
            onChange({ type: 'update', id: null, occurredAt });
          } else {
            // 첫 번째 폴링: etag 초기화만
            await resp.json(); // body 소비
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
    if (this._headSha === null) await this._ensureHead();

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
