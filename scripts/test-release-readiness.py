"""Server-only readiness regression. Uses a local fake HTTP server, not the DB."""
import http.server
import json
import os
from pathlib import Path
import subprocess
import threading
import unittest


class Handler(http.server.BaseHTTPRequestHandler):
    status = 200
    body = {"listings": [], "pagination": {"total": 0}}

    def do_GET(self):
        if self.path.startswith("/api/listings?"):
            self.send_response(type(self).status)
            self.end_headers()
            self.wfile.write(json.dumps(type(self).body).encode())
        else:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'<link href="/_next/static/css/abc123.css">')

    def log_message(self, *_):
        pass


class ReadinessTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def run_probe(self, status, body):
        Handler.status, Handler.body = status, body
        env = {**os.environ, "AUTOMART_LOCAL_URL": f"http://127.0.0.1:{self.server.server_port}"}
        result = subprocess.run(
            ["bash", str(Path(__file__).with_name("verify-or-rollback.sh")), "--check-only"],
            env=env, capture_output=True, text=True, timeout=20,
        )
        self.assertNotIn("verify: откат", result.stdout)
        return result

    def test_empty_catalog_is_healthy(self):
        result = self.run_probe(200, {"listings": [], "pagination": {"total": 0}})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_database_error_is_unhealthy_despite_healthy_home(self):
        self.assertEqual(self.run_probe(500, {"error": "database locked"}).returncode, 1)

    def test_error_payload_with_status_200_is_unhealthy(self):
        self.assertEqual(self.run_probe(200, {"error": "database locked"}).returncode, 1)

    def test_invalid_total_is_unhealthy(self):
        for total in (-1, True, "12", None):
            with self.subTest(total=total):
                self.assertEqual(self.run_probe(200, {"listings": [], "pagination": {"total": total}}).returncode, 1)


if __name__ == "__main__":
    unittest.main()
