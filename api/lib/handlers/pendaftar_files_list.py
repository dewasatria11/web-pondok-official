from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import parse_qs, urlparse
from lib._supabase import supabase_client


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/pendaftar_files_list?nisn=1234567890
        Response: { ok: true, files: [...], pendaftar: {...} }
        """
        try:
            # Parse query parameters
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            nisn = (params.get("nisn", [""])[0] or "").strip()

            if not nisn:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"ok": False, "error": "NISN required"}).encode()
                )
                return

            # Get Supabase client with service role for storage access
            supa = supabase_client(service_role=True)

            # Get pendaftar data
            pendaftar_result = (
                supa.table("pendaftar")
                .select("*")
                .eq("nisn", nisn)
                .execute()
            )

            if not pendaftar_result.data:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"ok": False, "error": "Pendaftar tidak ditemukan"}).encode()
                )
                return

            pendaftar = pendaftar_result.data[0]

            # List all files in the NISN folder from storage
            try:
                storage_files = supa.storage.from_("pendaftar-files").list(path=nisn)
                print(f"Storage files for {nisn}:", storage_files)
            except Exception as e:
                print(f"Error listing storage files: {e}")
                storage_files = []

            # Prepare file list with signed URLs and metadata
            files = []
            
            # Map of file types to friendly names
            file_type_map = {
                "ijazah": "Ijazah",
                "akta": "Akta Kelahiran",
                "foto": "Pas Foto 3x4",
                "bpjs": "BPJS",
            }

            for file_obj in storage_files:
                if isinstance(file_obj, dict):
                    file_name = file_obj.get("name", "")
                    file_path = f"{nisn}/{file_name}"
                    
                    # Determine file type from filename
                    file_type_key = "Lainnya"
                    for key, label in file_type_map.items():
                        if key in file_name.lower():
                            file_type_key = label
                            break
                    
                    # Check if it's an image
                    is_image = any(
                        file_name.lower().endswith(ext)
                        for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]
                    )
                    
                    # Get file extension
                    ext = file_name.split(".")[-1].lower() if "." in file_name else ""
                    
                    try:
                        # Create signed URL (expires in 5 minutes = 300 seconds)
                        signed_url_data = supa.storage.from_("pendaftar-files").create_signed_url(
                            path=file_path,
                            expires_in=300
                        )
                        
                        signed_url = signed_url_data.get("signedURL") if isinstance(signed_url_data, dict) else None
                        
                        if signed_url:
                            files.append({
                                "name": file_name,
                                "path": file_path,
                                "url": signed_url,
                                "type": file_type_key,
                                "is_image": is_image,
                                "extension": ext,
                                "size": file_obj.get("metadata", {}).get("size", 0) if isinstance(file_obj.get("metadata"), dict) else 0,
                            })
                    except Exception as e:
                        print(f"Error creating signed URL for {file_path}: {e}")
                        # Continue with other files

            # Return success
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": True,
                    "files": files,
                    "pendaftar": {
                        "nisn": pendaftar.get("nisn"),
                        "nama": pendaftar.get("namalengkap"),
                        "nik": pendaftar.get("nikcalon"),
                    },
                }).encode()
            )

        except Exception as e:
            print(f"Error in pendaftar_files_list: {e}")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({"ok": False, "error": str(e)}).encode()
            )

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

