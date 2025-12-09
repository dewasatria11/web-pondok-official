from http.server import BaseHTTPRequestHandler
from lib._supabase import supabase_client
from lib.handlers._crud_helpers import send_json, read_json_body, allow_cors

def handle_chat_search(supa, query_text):
    """
    Cari jawaban lewat RPC PostgreSQL `search_faq`.
    Jika skor kemiripan teratas di bawah ambang batas, anggap tidak ada jawaban.
    """
    try:
        response = supa.rpc('search_faq', {'query_text': query_text}).execute()
        matches = response.data or []

        if not matches:
            return []

        try:
            top_score = float(matches[0].get('similarity_score') or 0)
        except (TypeError, ValueError):
            top_score = 0

        # Lebih toleran agar query pendek seperti "cara daftar" tetap lolos
        return matches if top_score >= 0.15 else []
    except Exception as e:
        print(f"Error searching FAQ: {e}")
        return []

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = read_json_body(self)
            query = body.get("query", "").strip()

            if not query:
                return send_json(self, 400, {"ok": False, "error": "Query is required"})

            supa = supabase_client()  # Anon key is fine for reading
            matches = handle_chat_search(supa, query)

            return send_json(self, 200, {
                "ok": True,
                "matches": matches
            })

        except Exception as e:
            print(f"Error in public_chat: {e}")
            return send_json(self, 500, {"ok": False, "error": str(e)})

    def do_OPTIONS(self):
        allow_cors(self, ["POST", "OPTIONS"])
