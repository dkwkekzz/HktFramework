// Concept Map — 개념(명사) ↔ Capability(동사) 의 이분 그래프 한 장.
//
// 왼쪽이 개념, 오른쪽이 그 개념을 조합에 쓰는 Capability 다. 선 하나 = "조합에 쓴다".
// 실체 없는 개념은 붉게, Capability 는 Overlay 색으로 선다. 아래에는 아직 개념 조합이
// 기재되지 않은 Capability 가 도메인 미기재 작업 목록으로 나열된다 — 채움의 단위는
// 도메인이고, 그 진행이 이 판에서 관찰된다.
//
// viewer.css 의 토큰을 그대로 쓴다 — 같은 디자인 시스템의 한 장이다. 읽기 전용 생성물.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MasterGraph } from './model';
import type { ConceptRegistry } from './concepts';

const here = dirname(fileURLToPath(import.meta.url));

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface MapData {
  status: string;
  domain: string;
  concepts: Array<{
    id: string;
    name: string;
    definition: string;
    semantic: string;
    anchored: boolean;
    anchors: Array<{ ref: string; found: boolean }>;
    usedBy: string[];
  }>;
  capabilities: Array<{ id: string; overlay: string; semantic: string; uses: string[]; note: string }>;
  relations: Array<{ from: string; kind: string; to: string; note: string; evidence: string; evidenceFound: boolean }>;
  uncomposed: Array<{ id: string; overlay: string }>;
}

function buildData(graph: MasterGraph, registry: ConceptRegistry): MapData {
  const composed = new Set(registry.compositions.map((m) => m.capability));
  const capabilities = registry.compositions.map((m) => {
    const n = graph.nodes.get(m.capability);
    return {
      id: m.capability,
      overlay: n?.overlay ?? '?',
      semantic: (typeof n?.raw['semantic'] === 'string' ? (n.raw['semantic'] as string) : '').trim(),
      uses: m.uses,
      note: m.note,
    };
  });
  const uncomposed = [...graph.nodes.values()]
    .filter((n) => n.type === 'capability' && !composed.has(n.id))
    .map((n) => ({ id: n.id, overlay: n.overlay ?? '?' }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    status: registry.status,
    domain: registry.domain,
    concepts: registry.concepts.map((c) => ({
      id: c.id,
      name: c.name,
      definition: c.definition,
      semantic: c.semantic,
      anchored: c.anchors.length > 0 && c.anchors.every((a) => a.found),
      anchors: c.anchors,
      usedBy: c.usedBy,
    })),
    capabilities,
    relations: registry.relations,
    uncomposed,
  };
}

function renderParts(graph: MasterGraph, registry: ConceptRegistry): { style: string; body: string } {
  const css = readFileSync(join(here, 'viewer.css'), 'utf8');
  const data = buildData(graph, registry);
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const totalCaps = [...graph.nodes.values()].filter((n) => n.type === 'capability').length;
  const noAnchor = data.concepts.filter((c) => !c.anchored).length;

  const style = `<style>
${css}
/* concept-map 전용 */
.cm-main{display:grid;grid-template-columns:minmax(0,1fr) 340px;height:calc(100vh - 46px)}
@media (max-width:1000px){.cm-main{grid-template-columns:1fr;height:auto}#detail{max-height:50vh}}
#map-wrap{overflow:auto;padding:10px 6px}
.cm-node{cursor:pointer}
.cm-node rect{stroke-width:1.4}
.cm-node.dim{opacity:.22}
.cm-edge{fill:none;stroke:var(--line);stroke-width:1.3}
.cm-rel{fill:none;stroke-width:1.5;opacity:.85}
.cm-rel.part_of{stroke:var(--world)}
.cm-rel.kind_of{stroke:var(--actor);stroke-dasharray:5 3}
.cm-rel.declares{stroke:var(--goal);stroke-dasharray:2 3}
.cm-rel.holds{stroke:var(--know)}
.cm-rel.hot{stroke-width:2.6;opacity:1}
.cm-rel.dim{opacity:.1}
.cm-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;color:var(--ink-2);padding:6px 16px 0}
.cm-legend i{display:inline-block;width:18px;height:0;border-top:2px solid;vertical-align:middle;margin-right:5px}
.cm-edge.hot{stroke:var(--poss);stroke-width:2}
.cm-edge.dim{opacity:.12}
.cm-col-label{font-size:11px;font-weight:700;letter-spacing:.07em;fill:var(--ink-3)}
.cm-uncomposed{padding:12px 16px 30px;border-top:1px solid var(--line)}
.cm-uncomposed h2{margin:0 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.cm-uncomposed .chips{display:flex;flex-wrap:wrap;gap:4px;max-height:180px;overflow-y:auto}
</style>`;

  const body = `<header>
  <h1>Concept Map — 개념 ↔ Capability</h1>
  <div class="stats">
    <span>도메인 <b>${esc(data.domain || '—')}</b> · ${esc(data.status || '')}</span>
    <span>개념 <b>${data.concepts.length}</b></span>
    <span style="color:var(--hole)">실체 없음 <b>${noAnchor}</b></span>
    <span>조합 기재 Capability <b>${data.capabilities.length} / ${totalCaps}</b></span>
    <span><a href="graph-view.html">의미 축 전체 뷰어 →</a></span>
  </div>
</header>
<div class="cm-legend">
  <span><i style="border-color:var(--world)"></i>부분이다 (part_of)</span>
  <span><i style="border-color:var(--actor);border-top-style:dashed"></i>분류값이다 (kind_of)</span>
  <span><i style="border-color:var(--goal);border-top-style:dotted"></i>선언한다 (declares)</span>
  <span><i style="border-color:var(--know)"></i>담는다 (holds)</span>
  <span><i style="border-color:var(--line)"></i>조합에 쓴다 (Capability →)</span>
</div>
<div class="cm-main">
  <div>
    <div id="map-wrap"><svg id="map"></svg></div>
    <div class="cm-uncomposed">
      <h2>개념 조합 미기재 Capability — 채움의 작업 목록 (${data.uncomposed.length})</h2>
      <p class="hint">개념 등록은 도메인 단위로 한다 — 그 도메인의 기획서가 있어야 개념을 발명 없이
      옮길 수 있다. 이 목록이 0 이 되는 것이 존재 축의 완주다.</p>
      <div class="chips" id="uncomposed"></div>
    </div>
  </div>
  <div id="detail"></div>
</div>
<script>window.__CONCEPT_MAP__=${json};</script>
<script>
(() => {
  const D = window.__CONCEPT_MAP__;
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const OVERLAY_TONE = {
    IMPLEMENTED: ['var(--impl-bg)','var(--impl)'], PARTIAL: ['var(--part-bg)','var(--part)'],
    MISSING: ['var(--miss-bg)','var(--miss)'], '?': ['var(--panel-2)','var(--line)'],
  };
  const W=220,H=34,VG=14,COLGAP=300,TOP=34,LEFT=72;
  const rows=Math.max(D.concepts.length,D.capabilities.length);
  const svg=document.getElementById('map');
  const width=LEFT*2+W*2+COLGAP, height=TOP+rows*(H+VG)+20;
  svg.setAttribute('width',width);svg.setAttribute('height',height);
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  const cx2=LEFT+W+COLGAP;
  const cy=(list,i)=>{const off=(rows-list.length)*(H+VG)/2;return TOP+off+i*(H+VG);};
  let s='';
  s+='<text class="cm-col-label" x="'+LEFT+'" y="18">개념 — 세계가 정의한 명사</text>';
  s+='<text class="cm-col-label" x="'+cx2+'" y="18">CAPABILITY — 개념의 조합</text>';
  const cnY=new Map(),capY=new Map();
  D.concepts.forEach((c,i)=>cnY.set(c.id,cy(D.concepts,i)));
  D.capabilities.forEach((c,i)=>capY.set(c.id,cy(D.capabilities,i)));
  // edges
  D.capabilities.forEach((cap)=>{cap.uses.forEach((cn)=>{
    if(!cnY.has(cn))return;
    const y1=cnY.get(cn)+H/2,y2=capY.get(cap.id)+H/2,x1=LEFT+W,x2=cx2;
    const mx=(x1+x2)/2;
    s+='<path class="cm-edge" data-cn="'+cn+'" data-cap="'+cap.id+'" d="M'+x1+' '+y1+' C'+mx+' '+y1+' '+mx+' '+y2+' '+x2+' '+y2+'"/>';
  });});
  // 개념 사이의 관계 — 왼쪽 열 안에서 왼쪽으로 볼록한 호. from → to 로 화살표.
  s+='<defs>'+['world','actor','goal','know'].map((t)=>
    '<marker id="ar-'+t+'" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">'
    +'<path d="M0 0 L8 4 L0 8 z" fill="var(--'+t+')"/></marker>').join('')+'</defs>';
  const KIND_TONE={part_of:'world',kind_of:'actor',declares:'goal',holds:'know'};
  D.relations.forEach((r,i)=>{
    if(!cnY.has(r.from)||!cnY.has(r.to))return;
    const y1=cnY.get(r.from)+H/2,y2=cnY.get(r.to)+H/2,x=LEFT;
    const bulge=26+(i%4)*9;
    s+='<path class="cm-rel '+r.kind+'" data-rfrom="'+r.from+'" data-rto="'+r.to+'"'
      +' marker-end="url(#ar-'+(KIND_TONE[r.kind]||'world')+')"'
      +' d="M'+x+' '+y1+' C'+(x-bulge)+' '+y1+' '+(x-bulge)+' '+y2+' '+x+' '+y2+'"><title>'
      +esc(r.from+' —'+r.kind+'→ '+r.to+(r.note?' · '+r.note:''))+'</title></path>';
  });

  // concept nodes
  D.concepts.forEach((c)=>{
    const y=cnY.get(c.id);
    const stroke=c.anchored?'var(--poss)':'var(--hole)';
    const fill=c.anchored?'var(--poss-bg)':'var(--panel-2)';
    s+='<g class="cm-node" data-kind="cn" data-id="'+c.id+'">'
      +'<rect x="'+LEFT+'" y="'+y+'" width="'+W+'" height="'+H+'" rx="6" fill="'+fill+'" stroke="'+stroke+'"'+(c.anchored?'':' stroke-dasharray="5 3"')+'/>'
      +'<text x="'+(LEFT+10)+'" y="'+(y+15)+'" font-size="12" font-weight="600" fill="var(--ink)">'+esc(c.name)+'</text>'
      +'<text x="'+(LEFT+10)+'" y="'+(y+28)+'" font-size="10" fill="'+(c.anchored?'var(--ink-3)':'var(--hole)')+'">'
      +(c.anchored?esc(c.id):esc(c.id)+' · 실체 없음')+'</text></g>';
  });
  // capability nodes
  D.capabilities.forEach((c)=>{
    const y=capY.get(c.id);
    const [bg,line]=OVERLAY_TONE[c.overlay]||OVERLAY_TONE['?'];
    s+='<g class="cm-node" data-kind="cap" data-id="'+c.id+'">'
      +'<rect x="'+cx2+'" y="'+y+'" width="'+W+'" height="'+H+'" rx="6" fill="'+bg+'" stroke="'+line+'"/>'
      +'<text x="'+(cx2+10)+'" y="'+(y+15)+'" font-size="11" font-weight="600" fill="var(--ink)">'+esc(c.id)+'</text>'
      +'<text x="'+(cx2+10)+'" y="'+(y+28)+'" font-size="10" fill="var(--ink-3)">'+esc(c.overlay)+'</text></g>';
  });
  svg.innerHTML=s;
  const detail=document.getElementById('detail');
  const byCn=new Map(D.concepts.map((c)=>[c.id,c]));
  const byCap=new Map(D.capabilities.map((c)=>[c.id,c]));
  const KIND_LABEL={part_of:'…의 부분이다',kind_of:'…의 분류값이다',declares:'…을(를) 선언한다',holds:'…을(를) 담는다'};
  function chip(txt,ok){return '<span class="chip '+(ok?'ok':'hole')+'">'+esc(txt)+'</span>';}
  function refBtn(kind,id,label){return '<button class="ref" data-goto-kind="'+kind+'" data-goto="'+id+'">'+esc(label||id)+'</button>';}
  function showCn(id){
    const c=byCn.get(id);if(!c)return;
    focus('cn',id);
    detail.innerHTML='<h3>'+esc(c.id)+'</h3><div class="kind">개념 · '+esc(c.name)+'</div>'
      +'<p class="body">'+esc(c.semantic)+'</p>'
      +'<div class="field"><div class="k">정의 — 기획서</div><div class="v">'+esc(c.definition||'—')+'</div></div>'
      +'<div class="field"><div class="k">실체 — 세계 코드</div><div class="v">'
      +(c.anchors.length?('<ul>'+c.anchors.map((a)=>'<li>'+chip(a.found?'실체':'깨짐',a.found)+' '+esc(a.ref)+'</li>').join('')+'</ul>')
        :chip('실체 없음',false)+' 기획서는 정의했는데 세계 코드에 대응물이 없다 — 이 빈 칸이 곧 선행 작업이다')
      +'</div></div>'
      +'<div class="field"><div class="k">이 개념을 쓰는 Capability</div><div class="v">'
      +(c.usedBy.length?c.usedBy.map((x)=>refBtn('cap',x)).join(' '):chip('없음',false))+'</div></div>'
      +(function(){
        const out=D.relations.filter((r)=>r.from===id),inn=D.relations.filter((r)=>r.to===id);
        if(!out.length&&!inn.length)return '<div class="field"><div class="k">개념 사이의 관계</div>'
          +'<div class="v"><span class="chip hole">등록된 관계 없음 — 고립 노드는 입도 재검토 신호일 수 있다</span></div></div>';
        const row=(r,dir)=>{
          const other=dir==='out'?r.to:r.from;
          const label=dir==='out'?(KIND_LABEL[r.kind]||r.kind):('← '+r.kind);
          const oc=byCn.get(other);
          return '<li>'+(dir==='out'?'':'<span class="om">받음 · </span>')
            +'<button class="ref" data-goto-kind="cn" data-goto="'+other+'">'+esc(oc?oc.name:other)+'</button>'
            +' <span class="om">'+esc(dir==='out'?label:r.kind+' ← 이 개념이 대상')+'</span>'
            +(r.note?'<br><span class="om">'+esc(r.note)+'</span>':'')
            +'<br><span class="om">증거 '+esc(r.evidence)+(r.evidenceFound?'':' · 깨짐')+'</span></li>';
        };
        return '<div class="field"><div class="k">개념 사이의 관계</div><div class="v"><ul>'
          +out.map((r)=>row(r,'out')).join('')+inn.map((r)=>row(r,'in')).join('')+'</ul></div></div>';
      })();
    bind();
  }
  function showCap(id){
    const c=byCap.get(id);if(!c)return;
    focus('cap',id);
    detail.innerHTML='<h3>'+esc(c.id)+'</h3><div class="kind">capability · '+esc(c.overlay)+'</div>'
      +'<p class="body">'+esc(c.semantic)+'</p>'
      +'<div class="field"><div class="k">개념 조합 — 이 기능은 이 개념들의 조합이다</div><div class="v">'
      +c.uses.map((cn)=>{const k=byCn.get(cn);const ok=k&&k.anchored;
        return '<button class="ref" data-goto-kind="cn" data-goto="'+cn+'"><span class="chip '+(ok?'ok':'hole')+'">'
          +esc(k?k.name:cn)+(ok?'':' · 실체 없음')+'</span></button>';}).join(' ')
      +(c.note?'<div style="margin-top:6px" class="body">'+esc(c.note)+'</div>':'')
      +'</div></div>';
    bind();
  }
  function bind(){detail.querySelectorAll('[data-goto]').forEach((b)=>{
    b.addEventListener('click',()=>b.dataset.gotoKind==='cn'?showCn(b.dataset.goto):showCap(b.dataset.goto));});}
  function focus(kind,id){
    document.querySelectorAll('.cm-rel').forEach((e)=>{
      const hit=kind==='cn'&&(e.dataset.rfrom===id||e.dataset.rto===id);
      e.classList.toggle('hot',hit);e.classList.toggle('dim',!hit);});
    document.querySelectorAll('.cm-edge').forEach((e)=>{
      const hit=kind==='cn'?e.dataset.cn===id:e.dataset.cap===id;
      e.classList.toggle('hot',hit);e.classList.toggle('dim',!hit);});
    document.querySelectorAll('.cm-node').forEach((n)=>{
      const linked=kind==='cn'
        ?(n.dataset.id===id||(n.dataset.kind==='cap'&&byCap.get(n.dataset.id).uses.includes(id)))
        :(n.dataset.id===id||(n.dataset.kind==='cn'&&byCap.get(id).uses.includes(n.dataset.id)));
      n.classList.toggle('dim',!linked);});
  }
  svg.addEventListener('click',(ev)=>{
    const g=ev.target.closest('.cm-node');
    if(!g){document.querySelectorAll('.cm-edge,.cm-node,.cm-rel').forEach((e)=>e.classList.remove('hot','dim'));
      detail.innerHTML='<div class="empty">개념이나 Capability 를 고르면 그 조합만 밝아지고 원문이 여기 열린다.</div>';return;}
    g.dataset.kind==='cn'?showCn(g.dataset.id):showCap(g.dataset.id);
  });
  document.getElementById('uncomposed').innerHTML=D.uncomposed
    .map((c)=>'<span class="chip" style="border:1px solid var(--line)">'+esc(c.id)+' · '+esc(c.overlay)+'</span>').join('');
  detail.innerHTML='<div class="empty">개념이나 Capability 를 고르면 그 조합만 밝아지고 원문이 여기 열린다.</div>';
})();
</script>`;
  return { style, body };
}

export function renderConceptMapHtml(graph: MasterGraph, registry: ConceptRegistry): string {
  const { style, body } = renderParts(graph, registry);
  return `<!doctype html><html lang="ko"><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Concept Map</title>
${style}</head><body>
${body}</body></html>
`;
}

export function renderConceptMapArtifact(graph: MasterGraph, registry: ConceptRegistry): string {
  const { style, body } = renderParts(graph, registry);
  return `<title>Concept Map</title>
${style}
${body}`;
}
