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
                "id, statusberkas, jeniskelamin, rencanaprogram, rencanatingkat, provinsi"
            ).execute()
            
            data = res.data if res.data else []
            
            # ... (truncated for brevity)
            
            # Province Aggregation (Top 10)
            province_counts = {}

            for row in data:
                prog = (row.get("rencanaprogram") or "").strip()
                jenjang = (row.get("rencanatingkat") or "").strip()
                jk = (row.get("jeniskelamin") or "").strip().upper()
                prov = (row.get("provinsi") or "Belum Diisi").strip()
                
                # Normalize empty string
                if not prov: prov = "Belum Diisi"
                
                # Count Province
                province_counts[prov] = province_counts.get(prov, 0) + 1
                
                # Helper bools
                is_mts = jenjang == "MTs" or jenjang == "MTS"
                is_ma = jenjang == "MA"
                is_kuliah = jenjang == "Kuliah" or jenjang == "KULIAH"
                is_l = "L" in jk
                is_p = "P" in jk
                
                prog_upper = prog.upper()

                # Putra Induk (Robust Check)
                if "PUTRA INDUK" in prog_upper:
                    if is_mts: breakdown["putraIndukMts"] += 1
                    if is_ma: breakdown["putraIndukMa"] += 1
                    if is_kuliah: breakdown["putraIndukKuliah"] += 1
                    breakdown["putraIndukTotal"] += 1
                
                # Putra Tahfidz
                elif "TAHFIDZ" in prog_upper:
                    if is_mts: breakdown["putraTahfidzMts"] += 1
                    if is_ma: breakdown["putraTahfidzMa"] += 1
                    if is_kuliah: breakdown["putraTahfidzKuliah"] += 1
                    breakdown["putraTahfidzTotal"] += 1
                
                # Putri
                elif "PUTRI" in prog_upper:
                    if is_mts: breakdown["putriMts"] += 1
                    if is_ma: breakdown["putriMa"] += 1
                    if is_kuliah: breakdown["putriKuliah"] += 1
                    breakdown["putriTotal"] += 1
                
                # Hanya Sekolah (Non-Asrama) 
                # Note: Logic asks for "Hanya Sekolah" specifically, or fallback?
                # Usually if not one of the above Asramas, it's Sekolah only.
                # But let's check for "SEKOLAH" or "NON" keyword if specific.
                # If unsure, we can use 'else' but risky if data is dirty.
                # Let's try matching "SEKOLAH" or if it doesn't match above but has valid jenjang.
                elif "SEKOLAH" in prog_upper or "NON" in prog_upper:
                    if is_mts:
                        if is_l: breakdown["hanyaSekolahMtsL"] += 1
                        if is_p: breakdown["hanyaSekolahMtsP"] += 1
                        breakdown["hanyaSekolahMtsTotal"] += 1
                    elif is_ma:
                        if is_l: breakdown["hanyaSekolahMaL"] += 1
                        if is_p: breakdown["hanyaSekolahMaP"] += 1
                        breakdown["hanyaSekolahMaTotal"] += 1
                
                # Fallback: if program is just "MTs Regular" or something without "Sekolah" keyword
                # but wasn't caught by Asrama checks, we might want to count it as Sekolah?
                # For now stick to strict-ish text match to avoid over-counting garbage data.
            
            # Sort provinces by count (descending) and top 10
            
            # Debug: Collect distinct values to diagnose mismatch
            distinct_programs = set()
            distinct_jenjang = set()
            distinct_gender = set()

            for row in data:
                distinct_programs.add(row.get("rencanaprogram"))
                distinct_jenjang.add(row.get("rencanatingkat"))
                distinct_gender.add(row.get("jeniskelamin"))

            # Construct response
            response_data = {
                "success": True,
                "kpi": stats,
                "breakdown": breakdown,
                "charts": {
                    "gender": gender_counts,
                    "program": program_counts,
                    "asrama": asrama_counts,
                    "province": prov_chart_data
                },
                "debug_values": {
                    "programs": list(distinct_programs),
                    "jenjang": list(distinct_jenjang),
                    "gender": list(distinct_gender)
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
