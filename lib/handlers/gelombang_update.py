from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
from lib._supabase import supabase_client


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/update_gelombang
        Body: { id: number, nama: string, nama_en: string, start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD", tahun_ajaran: "2026/2027" }
        Response: Updated gelombang row
        """
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False,
                        "error": "Request body is required"
                    }).encode('utf-8')
                )
                return

            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
            
            # Validate required fields
            gelombang_id = data.get('id')
            nama = data.get('nama')  # Indonesian name
            nama_en = data.get('nama_en')  # English name (optional)
            start_date = data.get('start_date')
            end_date = data.get('end_date')
            tahun_ajaran = data.get('tahun_ajaran')
            
            # nama, start_date, end_date, tahun_ajaran are required
            # nama_en is optional for backward compatibility
            if not all([gelombang_id, nama, start_date, end_date, tahun_ajaran]):
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False,
                        "error": "Missing required fields: id, nama, start_date, end_date, tahun_ajaran"
                    }).encode('utf-8')
                )
                return
            
            # Validate date range: start_date <= end_date
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d')
                end = datetime.strptime(end_date, '%Y-%m-%d')
                
                if start > end:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({
                            "ok": False,
                            "error": "start_date harus lebih kecil atau sama dengan end_date"
                        }).encode('utf-8')
                    )
                    return
            except ValueError as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False,
                        "error": f"Invalid date format: {str(e)}"
                    }).encode('utf-8')
                )
                return
            
            # Get Supabase client with service role
            supa = supabase_client(service_role=True)
            
            # Prepare update data
            update_data = {
                "nama": nama,
                "start_date": start_date,
                "end_date": end_date,
                "tahun_ajaran": tahun_ajaran,
                "updated_at": datetime.now().isoformat()
            }
            
            # Add nama_en only if provided (optional field)
            if nama_en:
                update_data["nama_en"] = nama_en
            
            # Update gelombang
            result = (
                supa.table("gelombang")
                .update(update_data)
                .eq("id", gelombang_id)
                .execute()
            )
            
            if not result.data:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False,
                        "error": f"Gelombang dengan id {gelombang_id} tidak ditemukan"
                    }).encode('utf-8')
                )
                return
            
            updated_gelombang = result.data[0]
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": True,
                    "data": updated_gelombang,
                    "message": f"Gelombang {updated_gelombang.get('nama', '')} berhasil diupdate"
                }).encode('utf-8')
            )
            
            print(f"✓ Gelombang updated: id={gelombang_id}")

        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": False,
                    "error": "Invalid JSON format"
                }).encode('utf-8')
            )
        except Exception as e:
            print(f"Error in update_gelombang: {e}")
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
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

