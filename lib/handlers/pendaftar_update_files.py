from http.server import BaseHTTPRequestHandler
import json
import re
from lib._supabase import supabase_client


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode("utf-8"))

            pendaftar_id = data.get("id")
            if not pendaftar_id:
                self.send_response(400)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"ok": False, "error": "ID required"}).encode()
                )
                return

            # Prepare update data dengan validasi
            update_data = {}
            if data.get("file_ijazah"):
                # Validasi URL file_ijazah
                if data["file_ijazah"].startswith(('http://', 'https://')):
                    update_data["file_ijazah"] = data["file_ijazah"]
                else:
                    self.send_response(400)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({"ok": False, "error": "URL file_ijazah tidak valid"}).encode()
                    )
                    return
                    
            if data.get("file_akta"):
                # Validasi URL file_akta
                if data["file_akta"].startswith(('http://', 'https://')):
                    update_data["file_akta"] = data["file_akta"]
                else:
                    self.send_response(400)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({"ok": False, "error": "URL file_akta tidak valid"}).encode()
                    )
                    return
                    
            if data.get("file_foto"):
                # Validasi URL file_foto
                if data["file_foto"].startswith(('http://', 'https://')):
                    update_data["file_foto"] = data["file_foto"]
                else:
                    self.send_response(400)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({"ok": False, "error": "URL file_foto tidak valid"}).encode()
                    )
                    return
                    

            if data.get("file_kk"):
                # Validasi URL file_kk
                if data["file_kk"].startswith(('http://', 'https://')):
                    update_data["file_kk"] = data["file_kk"]
                else:
                    self.send_response(400)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({"ok": False, "error": "URL file_kk tidak valid"}).encode()
                    )
                    return
                    
            if data.get("file_bpjs"):
                # Validasi URL file_bpjs (opsional)
                if data["file_bpjs"].startswith(('http://', 'https://')):
                    update_data["file_bpjs"] = data["file_bpjs"]
                else:
                    self.send_response(400)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({"ok": False, "error": "URL file_bpjs tidak valid"}).encode()
                    )
                    return

            if not update_data:
                self.send_response(400)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"ok": False, "error": "No valid files to update"}).encode()
                )
                return

            # Get Supabase client with service role for admin operations
            supa = supabase_client(service_role=True)
            
            # Update in Supabase dengan timestamp yang konsisten
            update_data["updatedat"] = "now()"
            response = (
                supa.table("pendaftar")
                .update(update_data)
                .eq("id", pendaftar_id)
                .execute()
            )

            # Validasi hasil update
            if not response.data:
                self.send_response(404)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"ok": False, "error": "Pendaftar tidak ditemukan"}).encode()
                )
                return

            # Return success
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "message": "File berhasil diupdate"}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps({"ok": False, "error": str(e)}).encode()
            )

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()