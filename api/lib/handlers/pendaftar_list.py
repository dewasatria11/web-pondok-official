from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import parse_qs, urlparse
from typing import Any, Dict, List
from datetime import datetime
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/pendaftar_list?page=1&pageSize=10&q=&status=
        Response: { ok: true, rows: [...], page: 1, pageSize: 10 }
        
        Filter by:
        - q: search in namaLengkap
        - status: statusBerkas (MENUNGGU_VERIFIKASI, DITERIMA, DITOLAK)
        """
        try:
            # Parse query parameters
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            
            q = params.get('q', [''])[0].strip()
            status = params.get('status', [''])[0].strip()
            page = int(params.get('page', ['1'])[0])
            page_size = min(50, int(params.get('pageSize', ['10'])[0]))
            
            # Calculate range
            from_ = (page - 1) * page_size
            to_ = from_ + page_size - 1
            
            # Query Supabase with service-role for admin operations
            supa = supabase_client(service_role=True)
            query = supa.table("pendaftar").select("*").order("createdat", desc=True)
            
            # Apply filters
            if status:
                query = query.eq("statusberkas", status)
            
            if q:
                # Search in namaLengkap (case-insensitive)
                query = query.ilike("namaLengkap", f"%{q}%")
            
            # Apply pagination
            res = query.range(from_, to_).execute()
            
            # Get total count
            count_res = supa.table("pendaftar").select("*", count="exact").execute()  # type: ignore
            total = count_res.count if hasattr(count_res, 'count') else len(res.data)  # type: ignore
            
            # Transform data untuk admin dashboard
            transformed_data: List[Dict[str, Any]] = []
            for row in res.data:  # type: ignore
                row_dict: Dict[str, Any] = row  # type: ignore
                # Map createdat to tanggal_daftar for the frontend CSV export
                created_at = row_dict.get("createdat", "")
                # Format date to Indonesian format (DD/MM/YYYY) for display
                tanggal_daftar = ""
                if created_at:
                    try:
                        # Convert ISO format to DD/MM/YYYY format
                        date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        tanggal_daftar = date_obj.strftime("%d/%m/%Y")
                    except ValueError:
                        # If parsing fails, use original value
                        tanggal_daftar = created_at
                
                # Get all possible identifiers for payment matching
                nisn = row_dict.get("nisn", "")
                nik = row_dict.get("nik", "") or row_dict.get("nikcalon", "")
                nikcalon = row_dict.get("nikcalon", "") or row_dict.get("nik", "")
                
                transformed_data.append({
                    "id": row_dict.get("id"),
                    "nama": row_dict.get("namalengkap", ""),
                    "email": row_dict.get("emailcalon", "-"),
                    "no_hp": row_dict.get("telepon_orang_tua", row_dict.get("nomorhportu", "-")),
                    "alamat": f"{row_dict.get('alamatjalan', '')}, {row_dict.get('desa', '')}, {row_dict.get('kecamatan', '')}",
                    "status": (row_dict.get("statusberkas", "PENDING") or "PENDING").lower(),
                    "tanggal_daftar": tanggal_daftar,  # Add tanggal_daftar field for CSV export
                    "createdat": created_at,
                    "alasan": row_dict.get("alasan", "-"),
                    # CRITICAL: Ensure all identifier fields are present for payment matching
                    "nisn": nisn,
                    "nik": nik,
                    "nikcalon": nikcalon,
                    # Include original data for detail view with proper field mapping
                    **{
                        key: value for key, value in row_dict.items()
                        if key not in ["telepon_orang_tua", "nomorhportu", "statusberkas", "createdat", "alasan", "nisn", "nik", "nikcalon"]
                    },
                    # Ensure consistent field names
                    "telepon_orang_tua": row_dict.get("telepon_orang_tua", row_dict.get("nomorhportu", "-")),
                    "statusberkas": row_dict.get("statusberkas", "PENDING"),
                    "createdat": created_at,
                    "alasan_catatan": row_dict.get("alasan", "-"),
                    # CRITICAL: Add consistent field names for statistics calculation
                    "rencana_program": row_dict.get("rencanaprogram", ""),  # For statistics
                    "rencanaprogram": row_dict.get("rencanaprogram", ""),   # Keep lowercase for compatibility
                    "rencanatingkat": row_dict.get("rencanatingkat", ""),   # For jenjang filtering
                    "jeniskelamin": row_dict.get("jeniskelamin", "")        # For gender filtering
                })
            
            # Response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "data": transformed_data,
                "total": total,
                "page": page,
                "limit": page_size
            }).encode())
            
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
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()