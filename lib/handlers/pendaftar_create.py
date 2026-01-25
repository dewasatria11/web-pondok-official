from http.server import BaseHTTPRequestHandler
import json
import re
import os
from typing import Any, Dict, Tuple, List
import requests
from lib._supabase import supabase_client


def _pick_client_ip(headers) -> str:
    try:
        # Prefer Cloudflare/Vercel forwarding headers when available
        cf = headers.get("cf-connecting-ip")
        if cf:
            return str(cf).split(",")[0].strip()
        xff = headers.get("x-forwarded-for")
        if xff:
            return str(xff).split(",")[0].strip()
    except Exception:
        pass
    return ""


def _turnstile_error_message(codes: List[str]) -> str:
    normalized = [str(c).strip() for c in (codes or []) if str(c).strip()]
    if not normalized:
        return "Verifikasi CAPTCHA gagal"

    # Common Turnstile error codes:
    # - timeout-or-duplicate
    # - invalid-input-response
    # - missing-input-response
    # - invalid-input-secret
    # - bad-request
    mapping = {
        "missing-input-response": "CAPTCHA belum terisi. Silakan verifikasi terlebih dahulu.",
        "invalid-input-response": "CAPTCHA tidak valid. Silakan coba lagi.",
        "timeout-or-duplicate": "CAPTCHA kedaluwarsa / sudah dipakai. Silakan verifikasi ulang.",
        "invalid-input-secret": "Konfigurasi CAPTCHA server salah. Hubungi admin.",
        "bad-request": "Permintaan verifikasi CAPTCHA tidak valid. Silakan refresh dan coba lagi.",
    }
    # Return the first mapped message if present
    for code in normalized:
        if code in mapping:
            return mapping[code]
    return "Verifikasi CAPTCHA gagal"


def verify_turnstile(token: str, remote_ip: str = "") -> Tuple[bool, str, List[str]]:
    """
    Verifikasi token Cloudflare Turnstile.
    Return (success, message)
    """
    secret_key = (
        os.getenv("TURNSTILE_SECRET_KEY")
        or os.getenv("CLOUDFLARE_TURNSTILE_SECRET_KEY")
        or "0x4AAAAAACDDkPTYaJhn5UrQqHPSd5xEEEE"
    )
    url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    if not token:
        return False, "Token CAPTCHA tidak ditemukan", ["missing-input-response"]

    try:
        payload = {"secret": secret_key, "response": token}
        if remote_ip:
            payload["remoteip"] = remote_ip

        # Intermittent network issues can be more common on serverless edges;
        # retry once for transient HTTP/timeout errors.
        last_exc: Exception | None = None
        for attempt, timeout_s in enumerate((10, 15), start=1):
            try:
                resp = requests.post(url, data=payload, timeout=timeout_s)
                # Retry on transient upstream errors
                if resp.status_code in (429,) or resp.status_code >= 500:
                    resp.raise_for_status()
                result = resp.json()
                codes = result.get("error-codes", []) or []
                success = bool(result.get("success"))
                if success:
                    return True, "OK", []
                return (
                    False,
                    _turnstile_error_message(codes),
                    list(codes) if isinstance(codes, list) else [str(codes)],
                )
            except requests.exceptions.RequestException as exc:
                last_exc = exc
                if attempt == 2:
                    raise
                continue
        if last_exc:
            raise last_exc
    except Exception as exc:
        print(f"[TURNSTILE] Error: {exc}")
        return False, "Gagal memverifikasi CAPTCHA", ["verify-failed"]

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

            # Verify Cloudflare Turnstile
            captcha_token = data.get("cf-turnstile-response") or data.get("cf_turnstile_response")
            client_ip = _pick_client_ip(self.headers)
            is_human, captcha_message, captcha_codes = verify_turnstile(captcha_token, client_ip)
            if not is_human:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": False,
                    "error": "Verifikasi CAPTCHA gagal. Silakan coba lagi.",
                    "details": captcha_message,
                    "codes": captcha_codes
                }).encode())
                return
            
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
                errors.append(f"NIK Calon harus 16 digit angka (received: {nik_calon})")
            
            # Validasi NIK Ayah (16 digit)
            nik_ayah = str(data["nikAyah"]).strip()
            if not re.match(r'^\d{16}$', nik_ayah):
                errors.append(f"NIK Ayah harus 16 digit angka (received: {nik_ayah})")
                
            # Validasi NIK Ibu (16 digit)
            nik_ibu = str(data["nikIbu"]).strip()
            if not re.match(r'^\d{16}$', nik_ibu):
                errors.append(f"NIK Ibu harus 16 digit angka (received: {nik_ibu})")
            
            # Validasi NISN (10 digit)
            nisn = str(data["nisn"]).strip()
            if not re.match(r'^\d{10}$', nisn):
                errors.append(f"NISN harus 10 digit angka (received: {nisn})")
            
            # Validasi jenis kelamin
            jenis_kelamin = data["jenisKelamin"]
            if jenis_kelamin not in ['L', 'P']:
                errors.append(f"Jenis kelamin harus 'L' atau 'P' (received: {jenis_kelamin})")
            
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
                    errors.append(f"Nomor telepon harus diawali 0 dan terdiri dari 10-13 digit (received: {telepon})")
            
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

            # Map namaSekolahAsal -> sekolahdomisili
            if data.get("namaSekolahAsal"):
                payload["sekolahdomisili"] = data.get("namaSekolahAsal", "").strip()
            
            # Log nomorKIP (not saving to DB yet as column missing)
            if data.get("nomorKIP"):
                print(f"[PENDAFTAR_CREATE] Received nomorKIP: {data.get('nomorKIP')}")

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
