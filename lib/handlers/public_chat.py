from http.server import BaseHTTPRequestHandler
from lib._supabase import supabase_client
from lib.handlers._crud_helpers import send_json, read_json_body, allow_cors

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = read_json_body(self)
            query = body.get("query", "").strip()
            
            if not query:
                return send_json(self, 400, {"ok": False, "error": "Query is required"})

            supa = supabase_client() # Anon key is fine for reading
            
            # 1. Primary Search: Full Text Search on 'question'
            # Good for natural language queries
            res = supa.table("faq_kb") \
                .select("*") \
                .textSearch("question", query, {"type": "websearch", "config": "indonesian"}) \
                .limit(3) \
                .execute()
            
            matches = res.data
            
            # 2. Secondary Search: Full Text Search on 'keywords'
            # If question didn't match, maybe keywords will
            if not matches:
                res_kw = supa.table("faq_kb") \
                    .select("*") \
                    .textSearch("keywords", query, {"type": "websearch", "config": "indonesian"}) \
                    .limit(3) \
                    .execute()
                matches = res_kw.data

            # 3. Fallback: Word-based partial match (AND logic)
            # Splits query into words and ensures ALL words exist in either question OR keywords
            if not matches:
                # Sanitize and split words
                words = [w for w in "".join(c for c in query if c.isalnum() or c.isspace()).split() if len(w) >= 2]
                
                if words:
                    try:
                        req = supa.table("faq_kb").select("*")
                        for word in words:
                            # Use % for wildcard. If * caused 500, we revert to %.
                            # We sanitize word to avoid injection or syntax errors.
                            req = req.or_(f"question.ilike.%{word}%,keywords.ilike.%{word}%")
                        
                        res_fallback = req.limit(3).execute()
                        matches = res_fallback.data
                    except Exception as fallback_err:
                        print(f"Fallback search error: {fallback_err}")
                        # Continue to next fallback if this fails

            # 4. Last Resort: Any word match (OR logic)
            if not matches and len(words) > 1:
                 try:
                     req = supa.table("faq_kb").select("*")
                     or_conditions = []
                     for word in words:
                         or_conditions.append(f"question.ilike.%{word}%")
                         or_conditions.append(f"keywords.ilike.%{word}%")
                     
                     req = req.or_(",".join(or_conditions))
                     res_last = req.limit(1).execute()
                     matches = res_last.data
                 except Exception as last_err:
                     print(f"Last resort search error: {last_err}")

            return send_json(self, 200, {
                "ok": True,
                "matches": matches
            })

        except Exception as e:
            print(f"Error in public_chat: {e}")
            return send_json(self, 500, {"ok": False, "error": str(e)})

    def do_OPTIONS(self):
        allow_cors(self, ["POST", "OPTIONS"])
