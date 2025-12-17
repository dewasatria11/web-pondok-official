"""
API Handler: GET /api/hero_carousel_list
Fetch all hero carousel images (santri PNG) for the homepage slider
"""
from http.server import BaseHTTPRequestHandler
import json
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            print("[HERO_CAROUSEL_LIST] Fetching hero carousel images...")
            
            # Get Supabase client with service role
            supa = supabase_client(service_role=True)
            
            # Fetch all active hero carousel images, ordered by slide_order ASC
            result = (
                supa.table("hero_carousel_images")
                .select("slide_order,image_url,alt_text")
                .eq("is_active", True)
                .order("slide_order")
                .execute()
            )
            
            print(f"[HERO_CAROUSEL_LIST] Found {len(result.data) if result.data else 0} active images")
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600")
            self.end_headers()
            
            response = {
                "ok": True,
                "data": result.data if result.data else [],
                "count": len(result.data) if result.data else 0
            }
            
            self.wfile.write(json.dumps(response).encode())
            print("[HERO_CAROUSEL_LIST] ✅ Success")
            
        except Exception as e:
            print(f"[HERO_CAROUSEL_LIST] ❌ Error: {e}")
            
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
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
