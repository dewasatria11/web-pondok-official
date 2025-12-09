# api/supa_proxy.py
"""
Proxy Supabase REST (PostgREST) dengan CORS & multi-tabel.
- Pilih tabel via query ?table=berita&select=*
- CORS diatur di sini (ALLOWED_ORIGIN)
- Optional whitelist tabel via env ALLOWED_TABLES=berita,prestasi,sambutan,profile_pondok,pendaftar
- Forward header penting: Content-Type, Prefer, Range, If-Match, Accept
- Tangani preflight (OPTIONS) dgn 204
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, urlencode
import json, requests

# === Dewa Satria - Supabase Project Settings ===
SUPABASE_URL = "https://pislnvhdmsxudltcuuku.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpc2xudmhkbXN4dWRsdGN1dWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODI4MTYsImV4cCI6MjA3NTk1ODgxNn0.j-M6yrGTumWsJM8K5IX-RPpnMbCEvWqLxRiO9HMPq6A"
ALLOWED_ORIGIN = "https://ppdsb_pondok.vercel.app"  # domain web kamu
DEFAULT_TABLE = "pendaftar"
TIMEOUT_SEC = 30
ALLOWED_TABLES = ["berita", "prestasi", "sambutan", "profile_pondok", "pendaftar"]
# ==============================================

def _cors_headers(h: BaseHTTPRequestHandler):
    h.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
    h.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    h.send_header("Access-Control-Allow-Headers", "authorization, apikey, content-type, prefer, range, if-match, accept")
    h.send_header("Vary", "Origin")

def _extract_table_and_query(path: str):
    parsed = urlparse(path)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    table = (qs.get("table", [DEFAULT_TABLE])[0] or DEFAULT_TABLE).strip()
    if "table" in qs:
        qs.pop("table")
    fwd_qs = urlencode([(k, v) for k, vals in qs.items() for v in vals], doseq=True)
    return table, fwd_qs

def _blocked_table(table: str) -> bool:
    return bool(ALLOWED_TABLES) and (table not in ALLOWED_TABLES)

def _supabase_headers(incoming: BaseHTTPRequestHandler):
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    for key in ["Content-Type", "Prefer", "Range", "If-Match", "Accept"]:
        val = incoming.headers.get(key)
        if val:
            h[key] = val
    if "Content-Type" not in h:
        h["Content-Type"] = "application/json"
    return h

def _read_body(h: BaseHTTPRequestHandler):
    try:
        ln = int(h.headers.get("Content-Length", 0))
    except ValueError:
        ln = 0
    return h.rfile.read(ln) if ln > 0 else None

def _finish_json(h: BaseHTTPRequestHandler, status: int, payload: dict):
    h.send_response(status)
    _cors_headers(h)
    h.send_header("Content-Type", "application/json; charset=utf-8")
    h.end_headers()
    h.wfile.write(json.dumps(payload).encode("utf-8"))

def _forward(method: str, h: BaseHTTPRequestHandler):
    table, fwd_qs = _extract_table_and_query(h.path)
    if _blocked_table(table):
        return _finish_json(h, 403, {"success": False, "error": f"Table '{table}' not allowed"})

    target = f"{SUPABASE_URL}/rest/v1/{table}"
    if fwd_qs:
        target += f"?{fwd_qs}"

    body = _read_body(h) if method in ("POST", "PUT", "PATCH", "DELETE") else None
    headers = _supabase_headers(h)

    try:
        resp = requests.request(method, target, headers=headers, data=body, timeout=TIMEOUT_SEC)
    except requests.RequestException as e:
        return _finish_json(h, 502, {"success": False, "error": f"Upstream error: {str(e)}"})

    h.send_response(resp.status_code)
    _cors_headers(h)
    for hk in ["content-type", "content-range", "content-location", "etag"]:
        hv = resp.headers.get(hk)
        if hv:
            h.send_header(hk.title(), hv)
    h.end_headers()
    h.wfile.write(resp.content)

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        _cors_headers(self)
        self.end_headers()

    def do_GET(self): _forward("GET", self)
    def do_POST(self): _forward("POST", self)
    def do_PUT(self): _forward("PUT", self)
    def do_PATCH(self): _forward("PATCH", self)
    def do_DELETE(self): _forward("DELETE", self)
