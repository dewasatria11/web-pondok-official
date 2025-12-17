from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import parse_qs, urlparse
from lib._supabase import supabase_client

def safe_float(value, default=0.0):
    """
    Convert value to float safely.
    Supabase rows might have NULL jumlah (None) which would raise TypeError.
    """
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            q = (params.get("q", [""])[0] or "").strip()
            has_pagination = "page" in params or "pageSize" in params
            page = int(params.get("page", ["1"])[0] or 1)
            page_size = int(params.get("pageSize", ["10"])[0] or 10)
            page = max(1, page)
            page_size = max(1, min(50, page_size))

            # Get pembayaran from pembayaran table, ordered by newest first
            supa = supabase_client(service_role=True)
            query = supa.table('pembayaran').select("*").order('created_at', desc=True)
            if q:
                query = query.ilike("nama_lengkap", f"%{q}%")

            if has_pagination:
                from_ = (page - 1) * page_size
                to_ = from_ + page_size - 1
                result = query.range(from_, to_).execute()
            else:
                result = query.execute()

            # Get data safely
            raw_data = result.data if result else []
            # Map fields for frontend compatibility dengan field yang konsisten
            result_data = []
            for item in raw_data:
                # Normalise identifiers supaya konsisten antara tabel pendaftar/pembayaran
                nisn = (item.get('nisn') or "").strip()
                nik = (item.get('nik') or "").strip()
                nikcalon = (item.get('nikcalon') or "").strip()
                
                mapped = {
                    'id': item.get('id'),
                    'nisn': nisn or None,
                    'nik': nik or None,
                    # Simpan nikcalon asli jika ada (jangan timpa dengan nik)
                    'nikcalon': nikcalon or None,
                    'nama_lengkap': item.get('nama_lengkap'),
                    'jumlah': safe_float(item.get('jumlah'), 0.0),
                    'status': item.get('status_pembayaran'),  # Gunakan field yang benar
                    'tanggal_upload': item.get('tanggal_upload'),
                    'tanggal_verifikasi': item.get('tanggal_verifikasi'),
                    'verified_by': item.get('verified_by'),
                    'catatan_admin': item.get('catatan_admin'),
                    'bukti_pembayaran': item.get('bukti_pembayaran'),
                    'metode_pembayaran': item.get('metode_pembayaran'),
                    'created_at': item.get('created_at'),
                    'updated_at': item.get('updated_at')
                }
                result_data.append(mapped)

            total = None
            stats = None
            if has_pagination:
                def base_count_query():
                    qb = supa.table("pembayaran").select("id", count="exact")
                    if q:
                        qb = qb.ilike("nama_lengkap", f"%{q}%")
                    return qb

                # Total count for current filter
                count_res = base_count_query().execute()  # type: ignore
                total = count_res.count if hasattr(count_res, "count") else len(result_data)  # type: ignore

                # Summary counts for current filter (null treated as PENDING)
                pending_res = base_count_query().eq("status_pembayaran", "PENDING").execute()  # type: ignore
                pending = pending_res.count if hasattr(pending_res, "count") else 0  # type: ignore
                pending_null_res = base_count_query().is_("status_pembayaran", None).execute()  # type: ignore
                pending_null = pending_null_res.count if hasattr(pending_null_res, "count") else 0  # type: ignore

                verified_res = base_count_query().eq("status_pembayaran", "VERIFIED").execute()  # type: ignore
                verified = verified_res.count if hasattr(verified_res, "count") else 0  # type: ignore

                rejected_res = base_count_query().eq("status_pembayaran", "REJECTED").execute()  # type: ignore
                rejected = rejected_res.count if hasattr(rejected_res, "count") else 0  # type: ignore

                stats = {
                    "pending": int(pending) + int(pending_null),
                    "verified": int(verified),
                    "rejected": int(rejected),
                    "total": int(total) if total is not None else len(result_data),
                }

            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()

            response_data = {
                'success': True,
                'data': result_data if result_data else [],
                'count': len(result_data) if result_data else 0
            }
            if has_pagination:
                response_data.update({
                    "page": page,
                    "limit": page_size,
                    "total": total if total is not None else len(result_data),
                    "stats": stats,
                })

            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            print(f"Error in pembayaran_list: {str(e)}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e),
                'data': [],
                'count': 0
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
