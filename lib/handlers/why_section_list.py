"""
API Handler: GET /api/why_section_list
Fetch Why Section content (narasi)
"""
from http.server import BaseHTTPRequestHandler
import json
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            print("[WHY_SECTION_LIST] Fetching Why Section content...")
            
            # Get Supabase client
            supa = supabase_client(service_role=False)
            
            # Default content (fallback if table doesn't exist or query fails)
            default_data = {
                "title": "Mengapa Memilih Pondok Pesantren Al Ikhsan Beji?",
                "subtitle": "Pendidikan islami terpadu: tahfidz Al-Qur'an, akhlak mulia, dan ilmu pengetahuan",
                "content": "Bergabunglah dengan Pondok Pesantren Al Ikhsan Beji untuk mendapatkan pendidikan islami terpadu yang membentuk karakter santri yang berakhlak mulia. Program tahfidz Al-Qur'an dengan metode terbukti akan membimbing santri menghafal Al-Qur'an dengan tartil dan pemahaman makna. Dengan pendampingan 24 jam, kami membentuk karakter santri yang ta'at beribadah dan santun dalam pergaulan. Fasilitas asrama yang nyaman dilengkapi dengan masjid, ruang belajar, perpustakaan, dan fasilitas olahraga yang lengkap untuk mendukung proses belajar mengajar yang optimal.",
                "title_en": "Why Choose Al Ikhsan Islamic Boarding School?",
                "subtitle_en": "Integrated Islamic education: tahfidz al-Qur'an, noble character, and knowledge",
                "content_en": "Join Al Ikhsan Islamic Boarding School to experience an integrated Islamic education that shapes students with noble character. Our proven tahfidz programme guides santri to memorise the Qur'an with tartil while understanding its meaning. With round-the-clock mentoring we nurture disciplined, devout, and courteous students. Comfortable dormitories complete with a mosque, classrooms, library, and sports facilities support an optimal learning environment."
            }
            
            # Try to fetch from database
            try:
                result = supa.table("why_section").select("*").limit(1).execute()
                print(f"[WHY_SECTION_LIST] Found {len(result.data) if result.data else 0} records")
                
                if result.data and len(result.data) > 0:
                    data = result.data[0]
                    payload = {
                        "title": data.get("title") or default_data["title"],
                        "subtitle": data.get("subtitle") or default_data["subtitle"],
                        "content": data.get("content") or default_data["content"],
                        "title_en": data.get("title_en") or default_data["title_en"],
                        "subtitle_en": data.get("subtitle_en") or default_data["subtitle_en"],
                        "content_en": data.get("content_en") or default_data["content_en"]
                    }

                    response = {
                        "ok": True,
                        "data": payload
                    }
                else:
                    # No data in table, return default
                    print("[WHY_SECTION_LIST] ⚠️ No data found, returning default")
                    response = {
                        "ok": True,
                        "data": default_data
                    }
            except Exception as db_error:
                # Table might not exist or other DB error
                error_msg = str(db_error)
                print(f"[WHY_SECTION_LIST] ⚠️ Database error (table may not exist): {error_msg}")
                
                # Check if it's a table not found error
                if "why_section" in error_msg.lower() or "not found" in error_msg.lower() or "PGRST205" in error_msg:
                    print("[WHY_SECTION_LIST] ⚠️ Table 'why_section' not found - returning default content")
                    # Return default content instead of error (graceful fallback)
                    response = {
                        "ok": True,
                        "data": default_data,
                        "warning": "Table 'why_section' belum dibuat. Silakan jalankan SQL script di sql/create_table_why_section.sql"
                    }
                else:
                    # Re-raise other errors
                    raise db_error
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=1800")
            self.end_headers()
            
            self.wfile.write(json.dumps(response).encode())
            print("[WHY_SECTION_LIST] ✅ Success")
            
        except Exception as e:
            print(f"[WHY_SECTION_LIST] ❌ Error: {e}")
            import traceback
            traceback.print_exc()
            
            # Send error response with default data as fallback
            self.send_response(200)  # Return 200 with error flag instead of 500
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=300")
            self.end_headers()
            
            # Return default content even on error (graceful degradation)
            fallback_payload = {
                "title": default_data["title"],
                "subtitle": default_data["subtitle"],
                "content": default_data["content"],
                "title_en": default_data["title_en"],
                "subtitle_en": default_data["subtitle_en"],
                "content_en": default_data["content_en"]
            }

            self.wfile.write(json.dumps({
                "ok": True,
                "data": fallback_payload,
                "error": str(e)  # Include error for debugging
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
