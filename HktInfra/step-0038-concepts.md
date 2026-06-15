# step-0038 concepts — Box-part split as bounded copy-forward maintenance

> 정식 기록: [step-0038.md](step-0038.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 박스 1개 = 파일 1개 | 한 책임(박스)을 한 파일로 — 목표 토폴로지(박스=독립 서버)와 파일 구조 일치 | topology.js 를 *구성*(build)과 *구동*(run)으로 가름 |
| 비대화 트리거 | 박스 파일 >30KB 면 다음 기능 step 전에 재분할 정리 step | topology.js 31KB → 분할 |
| verbatim 이동 = reg 0 | 함수 본문을 바이트 그대로 옮기면 동작 불변 → 회귀 0 | buildTopology·makeActor·routeFilters 무편집 이동 |
| 복사 전진(anti-DRY) 유계화 | step 간 복사 전진의 페이로드를 정리로 묶어 무한 성장 방지 | 동결 단위는 여전히 step-0038/ 통째 |

## 1. 무엇을 — 한 파일의 두 책임을 가른다

`topology.js` 는 HktInfra 프로토타입의 *배선 파일*이다. 두 가지 다른 일을 한 파일에 담고 있었다:

1. **토폴로지 구성** — `buildTopology(opts)` 는 옵션을 받아 *선언적 spec 목록*(어떤 박스를 어떤 주소로·어떤 opts 로 띄울지)을 만들고, `makeActor(spec, net)` 가 그 spec 을 실제 액터 객체로 인스턴스화한다. `routeFilters` 는 메시지 분류 헬퍼다.
2. **run 드라이버** — `run(opts)` 는 인프로세스 모드에서 매 tick 네트워크를 돌리고 crash/restart/reneg 같은 제어 평면 트리거를 주입하는 *시뮬레이션 루프*다. `runMulti` 는 그 멀티프로세스 판, `quorumMergeJournals` 는 복구 헬퍼다.

두 책임 다 100줄대의 큰 코드라 파일이 31KB 로 불었다. 이 step 은 ⒈을 새 파일 `topo-build.js` 로 떼고, `topology.js` 는 ⒉(+진입점 재노출)로 남긴다.

## 2. 왜 — 비대화 트리거와 복사 전진의 긴장

HktInfra 는 step 간에 *복사 전진*(anti-DRY)을 한다 — 각 step 디렉토리는 직전 step 전체의 동결 스냅샷 위에 한 조각을 더한 것이다. 이 방식은 동결 단위를 깨끗하게(디렉토리 통째) 유지하지만, 파일이 계속 커지면 *복사 전진 페이로드*도 step 수에 비례해 커지는 위험이 있다.

그래서 CLAUDE.md 는 **비대화 트리거**를 둔다: 박스 파일 1개가 30KB 를 넘거나 step 디렉토리가 300KB 를 넘으면, *다음 기능 step 전에* 정리 step(재분할·engine 승격·기능 추가 0·reg 비트 동일)을 끼운다. 0030 은 단일 `net-core.js` 를 8개 박스 파일로, 0035 는 `cluster.js` 를 5개 부품으로 갈랐다. 이 step 은 그 *topology 판* — 0037 에서 `topology.js` 가 31KB 가 되어 트리거가 걸렸다.

정리 step 은 **큰 그림 진행이 아니다**. SPINE 6계층의 어떤 박스도 채우지 않는다(기능 0). 오직 *유지보수* — 복사 전진 페이로드를 유계로 묶어, 다음 기능 step 들이 건강한 파일 위에서 일하게 한다.

## 3. 어떻게 검증했나 — verbatim 이동이 reg 0 을 보장한다

분할의 핵심 안전성은 **verbatim 이동**이다: `buildTopology`·`makeActor`·`routeFilters` 의 함수 *본문을 한 글자도 안 고치고* 새 파일로 옮겼다. 시그니처(`buildTopology(opts)` → 같은 spec 구조, `makeActor(spec,net)` → 같은 등록)도, 진입점이 노출하는 export 집합(6개)도 불변이다. 그래서:

- **`reg`(키트 모드)** — NET(0038)이 NETPREV(0037)와 *비트 동일*(net.log + 상태 + inv/chat/bus/rank 다이제스트)임을 25 구성에서 증명한다. 분할이 내부 파일 구조만 바꿨다는 직접 증거.
- **`busreq`(0037 에서 carried)** — 분할 후에도 요청 경로 producer replay 가 그대로 동작(`minted == base`)함을 *행위*로 재확인한다. 토폴로지 구성이 다른 파일로 옮겨가도 `run` 의 행동이 똑같다는 split 투명성 체크.
- **멀티프로세스 E2E** — `runMulti` 는 `buildTopology` 를 인자로 받을 뿐이라 `cluster.js` 무수정, 멀티프로세스 다이제스트가 인프로세스와 비트 동일.

부수 효과로 **죽은 import 하나가 드러났다**: 옛 `topology.js` 는 `itemDesync`·`invDigest` 를 import 했으나 코드에선 주석 언급뿐 실제 호출 0 이었다. run 드라이버를 분리하며 실제 사용 심볼만 import 하도록 정리해 떨궜다(동작 불변).

## 한 줄 요약

topology.js(31KB>30KB)를 *구성*(topo-build.js)과 *구동*(topology.js entry)으로 verbatim 분할 — 기능 0·export 불변·reg 0(0037 비트 동일). 비대화 트리거가 명한 유지보수로, 복사 전진 페이로드를 유계로 묶어 다음 기능 step 을 건강한 파일 위에 세운다.
