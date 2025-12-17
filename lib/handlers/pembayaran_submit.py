from http.server import BaseHTTPRequestHandler
import json
from lib._supabase import supabase_client
import datetime
import time
import re

def _safe_amount(value):
    """
    Parse amount to float.
    Accepts numeric or strings like "Rp 500.000".
    Returns None when invalid/empty.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        raw = str(value).strip()
    except Exception:
        return None
    if not raw:
        return None
    digits = re.sub(r"[^\d]", "", raw)
    if not digits:
        return None
    try:
        return float(int(digits))
    except Exception:
        return None

def _normalize_metode(value):
    raw = (str(value or "").strip().lower())
    if raw in ("qris", "qr", "qrcode", "kodeqr"):
        return "qris"
    if raw in ("bank", "transfer", "tf", "rekening"):
        return "bank"
    # Default aman (UI lama mungkin belum kirim)
    return "bank"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Validasi required fields dengan pengecekan lebih ketat
            required_fields = ['nisn', 'nama_lengkap', 'bukti_pembayaran']
            missing_fields = []
            for field in required_fields:
                if field not in data or not data[field]:
                    missing_fields.append(field)
            
            if missing_fields:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': f'Required fields missing: {", ".join(missing_fields)}'
                }).encode())
                return
            
            # Validasi format NISN (10 digit)
            nisn = data['nisn'].strip()
            print(f"[PEMBAYARAN_SUBMIT] NISN: {nisn}")
            
            if not re.match(r'^\d{10}$', nisn):
                print(f"[PEMBAYARAN_SUBMIT] Invalid NISN format: {nisn}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Format NISN tidak valid. Harus 10 digit angka'
                }).encode())
                return
            
            # Validasi nama lengkap
            nama_lengkap = data['nama_lengkap'].strip()
            if len(nama_lengkap) < 3:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Nama lengkap minimal 3 karakter'
                }).encode())
                return
            
            # Validasi bukti pembayaran (harus URL)
            bukti_pembayaran = data['bukti_pembayaran'].strip()
            if not bukti_pembayaran.startswith(('http://', 'https://')):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Bukti pembayaran harus berupa URL yang valid'
                }).encode())
                return
            
            # Get Supabase client with service role for admin operations
            supa = supabase_client(service_role=True)

            # Ambil payment settings (untuk fallback jumlah/metode label)
            settings = {}
            try:
                sres = (
                    supa.table("payment_settings")
                    .select("*")
                    .eq("id", 1)
                    .single()
                    .execute()
                )
                settings = sres.data or {}
            except Exception as _:
                settings = {}

            metode_kode = _normalize_metode(
                data.get("metode_pembayaran")
                or data.get("metode")
                or data.get("payment_method")
            )

            jumlah = _safe_amount(data.get("jumlah"))
            if jumlah is None:
                if metode_kode == "qris":
                    jumlah = _safe_amount(settings.get("qris_nominal")) or _safe_amount(settings.get("nominal"))
                else:
                    jumlah = _safe_amount(settings.get("nominal")) or _safe_amount(settings.get("qris_nominal"))
            if jumlah is None or jumlah <= 0:
                jumlah = 500000.0

            if metode_kode == "qris":
                metode_label = "QRIS"
            else:
                bank_name = str(settings.get("bank_name") or "").strip()
                metode_label = f"Transfer Bank {bank_name}".strip() if bank_name else "Transfer Bank"
            
            # Check if pendaftar exists berdasarkan NISN
            pendaftar = supa.table('pendaftar').select('*').eq('nisn', nisn).execute()
            
            pendaftar_data = getattr(pendaftar, 'data', None)
            if not pendaftar_data:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'NISN tidak ditemukan di database pendaftar'
                }).encode())
                return
            
            # Check if payment already exists berdasarkan NISN
            existing_payment = supa.table('pembayaran').select('*').eq('nisn', nisn).execute()
            
            existing_data = getattr(existing_payment, 'data', None)
            if existing_data:
                # Update existing payment
                print(f"[PEMBAYARAN_SUBMIT] Updating existing payment for NISN: {nisn}")
                result = supa.table('pembayaran').update({
                    'jumlah': jumlah,
                    'metode_pembayaran': metode_label,
                    'bukti_pembayaran': bukti_pembayaran,
                    'status_pembayaran': 'PENDING',
                    'catatan_admin': data.get('catatan', ''),
                    'tanggal_upload': 'now()',  # Update timestamp upload bukti
                    'updated_at': 'now()'  # Update timestamp
                }).eq('nisn', nisn).execute()
                
                print(f"[PEMBAYARAN_SUBMIT] Payment updated successfully for NISN: {nisn}")
                response_data = {
                    'message': 'Pembayaran berhasil diupdate',
                    'nisn': nisn,
                    'status': 'updated'
                }
            else:
                # Insert new payment dengan field yang konsisten
                print(f"[PEMBAYARAN_SUBMIT] Creating new payment for NISN: {nisn}")
                payment_data = {
                    'nisn': nisn,
                    'nik': None,  # NIK tidak wajib, set NULL untuk avoid constraint violation
                    'nama_lengkap': nama_lengkap,
                    'jumlah': jumlah,
                    'metode_pembayaran': metode_label,
                    'bukti_pembayaran': bukti_pembayaran,
                    'status_pembayaran': 'PENDING',
                    'catatan_admin': data.get('catatan', ''),
                    'tanggal_upload': 'now()',  # Set timestamp upload
                    'created_at': 'now()',       # Set timestamp dibuat
                    'updated_at': 'now()'        # Set timestamp diupdate
                }
                
                print(f"[PEMBAYARAN_SUBMIT] Payment data: nisn={nisn}, nik=None, nama={nama_lengkap}")
                result = supa.table('pembayaran').insert(payment_data).execute()
                
                print(f"[PEMBAYARAN_SUBMIT] Payment created successfully for NISN: {nisn}")
                response_data = {
                    'message': 'Pembayaran berhasil disubmit',
                    'nisn': nisn,
                    'status': 'created'
                }
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            print(f"Error in pembayaran_submit: {str(e)}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': str(e)
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
