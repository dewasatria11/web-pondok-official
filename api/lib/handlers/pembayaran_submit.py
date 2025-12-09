from http.server import BaseHTTPRequestHandler
import json
from lib._supabase import supabase_client
import datetime
import time
import re

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
                    'bukti_pembayaran': bukti_pembayaran,
                    'status_pembayaran': 'PENDING',
                    'catatan_admin': data.get('catatan', ''),
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
                    'jumlah': 500000.00,
                    'metode_pembayaran': 'Transfer Bank BRI',
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