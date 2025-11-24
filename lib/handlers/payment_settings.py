from http.server import BaseHTTPRequestHandler
import json
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Fetch payment settings"""
        try:
            supa = supabase_client()
            # Fetch the single row (id=1)
            result = supa.table("payment_settings").select("*").eq("id", 1).single().execute()
            
            data = result.data if result.data else {}
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "data": data}).encode())
            
        except Exception as e:
            print(f"Error fetching payment settings: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

    def do_POST(self):
        """Update payment settings"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            # Extract fields
            payload = {
                "bank_name": data.get("bank_name"),
                "bank_account": data.get("bank_account"),
                "bank_holder": data.get("bank_holder"),
                "nominal": data.get("nominal"), # For bank transfer
                "qris_image_url": data.get("qris_image_url"),
                "qris_nominal": data.get("qris_nominal"),
                "qris_data": data.get("qris_data"),
                "updated_at": "now()"
            }
            
            # Remove None values to avoid overwriting with null if not sent
            payload = {k: v for k, v in payload.items() if v is not None}
            
            supa = supabase_client(service_role=True) # Use service role for updates
            
            # Upsert row with id=1
            payload["id"] = 1
            result = supa.table("payment_settings").upsert(payload).execute()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "data": result.data}).encode())
            
        except Exception as e:
            print(f"Error updating payment settings: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
