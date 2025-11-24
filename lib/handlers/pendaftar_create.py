from http.server import BaseHTTPRequestHandler
import json
import re
from typing import Any, Dict
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/pendaftar_create
        Body: Comprehensive registration data with NIK, family info, education, etc.
        Response: { ok: true, id: ..., nisn: ... }
        """
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
            
            # Validasi data wajib (NIK Calon is optional based on schema)
            required_fields = [
                "nisn", "namaLengkap", "tempatLahir", "tanggalLahir", 
                "jenisKelamin", "alamatJalan", "desa", "kecamatan", 
                "kotaKabupaten", "provinsi", "ijazahFormalTerakhir",
                "rencanaTingkat", "rencanaProgram", "namaAyah", 
                "nikAyah", "statusAyah", "pekerjaanAyah", "namaIbu", 
                "nikIbu", "statusIbu", "pekerjaanIbu", "nikCalon"
            ]
            
            missing_fields = [field for field in required_fields if not data.get(field)]
            if missing_fields:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": False,
                    "error": f"Missing required fields: {', '.join(missing_fields)}"
                }).encode())
                return
            
            # Validasi format data
            errors = []
            
            # Validasi NIK calon (16 digit) - Required
            nik_calon = str(data["nikCalon"]).strip()
            if not re.match(r'^\d{16}$', nik_calon):
                errors.append("NIK Calon harus 16 digit angka")
            
            # Validasi NIK Ayah (16 digit)
            nik_ayah = str(data["nikAyah"]).strip()
            if not re.match(r'^\d{16}$', nik_ayah):
                errors.append("NIK Ayah harus 16 digit angka")
                
            # Validasi NIK Ibu (16 digit)
            nik_ibu = str(data["nikIbu"]).strip()
            if not re.match(r'^\d{16}$', nik_ibu):
                errors.append("NIK Ibu harus 16 digit angka")
            
            # Validasi NISN (10 digit)
            nisn = str(data["nisn"]).strip()
            if not re.match(r'^\d{10}$', nisn):
                errors.append("NISN harus 10 digit angka")
            
            # Validasi jenis kelamin
            jenis_kelamin = data["jenisKelamin"]
            if jenis_kelamin not in ['L', 'P']:
                errors.append("Jenis kelamin harus 'L' atau 'P'")
            
            # Validasi format tanggal lahir
            try:
                tanggal_lahir = data["tanggalLahir"]  # Harus dalam format YYYY-MM-DD
                # Bisa ditambahkan validasi tanggal lebih lanjut jika diperlukan
            except:
                errors.append("Format tanggal lahir tidak valid (harus YYYY-MM-DD)")
            
            # Validasi telepon orang tua jika ada
            if data.get("teleponOrtu"):
                telepon = str(data["teleponOrtu"]).strip()
                if not re.match(r'^0\d{9,12}$', telepon):
                    errors.append("Nomor telepon harus diawali 0 dan terdiri dari 10-13 digit")
            
            # Jika ada error validasi, kirim response error
            if errors:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": False,
                    "error": "Validasi gagal",
                    "details": errors
                }).encode())
                return
            
            # Prepare payload with all required fields (use lowercase for PostgreSQL)
            payload = {
                "nikcalon": nik_calon,
                "nisn": nisn,
                "namalengkap": data["namaLengkap"].strip(),
                "tempatlahir": data["tempatLahir"].strip(),
                "tanggallahir": tanggal_lahir, # type: ignore
                "jeniskelamin": jenis_kelamin,
                "alamatjalan": data["alamatJalan"].strip(),
                "desa": data["desa"].strip(),
                "kecamatan": data["kecamatan"].strip(),
                "kotakabupaten": data["kotaKabupaten"].strip(),
                "provinsi": data["provinsi"].strip(),
                "ijazahformalterakhir": data["ijazahFormalTerakhir"].strip(),
                "rencanatingkat": data["rencanaTingkat"].strip(),
                "rencanaprogram": data["rencanaProgram"].strip(),
                "namaayah": data["namaAyah"].strip(),
                "nikayah": nik_ayah,
                "statusayah": data["statusAyah"].strip(),
                "pekerjaanayah": data["pekerjaanAyah"].strip(),
                "namaibu": data["namaIbu"].strip(),
                "nikibu": nik_ibu,
                "statusibu": data["statusIbu"].strip(),
                "pekerjaanibu": data["pekerjaanIbu"].strip(),
                "pekerjaanibu": data["pekerjaanIbu"].strip(),
                "statusberkas": "PENDING",  # Set default status
                "gelombang": data.get("gelombang", "").strip() # Add gelombang
            }
            
            # Add optional fields if provided
            if data.get("teleponOrtu"):
                payload["telepon_orang_tua"] = data.get("teleponOrtu", "").strip()
            
            # Add provinsi tempat lahir if provided
            if data.get("provinsiTempatLahir"):
                payload["provinsitempatlahir"] = data.get("provinsiTempatLahir", "").strip()
            
            # Insert to Supabase using ANON_KEY (public registration, allowed by RLS)
            supa = supabase_client(service_role=False)  # Use ANON_KEY
            
            print(f"[PENDAFTAR_CREATE] Inserting payload with NISN: {payload.get('nisn')}")
            print(f"[PENDAFTAR_CREATE] Payload keys: {list(payload.keys())}")
            
            result = supa.table("pendaftar").insert(payload).execute()
            
            print(f"[PENDAFTAR_CREATE] Insert result.data: {result.data}")
            
            if not result.data:  # type: ignore
                print("[PENDAFTAR_CREATE] ERROR: result.data is empty!")
                raise Exception("Failed to create pendaftar - database insert returned no data")
            
            result_data: Dict[str, Any] = result.data[0]  # type: ignore
            
            print(f"[PENDAFTAR_CREATE] result_data keys: {list(result_data.keys())}")
            print(f"[PENDAFTAR_CREATE] result_data['nisn']: {result_data.get('nisn')}")
            print(f"[PENDAFTAR_CREATE] result_data['id']: {result_data.get('id')}")
            
            # Response success - Use NISN as registration number
            response_payload = {
                "ok": True,
                "id": result_data.get("id"),
                "nisn": result_data.get("nisn")
            }
            
            print(f"[PENDAFTAR_CREATE] Sending response: {response_payload}")
            
            self.send_response(201)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_payload).encode())
            
        except Exception as e:
            print(f"[PENDAFTAR_CREATE] ❌ EXCEPTION: {str(e)}")
            print(f"[PENDAFTAR_CREATE] Exception type: {type(e).__name__}")
            
            import traceback
            print(f"[PENDAFTAR_CREATE] Traceback:")
            traceback.print_exc()
            
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "ok": False,
                "error": str(e)
            }).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()