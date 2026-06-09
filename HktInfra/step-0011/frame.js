// HktInfra step-0011 — 길이-프리픽스 프레이밍 (실 TCP 소켓 전송의 핵심 원시값).
//   broker(cluster.js)와 host(host.js) *양쪽 프로세스가 같은 모듈*을 require 한다 — 와이어 포맷이 한 곳.
//
//   왜 필요한가: child_process IPC(0010)는 *메시지 경계*를 OS 가 보존해 줬다(한 send = 한 message 이벤트).
//   그러나 TCP 는 *바이트 스트림*이다 — 경계가 없다. 한 write 가 여러 조각으로 쪼개져 도착하거나,
//   여러 write 가 한 청크로 합쳐져(Nagle/coalescing) 도착한다. 그래서 메시지 경계를 *우리가* 다시 세워야 한다:
//     프레임 = [4바이트 BE 길이][JSON 바이트] — 수신측은 길이만큼 모이면 한 메시지로 복원(나머지는 버퍼에 보관).
//   이게 "실 네트워크 전송"이 IPC 파이프와 다른 가장 구체적인 지점이다(0010 §8.2 → 0011 현실화).
'use strict';

// 객체 → 프레임 버퍼([len32-BE][utf8 JSON]). 직렬화 가능해야(함수·순환 0) — 프로세스 경계 계약.
function frame(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const head = Buffer.allocUnsafe(4);
  head.writeUInt32BE(body.length, 0);
  return Buffer.concat([head, body]);
}

// 바이트 스트림 재조립기 — TCP 청크(부분/합본)를 모아 *완전한 프레임*만 onMsg 로 흘린다.
//   push(chunk) 를 data 이벤트마다 호출. 길이가 다 차면 한 메시지를 떼어 onMsg(obj, byteLen) — 남은 바이트는 보관.
//   onMsg 의 byteLen = 프레임 전체 바이트(헤더 4 + 본문) = *실제 와이어 바이트*(정직한 소켓 계측).
class FrameReader {
  constructor(onMsg) { this.buf = Buffer.alloc(0); this.onMsg = onMsg; }
  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32BE(0);
      if (this.buf.length < 4 + len) break;          // 프레임 아직 미완 — 더 기다린다(경계 재조립)
      const body = this.buf.subarray(4, 4 + len);
      this.buf = this.buf.subarray(4 + len);         // 나머지(다음 프레임의 일부일 수도)는 보관
      this.onMsg(JSON.parse(body.toString('utf8')), 4 + len);
    }
  }
}

module.exports = { frame, FrameReader };
