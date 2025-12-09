from http.server import BaseHTTPRequestHandler
import json
import traceback
from urllib.parse import parse_qs, urlparse
from .._supabase import supabase_client
from typing import Any, Dict

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/pendaftar_cek_status?nisn=1234567890
        Response: { ok: true, data: {...} | null }
        """
        def send_json(code: int, payload: Dict[str, Any]) -> None:
            """Send JSON response"""
            try:
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(payload, default=str).encode())
            except Exception as e:
                print(f"Error sending JSON: {e}")
        
        try:
            print(f"[CEK_STATUS] Request path: {self.path}")
            
            # Helper to normalize NISN/NIK (keep digits only)
            def normalize_nisn(value: str) -> str:
                return "".join(ch for ch in value if ch.isdigit())

            # Parse query parameters
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            raw_nisn = (params.get("nisn", [""])[0] or "").strip()
            normalized_nisn = normalize_nisn(raw_nisn)
            
            print(f"[CEK_STATUS] NISN raw: {raw_nisn}, normalized: {normalized_nisn}")

            # Validasi: identifier wajib diisi
            if not raw_nisn:
                print("[CEK_STATUS] Error: NISN kosong")
                return send_json(400, {
                    "ok": False,
                    "error": "NISN harus diisi"
                })

            # Validasi: identifier harus 10 digit (NISN) atau 16 digit (NIK)
            if len(normalized_nisn) not in (10, 16):
                print(f"[CEK_STATUS] Error: Identifier invalid format - {raw_nisn}")
                return send_json(400, {
                    "ok": False,
                    "error": "Format identifier tidak valid (masukkan NISN 10 digit atau NIK 16 digit)"
                })

            print("[CEK_STATUS] Connecting to Supabase...")
            
            # Query Supabase dengan SERVICE_ROLE
            try:
                supa = supabase_client(service_role=True)
                print("[CEK_STATUS] Supabase client created")
            except Exception as e:
                print(f"[CEK_STATUS] Error creating Supabase client: {e}")
                return send_json(500, {
                    "ok": False,
                    "error": "Database connection error",
                    "detail": str(e)
                })

            identifiers = []
            if normalized_nisn:
                identifiers.append(normalized_nisn)
            if raw_nisn and raw_nisn != normalized_nisn:
                identifiers.append(raw_nisn)
            identifiers = list(dict.fromkeys([candidate for candidate in identifiers if candidate]))

            row = None
            selected_identifier = None
            search_fields = ("nisn", "nik", "nikcalon")
            print(f"[CEK_STATUS] Searching pendaftar using identifiers={identifiers}")
            for field in search_fields:
                for candidate in identifiers:
                    try:
                        result = supa.table("pendaftar").select("*").eq(field, candidate).order("updatedat", desc=True).limit(1).execute()
                    except Exception as e:
                        print(f"[CEK_STATUS] Error querying pendaftar field={field} candidate={candidate}: {e}")
                        traceback.print_exc()
                        continue

                    if result.data:
                        row = result.data[0]
                        selected_identifier = candidate
                        print(f"[CEK_STATUS] Match found using field={field}, candidate={candidate}")
                        break
                if row is not None:
                    break

            if row is None:
                print("[CEK_STATUS] NISN tidak ditemukan")
                return send_json(200, {
                    "ok": True,
                    "data": None
                })

            print(f"[CEK_STATUS] Found data for: {row.get('namalengkap')}")
            print(f"[CEK_STATUS] Catatan Admin (alasan): {row.get('alasan')}")

            # Query data pembayaran juga
            pembayaran_data = None
            try:
                payment_identifiers = identifiers.copy()
                for field in search_fields:
                    value = row.get(field)
                    if value:
                        payment_identifiers.append(str(value).strip())
                payment_identifiers = list(dict.fromkeys([val for val in payment_identifiers if val]))

                print(f"[CEK_STATUS] Searching pembayaran using identifiers={payment_identifiers}")
                pembayaran_row = None
                for field in ("nisn", "nik"):
                    for candidate in payment_identifiers:
                        try:
                            pembayaran_result = supa.table("pembayaran").select("*").eq(field, candidate).order("updated_at", desc=True).limit(1).execute()
                        except Exception as e:
                            print(f"[CEK_STATUS] Error querying pembayaran field={field} candidate={candidate}: {e}")
                            traceback.print_exc()
                            continue

                        if pembayaran_result.data:
                            pembayaran_row = pembayaran_result.data[0]
                            print(f"[CEK_STATUS] Pembayaran match using field={field}, candidate={candidate}")
                            break
                    if pembayaran_row is not None:
                        break

                if pembayaran_row:
                    pembayaran_data = {
                        "nisn": pembayaran_row.get("nisn", ""),
                        "nik": pembayaran_row.get("nik", ""),
                        "nama": pembayaran_row.get("nama") or pembayaran_row.get("nama_lengkap", ""),
                        "metode_pembayaran": pembayaran_row.get("metode_pembayaran", ""),
                        "jumlah": pembayaran_row.get("jumlah", 0),
                        "bukti_bayar_url": pembayaran_row.get("bukti_bayar_url") or pembayaran_row.get("bukti_pembayaran", ""),
                        "status_pembayaran": pembayaran_row.get("status_pembayaran", "PENDING"),
                        "verified_by": pembayaran_row.get("verified_by", ""),
                        "catatan_admin": pembayaran_row.get("catatan_admin", ""),
                        "tanggal_verifikasi": pembayaran_row.get("tanggal_verifikasi"),
                        "created_at": pembayaran_row.get("created_at"),
                        "updated_at": pembayaran_row.get("updated_at")
                    }
                    print(f"[CEK_STATUS] Pembayaran found: status={pembayaran_data['status_pembayaran']}")
                else:
                    print("[CEK_STATUS] Pembayaran belum ada untuk NISN ini")
            except Exception as e:
                print(f"[CEK_STATUS] Warning: Error querying pembayaran: {e}")
                # Continue even if pembayaran query fails

            # Transform sesuai spec
            data = {
                "id": row.get("id"),
                "nisn": row.get("nisn", "") or selected_identifier or normalized_nisn,
                "nik": row.get("nik"),
                "nikcalon": row.get("nikcalon"),
                "nama": row.get("namalengkap", ""),
                "tanggalLahir": row.get("tanggallahir"),
                "tempatLahir": row.get("tempatlahir"),
                "status": row.get("statusberkas") or "PENDING",
                "alasan": row.get("alasan"),  # Catatan admin
                "verified_by": row.get("verifiedby"),
                "verified_at": row.get("verifiedat"),
                "created_at": row.get("createdat"),
                "createdat": row.get("createdat"),  # Add both formats for compatibility
                "updated_at": row.get("updatedat"),
                "telepon_orang_tua": (
                    row.get("telepon_orang_tua")
                    or row.get("teleponorangtua")
                    or row.get("nomorhportu")
                    or ""
                ),
                "telepon": (
                    row.get("telepon_orang_tua")
                    or row.get("teleponorangtua")
                    or row.get("nomorhportu")
                    or ""
                ),
                "pembayaran": pembayaran_data  # Tambahkan data pembayaran
            }

            print("[CEK_STATUS] Sending success response")
            return send_json(200, {"ok": True, "data": data})

        except Exception as e:
            print(f"[CEK_STATUS] Unexpected error: {str(e)}")
            traceback.print_exc()
            return send_json(500, {
                "ok": False,
                "error": "Internal server error",
                "detail": str(e)
            })

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
