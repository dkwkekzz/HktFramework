# step-0035 concepts — Splitting the broker driver (cleanup, feature-zero)

> 정식 기록: [step-0035.md](step-0035.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 박스 비대화 트리거 | 박스 파일 1개 > 30KB(또는 step 디렉토리 > 300KB)면 다음 기능 step 전에 *정리 step* 을 끼운다 | `cluster.js` 45,293B 가 트리거를 넘겨 이 step 을 유발 |
| 정리 step | 기능 0·바이트 동일·reg 0 인 위생 작업(재분할/engine 승격) | 이 step 전체 — 0030 의 cluster 판 |
| 진입점 분할 | 한 파일을 부품 파일들 + 그것들을 묶는 *진입점* 으로 쪼갬(`net-core.js` 패턴) | `cluster.js` 가 부품 4개를 require 해 재노출 |
| verbatim 이동 | 코드를 한 바이트도 바꾸지 않고 파일만 옮김 → reg 0 보장 | sed 라인-레인지 추출로 4부품 조립 |
| 분할 투명성 증명 | 인프로세스가 안 닿는 코드의 무결성은 *멀티프로세스 E2E 비트 동일* 로 증명 | e2e/summary/inject 모드 + spine 35-step |

## 1. 왜 *정리 step* 이 별도 단위인가 — 복사 전진의 비용 관리

HktInfra 는 step 마다 직전 step 디렉토리를 **통째 복사**해 전진한다(anti-DRY·동결 스냅샷). 이 *복사 전진*은 step 간 격리를 주는 대신, **파일이 커질수록 매 step 복사 비용·self-review diff·읽기 부담이 비례**한다. 그래서 0030 이 임계를 못박았다: **박스 파일 1개가 30KB 를 넘거나 step 디렉토리가 300KB 를 넘으면, 다음 *기능* step 전에 *정리 step*** 을 끼운다 — 재분할 또는 engine 승격으로 페이로드를 유계로 묶되, **기능은 0·동작은 바이트 동일(reg 0)**.

0034 까지 누적된 broker 드라이버 `cluster.js` 가 45,293B 로 트리거를 넘겼다(0013 진짜 kill·0017 가방 failover·0020 랭킹 failover·0021 채팅 failover 가 차례로 얹히며 비대). 이번 step 은 *그 한 파일을 쪼개는 것* 만 한다.

## 2. 진입점 분할 — `net-core.js` 가 박스를 묶듯, `cluster.js` 가 broker 부품을 묶는다

0030 이 net-core 를 *박스 1개 = 파일 1개* 로 쪼개고 `net-core.js` 를 *진입점*(부품을 require 해 동일 export 노출)으로 남긴 것과 똑같은 형태를, broker 드라이버에 적용한다. `cluster.js` 의 네 덩어리:

- **프레이밍**(`frameOf`·`Framer`) — TCP 바이트 스트림의 메시지 경계 복원. broker 와이어의 최하층.
- **Cluster 클래스** — broker 그 자체: 토픽 pub/sub 라우팅·링크 열화(드롭/분단/펜싱)·진짜 `child.kill` 생애주기·재-provisioning.
- **reconstruct** — 런 종료 후 각 호스트 스냅샷을 인프로세스 `run()` 과 *같은 형태의 r 객체* 로 접어 dead 주소를 표기(소유자=1 보존).
- **runMulti(+computePlacement)** — 위를 조립해 lockstep 배리어로 멀티프로세스 E2E 를 구동하는 드라이버.

각각을 `cluster-wire.js`·`cluster-core.js`·`cluster-reconstruct.js`·`cluster-run.js` 로 옮기고, `cluster.js` 는 넷을 require 해 `{ runMulti, Cluster, computePlacement, frameOf, Framer }` 를 **0034 와 같은 export 집합** 으로 재노출하는 13줄 진입점이 된다. 유일 소비자 `topology.js` 의 `require('./cluster.js').runMulti` 는 *한 글자도* 안 바뀐다.

## 3. verbatim 이동이 reg 0 을 *기계적으로* 보장한다

분할이 동작을 바꾸지 않았음을 어떻게 *확신* 하는가? 답은 **코드를 바이트 단위로 그대로 옮기는 것**이다. 손으로 다시 타이핑하지 않고 원본의 라인 레인지를 그대로 추출(`sed -n 'A,Bp'`)해 부품 파일에 붙였다 — 공백·주석·문장 순서까지 동일. 더한 것은 파일 경계의 `require`/`module.exports` 배선 줄뿐. export 집합이 같고 코드가 같으니 *정의상* 동작이 같다.

다만 한 가지 미묘함: `cluster.js` 는 인프로세스 `reg` 모드가 **닿지 않는다**. reg 는 `net-core.js`(인프로세스 결정론 코어)를 0034 와 비교하는데, net-core 는 cluster 를 require 하지 않기 때문이다(cluster 는 *멀티프로세스* 경로 전용). 그래서 분할 투명성의 증거는 reg 가 아니라 **멀티프로세스 E2E 비트 동일**(`e2e`·`summary`·`inject`·`recover-*` 모드가 `runMulti` 결과를 인프로세스 `run()` 다이제스트와 비교)과 **spine 35-step 사슬**이다 — 둘 다 ALL OK.

## 4. 정직한 한계 — 분할은 총 바이트를 *늘린다*

부품마다 헤더 주석·require·export 가 붙으므로 5파일 합계(48.0KB)는 원본(45.3KB)보다 크다. 정리의 목적은 *총량 절감*이 아니라 **단일 박스 파일을 30KB 아래로** 묶는 것 — 복사 전진 1회의 self-review diff 를 박스 단위로 쪼개 읽기 쉽게 하고, 미래 분산 토폴로지(파일=독립 서버)와 정합시키는 위생이다. `topology.js`(29.7KB)가 30KB 에 근접해 다음 트리거 후보다.

## 한 줄 요약

45KB 를 넘긴 broker 드라이버 `cluster.js` 를 *바이트 동일* 로 진입점 1 + 부품 4(최대 19.7KB)로 쪼갠 정리 step — 기능 0·reg 0·멀티프로세스 E2E 비트 동일·spine 35-step 통과로 분할 투명성을 증명한다(0030 net-core 분할의 cluster 판).
