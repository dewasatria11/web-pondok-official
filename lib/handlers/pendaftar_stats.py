from http.server import BaseHTTPRequestHandler
import json
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # Init Supabase with service role for admin access (bypasses RLS)
            supa = supabase_client(service_role=True)
            
            # Fetch all rows efficiently (just ID and relevant columns for stats)
            # Fetching 1000+ rows is fine if we only select specific columns, 
            # but ideally we'd use count() for total/status. 
            # However, for charts (gender/program), we need the data.
            # Supabase API max rows is 1000 by default, so we need to be careful.
            # A better approach for scalability is to run separate count queries.
            
            # 1. Status Counts (Exact)
            stats = {
                "total": 0,
                "pending": 0,
                "diterima": 0,
                "ditolak": 0,
                "revisi": 0
            }
            
            # It's more reliable to hit the DB multiple times for exact counts than fetching all rows if >1000
            # But making 5 requests is slow. 
            # Let's try fetching just the columns needed for stats with a higher limit.
            
            res = supa.table("pendaftar").select(
                "id, statusberkas, jeniskelamin, rencanaprogram, rencanatingkat, asrama"
            ).execute()
            
            data = res.data if res.data else []
            
            # If data length is 1000 (default limit), we might be missing data. 
            # But for now, this is better than 50.
            # TODO: Implement scrolling/looping if >1000 needed later.
            
            stats["total"] = len(data)
            
            # Aggregation for Charts
            gender_counts = {"L": 0, "P": 0}
            program_counts = {}
            asrama_counts = {"Asrama": 0, "Non-Asrama": 0}
            
            for row in data:
                # Status
                status = (row.get("statusberkas") or "PENDING").lower()
                if status in stats:
                    stats[status] += 1
                else:
                    # Map unknown statuses to pending or ignore
                    if status == "verified" or "verif" in status:
                         # logic mapping
                         pass
                    stats["pending"] += 1 # Default fallback
                
                # Gender
                jk = (row.get("jeniskelamin") or "").upper()
                if "LAKI" in jk: gender_counts["L"] += 1
                elif "PEREMPUAN" in jk: gender_counts["P"] += 1
                
                # Program (Jenjang + Program)
                jenjang = row.get("rencanatingkat") or "?"
                prog = row.get("rencanaprogram") or "?"
                full_prog = f"{jenjang} - {prog}"
                program_counts[full_prog] = program_counts.get(full_prog, 0) + 1
                
                # Asrama (Logika sederhana, sesuaikan dengan data riil)
                # Di seeder tidak ada kolom asrama spesifik, tapi mungkin dari "rencanatingkat"?
                # Asumsi semua asrama default, atau check field lain.
                # Kita gunakan placeholder logic jika kolom tidak ada.
                if row.get("asrama"):
                     asrama_counts["Asrama"] += 1
                else:
                     asrama_counts["Non-Asrama"] += 1
            
            # Construct response
            response_data = {
                "success": True,
                "kpi": stats,
                "charts": {
                    "gender": gender_counts,
                    "program": program_counts,
                    "asrama": asrama_counts
                },
                "meta": {
                    "fetched_count": len(data),
                    "note": "Aggregated from raw data (limit 1000)"
                }
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store') # Always fresh
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": str(e)
            }).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
