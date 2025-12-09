from http.server import BaseHTTPRequestHandler
import json
from typing import Any, Dict
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_PATCH(self):
        """
        PATCH /api/pendaftar_status
        Body: { id: 123, status: "diterima" | "ditolak" | "pending" | "revisi", alasan?: "...", verifiedBy?: "admin@email.com" }
        Response: { success: true }
        """
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
            
            # Validasi input wajib
            if not data.get('id'):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "id is required"
                }).encode())
                return
                
            if not data.get('status'):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "status is required"
                }).encode())
                return
            
            p_id = data["id"]
            p_status_input = data["status"]
            
            # Normalisasi status input (support both uppercase and lowercase)
            if isinstance(p_status_input, str):
                p_status_normalized = p_status_input.upper()
            else:
                p_status_normalized = str(p_status_input).upper()
                
            p_alasan = data.get("alasan", None)
            p_verified_by = data.get("verifiedBy", data.get("verifiedby", "admin"))
            
            # Map status ke nilai yang valid
            status_mapping = {
                'PENDING': 'PENDING',
                'REVISI': 'REVISI',
                'DITERIMA': 'DITERIMA',
                'DITOLAK': 'DITOLAK',
                'pending': 'PENDING',
                'revisi': 'REVISI',
                'diterima': 'DITERIMA',
                'ditolak': 'DITOLAK'
            }
            
            p_status = status_mapping.get(p_status_normalized, p_status_normalized)
            
            # Validasi status value
            valid_statuses = ['PENDING', 'REVISI', 'DITERIMA', 'DITOLAK']
            if p_status not in valid_statuses:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
                }).encode())
                return
            
            # Update dengan service-role
            supa = supabase_client(service_role=True)
            
            # Prepare update payload dengan field yang konsisten
            update_payload: Dict[str, Any] = {
                "statusberkas": p_status,
            }
            
            # Add alasan/catatan if provided
            if p_alasan:
                update_payload["alasan"] = p_alasan
            
            # Add verified information for non-pending status
            if p_status != 'PENDING':
                update_payload["verifiedby"] = p_verified_by
                update_payload["verifiedat"] = "now()"  # Timestamp verifikasi
            
            # Execute update
            result = supa.table("pendaftar").update(update_payload).eq("id", p_id).execute()
            
            # Validasi hasil update
            if not result.data:  # type: ignore
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "Pendaftar tidak ditemukan"
                }).encode())
                return
            
            # Get FULL pendaftar data for response (untuk WhatsApp manual di frontend)
            # Update query mungkin tidak return semua field, jadi query lagi untuk dapat semua field
            print(f"[VERIFIKASI] Fetching full pendaftar data for ID: {p_id}")
            full_data_result = supa.table("pendaftar").select("*").eq("id", p_id).execute()
            
            if full_data_result.data:
                pendaftar_data = full_data_result.data[0]
                print(f"[VERIFIKASI] Full data fetched. Available fields: {list(pendaftar_data.keys())}")
            else:
                pendaftar_data = result.data[0] if result.data else None
                print(f"[VERIFIKASI] Using update result data")
            
            # Response success
            response_data = {
                "success": True,
                "message": f"Status pendaftar berhasil diubah menjadi {p_status}"
            }
            
            # Include pendaftar data jika status DITERIMA (untuk WhatsApp manual)
            if p_status == 'DITERIMA' and pendaftar_data:
                # Get phone number from multiple possible field names
                telepon = (
                    pendaftar_data.get('telepon_orang_tua') or 
                    pendaftar_data.get('teleponorangtua') or 
                    pendaftar_data.get('nomorhportu') or 
                    pendaftar_data.get('nomorhp') or 
                    ''
                )
                
                print(f"[VERIFIKASI] Phone number found: {telepon[:6] if telepon else 'NONE'}...")
                
                response_data["pendaftar"] = {
                    "nama": pendaftar_data.get('namalengkap', ''),
                    "nisn": pendaftar_data.get('nisn', ''),
                    "telepon": telepon,
                }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": str(e)
            }).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()