"""
API Handler: POST /api/why_section_update
Update Why Section content (narasi)
"""
from http.server import BaseHTTPRequestHandler
import json
from .._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            print("[WHY_SECTION_UPDATE] Updating Why Section content...")
            print(f"[WHY_SECTION_UPDATE] Data: {data}")
            
            # Get Supabase client with service role for admin operations
            supa = supabase_client(service_role=True)
            
            # Extract fields
            title = (data.get("title") or "").strip()
            subtitle = (data.get("subtitle") or "").strip()
            content = (data.get("content") or "").strip()
            title_en = (data.get("title_en") or "").strip()
            subtitle_en = (data.get("subtitle_en") or "").strip()
            content_en = (data.get("content_en") or "").strip()
            
            # Validate
            if not title or not content:
                raise ValueError("Title dan content harus diisi")
            if not title_en or not content_en:
                raise ValueError("Title EN dan content EN harus diisi")
            
            # Check if record exists
            existing = supa.table("why_section").select("*").limit(1).execute()
            
            update_data = {
                "title": title,
                "subtitle": subtitle if subtitle else None,
                "content": content,
                "title_en": title_en,
                "subtitle_en": subtitle_en if subtitle_en else None,
                "content_en": content_en
            }
            
            if existing.data and len(existing.data) > 0:
                # Update existing record
                result = supa.table("why_section").update(update_data).eq("id", existing.data[0]["id"]).execute()
                print("[WHY_SECTION_UPDATE] ✅ Updated existing record")
            else:
                # Insert new record
                result = supa.table("why_section").insert(update_data).execute()
                print("[WHY_SECTION_UPDATE] ✅ Inserted new record")
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            response = {
                "ok": True,
                "message": "Why Section berhasil diupdate",
                "data": result.data[0] if result.data else update_data
            }
            
            self.wfile.write(json.dumps(response).encode())
            print("[WHY_SECTION_UPDATE] ✅ Success")
            
        except Exception as e:
            print(f"[WHY_SECTION_UPDATE] ❌ Error: {e}")
            import traceback
            traceback.print_exc()
            
            self.send_response(500)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            self.wfile.write(json.dumps({
                "ok": False,
                "error": str(e)
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
