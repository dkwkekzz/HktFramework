#!/usr/bin/env python3
# HktSplatGenesis 로컬 정적 서버 — HTTP Range 지원 (S4)
#
# python -m http.server 는 Range 요청을 무시(항상 200 전체 응답)해서 Spark 의 .rad
# LoD 스트리밍(HTTP Range 로 청크 fetch)이 동작하지 않는다. 표준 라이브러리만으로
# Range(단일 구간)를 지원하는 최소 핸들러 — run.sh / run.bat 이 이 파일을 쓴다.
#
# 사용: python3 tools/serve.py [포트=8123] [루트=스크립트 상위 디렉토리]
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RANGE_RE = re.compile(r'bytes=(\d*)-(\d*)$')


class RangeHandler(SimpleHTTPRequestHandler):
    # 스트리밍 청크 fetch 가 많으므로 지연을 줄인다
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        rng = self.headers.get('Range')
        if not (rng and os.path.isfile(path)):
            return super().send_head()
        m = RANGE_RE.match(rng.strip())
        if not m:
            return super().send_head()  # 다중/비정형 구간은 전체 응답으로 폴백
        size = os.path.getsize(path)
        start_s, end_s = m.groups()
        if start_s == '':  # suffix: bytes=-N (끝에서 N 바이트)
            length = min(int(end_s or 0), size)
            start, end = size - length, size - 1
        else:
            start = int(start_s)
            end = min(int(end_s), size - 1) if end_s else size - 1
        if start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        f = open(path, 'rb')
        f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        self._range_remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, '_range_remaining', None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        self._range_remaining = None
        while remaining > 0:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.ply': 'application/octet-stream',
        '.spz': 'application/octet-stream',
        '.rad': 'application/octet-stream',
        '.glb': 'model/gltf-binary',
    }


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    root = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    print(f'[HktSplatGenesis] http://localhost:{port} (Range 지원) — {root}')
    ThreadingHTTPServer(('', port), RangeHandler).serve_forever()
