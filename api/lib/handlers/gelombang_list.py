from http.server import BaseHTTPRequestHandler
import json
from lib._supabase import supabase_client


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/get_gelombang_list
        Response: Array of gelombang data
        """
        try:
            # Get Supabase client with service role
            supa = supabase_client(service_role=True)
            
            # Query gelombang table
            result = (
                supa.table("gelombang")
                .select("id,nama,start_date,end_date,tahun_ajaran,is_active,urutan")
                .order("urutan", desc=False)
                .execute()
            )
            
            gelombang_list = result.data if result.data else []
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": True,
                    "data": gelombang_list
                }).encode('utf-8')
            )
            
            print(f"✓ Gelombang list fetched: {len(gelombang_list)} items")

        except Exception as e:
            print(f"Error in get_gelombang_list: {e}")
            import traceback
            traceback.print_exc()
            
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": False,
                    "error": str(e)
                }).encode('utf-8')
            )

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

