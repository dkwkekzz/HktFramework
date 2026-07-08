// ============================================================================
// Net — WebSocket 수송 + 수신 대역폭 계측
// "엄청나게 가볍다" 는 주장을 화면에서 검증하기 위해 초당 수신 바이트를 잰다.
// ============================================================================

import { encode, decode, MSG } from '../shared/protocol.js';

export class Net {
  constructor() {
    this.ws = null;
    this.bytesInWindow = 0;
    this.bytesPerSec = 0;
    this.connected = false;
    setInterval(() => { this.bytesPerSec = this.bytesInWindow; this.bytesInWindow = 0; }, 1000);
  }

  connect(name, onMsg) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    this.ws.onopen = () => {
      this.connected = true;
      this.send(MSG.HELLO, { name });
    };
    this.ws.onmessage = (ev) => {
      this.bytesInWindow += typeof ev.data === 'string' ? ev.data.length : ev.data.byteLength;
      const msg = decode(ev.data);
      if (msg) onMsg(msg);
    };
    this.ws.onclose = () => { this.connected = false; };
  }

  send(type, payload = {}) {
    if (this.ws?.readyState === 1) this.ws.send(encode(type, payload));
  }
}
