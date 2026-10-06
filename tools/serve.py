#!/usr/bin/env python3
"""Local preview server for the site.

Same as `python3 -m http.server`, but it tells the browser not to cache anything, so a
reload always shows the files as they are on disk. (The plain server sends no cache
header, and Chrome then reuses old copies of index.html and styles.css for hours, which
makes new sections look missing or unstyled.)

    python3 tools/serve.py          # http://localhost:8000
    python3 tools/serve.py 8001     # another port
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
handler = functools.partial(NoCacheHandler, directory=root)
print(f"Serving {root} at http://localhost:{port} (no caching). Ctrl+C to stop.")
http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
