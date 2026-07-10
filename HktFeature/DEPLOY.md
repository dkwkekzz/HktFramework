# DEPLOY — 폰으로 관전하기 (데스크탑·배치파일 없이)

> 문제: 시뮬레이션은 `run.bat`/`run.sh`(Node 서버 + 봇 + 브라우저)로 돌려야 해서 데스크탑에서만 됐다.
> 해결: **서버만 클라우드에 한 번 올리면**, 폰 브라우저에서 URL 로 언제든 관전할 수 있다.

## 왜 서버만으로 되나

- **클라이언트는 이미 브라우저다.** 서버가 `client/`·`shared/` 를 정적 서빙하고, `client/net.js` 는
  `wss://${location.host}` 로 붙는다 — 폰이 여는 주소 그대로 WebSocket 이 연결된다(코드 수정 0).
- **봇이 없어도 세계가 산다.** `server/index.js` 의 틱 루프가 3개 군집에 포식자·먹이를 계속 풀고
  불씨·자폭까지 일으킨다. 관전자는 접속만으로 강탈·방출·연소·채집·성장이 끊임없이 벌어지는 걸 본다.
- 서버는 `process.env.PORT`(Render 가 주입)·`0.0.0.0` 바인딩이라 클라우드에서 그대로 뜬다.

## 가장 쉬운 길 — Render Blueprint (무료, 데스크탑 불필요)

리포 루트의 [`render.yaml`](../render.yaml) 이 배포를 정의한다. 계정 1개 외에 설치할 것은 없다.

1. 이 브랜치를 push 한다(이미 되어 있음).
2. <https://render.com> 로그인 → **New → Blueprint**.
3. 이 GitHub 리포를 선택하면 `render.yaml` 을 자동으로 읽는다 → **Apply**.
   (서비스 `hktfeature-viewer` 하나가 `rootDir: HktFeature`, `node server/index.js` 로 뜬다.)
4. 배포가 끝나면 `https://hktfeature-viewer.onrender.com` 같은 공개 URL 이 생긴다.
5. **폰 브라우저에서 `https://<그 URL>/?name=관전자`** 를 연다 — 끝. 데스크탑은 꺼도 된다.

> **무료 티어 슬립**: 15분간 아무도 안 붙으면 잠들고, 첫 접속에 수십 초 걸려 깨어난다(그 뒤엔 즉시).
> 관전 용도로는 충분하다. 항상 켜두려면 Render 유료 인스턴스나 아래 대안을 쓴다.

### 부하(플레이어)를 더 넣고 싶으면 — 선택

관전만이면 필요 없다. 사람 이동 부하를 얹고 싶으면, 아무 기기에서 봇을 공개 URL 로 붙인다:

```bash
node tools/bots.js 8 wss://hktfeature-viewer.onrender.com
```

## 대안 — 데스크탑이 켜져 있어도 되는 경우

**Render 계정도 만들기 싫고 데스크탑을 켜둘 수 있다면**, 더 빠른 두 가지:

- **터널(설정 거의 0)**: 데스크탑에서 서버를 켜고(`npm start`) 공개 URL 한 줄로 노출:
  ```bash
  cloudflared tunnel --url http://localhost:8080
  ```
  출력된 `https://*.trycloudflare.com` 을 폰에서 연다. 데스크탑을 끄면 끊긴다.
- **같은 Wi-Fi(코드 0)**: `npm start` 후, 폰에서 `http://<데스크탑 LAN IP>:8080/?name=관전자`.
  서버가 `0.0.0.0` 바인딩이라 같은 공유기 안이면 바로 붙는다.

## 다른 호스트로 배포하려면

`render.yaml` 은 Render 전용이지만 서버 자체는 평범한 Node 웹앱이라 어디든 올라간다.
어느 호스트든 다음만 맞추면 된다: **root = `HktFeature`**, **build = `npm install`**,
**start = `node server/index.js`**, 그리고 **`PORT` 환경변수를 서버가 읽게 둔다**(이미 그렇게 되어 있음).
