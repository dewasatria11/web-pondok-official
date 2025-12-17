"""
API Handler: GET /api/index?action=locales&lang={id|en}
Serve merged locale dictionaries with minimal caching so it can live
inside the single Python router function on Vercel.
"""
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import hashlib
import json
import time
from typing import Optional

from lib._supabase import supabase_client

CACHE_TTL_SECONDS = 60
_locale_cache = {}
_BASE_LOCALES_DIR = Path(__file__).resolve().parents[2] / "public" / "locales"


def _is_supported_lang(value: str) -> bool:
    return value in ("id", "en")


def _load_base_locale(locale: str) -> dict:
    path = _BASE_LOCALES_DIR / f"base.{locale}.json"
    if not path.exists():
        raise FileNotFoundError(f"Base locale file not found: {path}")
    with path.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def _deep_merge(target, source):
    """
    Shallow clone target, then merge source recursively (objects only).
    """
    result = {}
    if isinstance(target, dict):
        result.update(target)
    for key, value in (source or {}).items():
        if isinstance(value, dict):
            existing = result.get(key, {})
            result[key] = _deep_merge(existing if isinstance(existing, dict) else {}, value)
        else:
            result[key] = value
    return result


def _rows_to_sections(locale: str, rows: list[dict], fallback_to_id: bool = True) -> dict:
    """
    Transform Supabase rows into the nested `section` dictionary expected by the frontend.
    """
    result = {}

    def ensure_section_field(slug: str, field: str, value):
        if value in (None, ""):
            return
        result.setdefault("section", {}).setdefault(slug, {})[field] = value

    for row in rows or []:
        translations = (
            row.get("translations")
            or row.get("section_translations")
            or []
        )
        id_translation = next((t for t in translations if t.get("locale") == "id"), None)
        en_translation = next((t for t in translations if t.get("locale") == "en"), None)
        pick = id_translation if locale == "id" else en_translation

        title = (pick or {}).get("title")
        if not title and fallback_to_id:
            title = (id_translation or {}).get("title")
        if title:
            ensure_section_field(row.get("slug", ""), "title", title)

        body = (pick or {}).get("body")
        if not body and fallback_to_id:
            body = (id_translation or {}).get("body")
        if body:
            ensure_section_field(row.get("slug", ""), "body", body)

    return result


def _send_response(handler, status: int, body: Optional[str], etag: Optional[str]):
    handler.send_response(status)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header(
        "Cache-Control",
        "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    )
    if etag:
        handler.send_header("ETag", etag)
    if status != 304:
        handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.end_headers()
    if body and status != 304:
        handler.wfile.write(body.encode("utf-8"))


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            lang_param = (query.get("lang") or query.get("LANG") or [""])[0].lower()
            lang = lang_param if _is_supported_lang(lang_param) else "id"

            now = time.time()
            cached = _locale_cache.get(lang)

            if cached and cached["expires"] > now:
                if self.headers.get("If-None-Match") == cached["etag"]:
                    _send_response(self, 304, None, cached["etag"])
                    return
                _send_response(self, 200, cached["body"], cached["etag"])
                return

            supa = supabase_client(service_role=True)
            result = (
                supa.table("sections")
                .select("slug, translations:section_translations(locale,title,body,updated_at)")
                .order("slug")
                .execute()
            )

            base_locale = _load_base_locale(lang)
            sections_dict = _rows_to_sections(lang, result.data or [], True)
            merged = _deep_merge(base_locale, sections_dict)
            body = json.dumps(merged, ensure_ascii=False, indent=2)
            etag = hashlib.sha1(body.encode("utf-8")).hexdigest()

            _locale_cache[lang] = {
                "body": body,
                "etag": etag,
                "expires": now + CACHE_TTL_SECONDS,
            }

            if self.headers.get("If-None-Match") == etag:
                _send_response(self, 304, None, etag)
                return

            _send_response(self, 200, body, etag)
        except Exception as exc:
            error_body = json.dumps(
                {"error": getattr(exc, "message", str(exc)) or "server error"}
            )
            _send_response(self, 500, error_body, None)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
