"""
API Handler: POST /api/index?action=sections_upsert
Upsert section metadata + translations (ID & EN) with admin token auth.
"""
from http.server import BaseHTTPRequestHandler
from datetime import datetime, timezone
import json
import os

from .._supabase import supabase_client

ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN")


def _unauthorized(handler):
    handler.send_response(401)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(json.dumps({"error": "Unauthorized"}).encode("utf-8"))


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.command != "POST":
            self._method_not_allowed()
            return

        auth_header = self.headers.get("Authorization", "")
        token = auth_header[7:] if auth_header.lower().startswith("bearer ") else None
        if not token or token != ADMIN_API_TOKEN:
            _unauthorized(self)
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length) if content_length else b""
            payload = json.loads(raw_body.decode("utf-8") or "{}") if raw_body else {}
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON body"}).encode("utf-8"))
            return

        slug = payload.get("slug")
        if not slug or not isinstance(slug, str):
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid slug"}).encode("utf-8"))
            return

        try:
            supa = supabase_client(service_role=True)
            supa.table("sections").upsert({"slug": slug}).execute()
            section_res = (
                supa.table("sections")
                .select("id")
                .eq("slug", slug)
                .limit(1)
                .execute()
            )
            if not section_res.data:
                raise RuntimeError("Failed to fetch section")
            section_id = section_res.data[0]["id"]

            rows = []
            timestamp = datetime.now(timezone.utc).isoformat()
            id_payload = payload.get("id")
            en_payload = payload.get("en")
            if isinstance(id_payload, dict):
                rows.append({
                    "section_id": section_id,
                    "locale": "id",
                    "title": id_payload.get("title"),
                    "body": id_payload.get("body"),
                    "updated_at": timestamp,
                })
            if isinstance(en_payload, dict):
                rows.append({
                    "section_id": section_id,
                    "locale": "en",
                    "title": en_payload.get("title"),
                    "body": en_payload.get("body"),
                    "updated_at": timestamp,
                })

            if rows:
                supa.table("section_translations").upsert(
                    rows,
                    on_conflict="section_id,locale",
                ).execute()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "section_id": section_id}).encode("utf-8"))

        except Exception as exc:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(exc) or "server error"}).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _method_not_allowed(self):
        self.send_response(405)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Method not allowed"}).encode("utf-8"))
