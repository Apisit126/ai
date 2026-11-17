from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer
import webbrowser


ROOT = Path(__file__).resolve().parent


class ChatHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()


if __name__ == "__main__":
    address = "http://127.0.0.1:8000"
    server = ThreadingHTTPServer(("127.0.0.1", 8000), ChatHandler)
    print(f"เพื่อน AI พร้อมแล้ว: {address}")
    print("ปิดหน้าต่างนี้เพื่อหยุดเว็บ")
    Timer(1, lambda: webbrowser.open(address)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
