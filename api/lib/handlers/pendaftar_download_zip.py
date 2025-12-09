from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import parse_qs, urlparse
from io import BytesIO
import zipfile
import re
from datetime import datetime, timedelta
from .._supabase import supabase_client


def slugify(text):
    """Convert text to URL-friendly slug"""
    text = str(text).lower().strip()
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'[^\w\-]', '', text)
    text = re.sub(r'\-\-+', '-', text)
    text = re.sub(r'^-+', '', text)
    text = re.sub(r'-+$', '', text)
    return text if text else 'unnamed'


def detect_file_type(filename):
    """Detect file type based on filename"""
    filename_lower = filename.lower()
    
    # File type mapping
    type_map = {
        "Ijazah": ["ijazah", "raport", "sttb"],
        "Akta Kelahiran": ["akta", "akte", "kelahiran"],
        "Pas Foto 3x4": ["foto", "pasfoto", "pas-foto", "3x4"],
        "BPJS": ["bpjs", "kartu-bpjs"],
        "Kartu Keluarga": ["kk", "kartu-keluarga", "kartukeluarga"],
    }
    
    for folder, keywords in type_map.items():
        if any(keyword in filename_lower for keyword in keywords):
            return folder
    
    return "Lainnya"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/pendaftar_download_zip?only=all&status=verified
        
        Response: JSON with signed download URL (expires in 1 hour)
        
        SETUP REQUIRED:
        - Create Supabase Storage bucket: "temp-downloads" 
        - Set bucket to PUBLIC or enable signed URLs
        - Recommended: Enable RLS policies for admin-only upload access
        
        Benefits of this approach:
        - No large buffer sent through Vercel Function (avoids memory limits)
        - Files stored temporarily in Supabase Storage
        - Automatic cleanup of files older than 24 hours
        - Signed URLs with expiration for security
        """
        try:
            print("[ZIP_DOWNLOAD] ========================================")
            print("[ZIP_DOWNLOAD] Starting ZIP download request")
            
            # Parse query parameters
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            
            only_type = (params.get("only", ["all"])[0] or "all").strip()
            status_filter = (params.get("status", [""])[0] or "").strip()
            date_from = (params.get("date_from", [""])[0] or "").strip()
            date_to = (params.get("date_to", [""])[0] or "").strip()
            
            print(f"[ZIP_DOWNLOAD] Filters: only={only_type}, status={status_filter}, date_from={date_from}, date_to={date_to}")

            # Get Supabase client with SERVICE_ROLE
            print("[ZIP_DOWNLOAD] Initializing Supabase client...")
            supa = supabase_client(service_role=True)
            print("[ZIP_DOWNLOAD] ✓ Supabase client initialized")

            # Build query for pendaftar
            query = supa.table("pendaftar").select("*")
            
            # Apply filters
            if status_filter in ["pending", "verified", "rejected"]:
                query = query.eq("status", status_filter)
            
            if date_from:
                query = query.gte("created_at", date_from)
            
            if date_to:
                query = query.lte("created_at", date_to)
            
            # Execute query
            print("[ZIP_DOWNLOAD] Querying pendaftar table...")
            try:
                pendaftar_result = query.order("namalengkap").execute()
            except Exception as e:
                print(f"[ZIP_DOWNLOAD] ❌ Error querying database: {e}")
                raise Exception(f"Database query failed: {str(e)}")

            print(f"[ZIP_DOWNLOAD] ✓ Query successful, found {len(pendaftar_result.data) if pendaftar_result.data else 0} pendaftar")

            if not pendaftar_result.data:
                print("[ZIP_DOWNLOAD] ⚠️ No pendaftar found with current filters")
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"ok": False, "error": "Tidak ada pendaftar ditemukan"}).encode()
                )
                return

            pendaftar_list = pendaftar_result.data
            
            # Image extensions for filtering
            image_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]
            all_extensions = image_extensions + [".pdf", ".doc", ".docx", ".xlsx", ".xls"]
            
            # Determine which extensions to include
            target_extensions = image_extensions if only_type == "images" else all_extensions

            # Create ZIP in memory with streaming
            print("[ZIP_DOWNLOAD] Creating ZIP file...")
            zip_buffer = BytesIO()
            total_files = 0
            success_count = 0
            failed_files = []
            skipped_pendaftar = []
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for idx, pendaftar in enumerate(pendaftar_list, 1):
                    nisn = pendaftar.get("nisn", "")
                    nama = pendaftar.get("namalengkap", "Unknown")
                    slug_name = slugify(nama)
                    
                    print(f"[ZIP_DOWNLOAD] [{idx}/{len(pendaftar_list)}] Processing: {nama} (NISN: {nisn})")
                    
                    if not nisn:
                        print(f"[ZIP_DOWNLOAD]   ⚠️ Skipping {nama} - no NISN")
                        skipped_pendaftar.append(f"{nama} (no NISN)")
                        continue
                    
                    # List files from storage for this pendaftar
                    try:
                        print(f"[ZIP_DOWNLOAD]   → Listing files from storage path: {nisn}")
                        storage_result = supa.storage.from_("pendaftar-files").list(path=nisn)
                        
                        # Handle different response formats
                        if isinstance(storage_result, list):
                            storage_files = storage_result
                        elif hasattr(storage_result, 'data'):
                            storage_files = storage_result.data or []
                        elif isinstance(storage_result, dict) and 'data' in storage_result:
                            storage_files = storage_result['data'] or []
                        else:
                            storage_files = []
                        
                        print(f"[ZIP_DOWNLOAD]   → Found {len(storage_files)} files")
                        
                    except Exception as e:
                        print(f"[ZIP_DOWNLOAD]   ❌ Error listing files for {nisn}: {e}")
                        failed_files.append(f"{nama} (list error: {str(e)})")
                        continue
                    
                    # Process each file
                    for file_obj in storage_files:
                        if not isinstance(file_obj, dict):
                            print(f"[ZIP_DOWNLOAD]   ⚠️ Skipping non-dict file object: {type(file_obj)}")
                            continue
                        
                        file_name = file_obj.get("name", "")
                        
                        if not file_name:
                            print(f"[ZIP_DOWNLOAD]   ⚠️ Skipping file with no name")
                            continue
                        
                        # Check if file type matches filter
                        if not any(file_name.lower().endswith(ext) for ext in target_extensions):
                            print(f"[ZIP_DOWNLOAD]   ⊘ Skipping {file_name} (not in target extensions)")
                            continue
                        
                        total_files += 1
                        
                        # Determine folder
                        folder = detect_file_type(file_name)
                        
                        # Build file path
                        file_path = f"{nisn}/{file_name}"
                        zip_path = f"{slug_name}/{folder}/{file_name}"
                        
                        try:
                            print(f"[ZIP_DOWNLOAD]   ↓ Downloading {file_name}...")
                            # Download file from storage
                            file_bytes = supa.storage.from_("pendaftar-files").download(file_path)
                            
                            if not file_bytes:
                                print(f"[ZIP_DOWNLOAD]   ⚠️ Empty file: {file_name}")
                                failed_files.append(f"{nama}/{folder}/{file_name} (empty)")
                                continue
                            
                            # Add to ZIP
                            zip_file.writestr(zip_path, file_bytes)
                            success_count += 1
                            print(f"[ZIP_DOWNLOAD]   ✓ Added to ZIP: {zip_path} ({len(file_bytes)} bytes)")
                            
                        except Exception as e:
                            print(f"[ZIP_DOWNLOAD]   ❌ Error adding {file_path} to ZIP: {e}")
                            failed_files.append(f"{nama}/{folder}/{file_name} (error: {str(e)[:50]})")
                            # Continue with other files

            print(f"[ZIP_DOWNLOAD] ========================================")
            print(f"[ZIP_DOWNLOAD] ZIP Creation Summary:")
            print(f"[ZIP_DOWNLOAD]   Total pendaftar: {len(pendaftar_list)}")
            print(f"[ZIP_DOWNLOAD]   Skipped pendaftar: {len(skipped_pendaftar)}")
            print(f"[ZIP_DOWNLOAD]   Total files found: {total_files}")
            print(f"[ZIP_DOWNLOAD]   Successfully added: {success_count}")
            print(f"[ZIP_DOWNLOAD]   Failed: {len(failed_files)}")
            print(f"[ZIP_DOWNLOAD] ========================================")
            
            if success_count == 0:
                print("[ZIP_DOWNLOAD] ❌ No files successfully downloaded")
                if failed_files:
                    print(f"[ZIP_DOWNLOAD] Failed files (first 5): {failed_files[:5]}")
                
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False, 
                        "error": "Tidak ada berkas yang berhasil diunduh",
                        "total_pendaftar": len(pendaftar_list),
                        "total_files": total_files,
                        "failed": len(failed_files),
                        "failed_details": failed_files[:10]  # First 10 errors
                    }).encode()
                )
                return

            # Get ZIP data
            print("[ZIP_DOWNLOAD] Preparing ZIP data for upload to storage...")
            zip_buffer.seek(0)
            zip_data = zip_buffer.getvalue()
            
            zip_size_mb = len(zip_data) / 1024 / 1024
            print(f"[ZIP_DOWNLOAD] ZIP size: {len(zip_data)} bytes ({zip_size_mb:.2f} MB)")

            # Generate unique filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"semua-berkas_{timestamp}.zip"
            storage_path = f"exports/{filename}"

            # Upload to Supabase Storage (temp bucket)
            print(f"[ZIP_DOWNLOAD] Uploading ZIP to storage: {storage_path}")
            try:
                # Upload file to storage bucket "temp-downloads"
                upload_result = supa.storage.from_("temp-downloads").upload(
                    path=storage_path,
                    file=zip_data,
                    file_options={
                        "content-type": "application/zip",
                        "cache-control": "3600"
                    }
                )
                print(f"[ZIP_DOWNLOAD] ✓ Upload successful: {upload_result}")
            except Exception as e:
                print(f"[ZIP_DOWNLOAD] ❌ Upload failed: {e}")
                raise Exception(f"Failed to upload ZIP to storage: {str(e)}")

            # Generate signed URL (expires in 1 hour)
            print(f"[ZIP_DOWNLOAD] Generating signed URL...")
            try:
                signed_url_result = supa.storage.from_("temp-downloads").create_signed_url(
                    path=storage_path,
                    expires_in=3600  # 1 hour
                )
                
                # Handle different response formats
                if isinstance(signed_url_result, dict) and 'signedURL' in signed_url_result:
                    download_url = signed_url_result['signedURL']
                elif isinstance(signed_url_result, dict) and 'signedUrl' in signed_url_result:
                    download_url = signed_url_result['signedUrl']
                elif hasattr(signed_url_result, 'signed_url'):
                    download_url = signed_url_result.signed_url
                else:
                    # Fallback: construct public URL
                    print(f"[ZIP_DOWNLOAD] ⚠️ Unexpected signed_url format: {signed_url_result}")
                    download_url = supa.storage.from_("temp-downloads").get_public_url(storage_path)
                
                print(f"[ZIP_DOWNLOAD] ✓ Signed URL generated: {download_url[:100]}...")
            except Exception as e:
                print(f"[ZIP_DOWNLOAD] ❌ Failed to generate signed URL: {e}")
                raise Exception(f"Failed to generate download URL: {str(e)}")

            # Cleanup old files (older than 24 hours)
            try:
                print("[ZIP_DOWNLOAD] Cleaning up old export files...")
                old_files = supa.storage.from_("temp-downloads").list(path="exports")
                
                if isinstance(old_files, list):
                    files_list = old_files
                elif hasattr(old_files, 'data'):
                    files_list = old_files.data or []
                else:
                    files_list = []
                
                cutoff_time = datetime.now() - timedelta(hours=24)
                files_to_delete = []
                
                for file_obj in files_list:
                    if not isinstance(file_obj, dict):
                        continue
                    
                    file_name = file_obj.get("name", "")
                    created_at = file_obj.get("created_at", "")
                    
                    if not file_name or not created_at:
                        continue
                    
                    try:
                        file_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        if file_time < cutoff_time:
                            files_to_delete.append(f"exports/{file_name}")
                    except:
                        continue
                
                if files_to_delete:
                    print(f"[ZIP_DOWNLOAD] Deleting {len(files_to_delete)} old files...")
                    for old_file in files_to_delete:
                        try:
                            supa.storage.from_("temp-downloads").remove([old_file])
                            print(f"[ZIP_DOWNLOAD]   ✓ Deleted: {old_file}")
                        except Exception as e:
                            print(f"[ZIP_DOWNLOAD]   ⚠️ Failed to delete {old_file}: {e}")
                else:
                    print("[ZIP_DOWNLOAD] No old files to clean up")
            except Exception as e:
                print(f"[ZIP_DOWNLOAD] ⚠️ Cleanup error (non-critical): {e}")

            # Return JSON with download URL
            print(f"[ZIP_DOWNLOAD] ========================================")
            print(f"[ZIP_DOWNLOAD] ✓✓✓ SUCCESS - ZIP uploaded to storage!")
            print(f"[ZIP_DOWNLOAD]   Filename: {filename}")
            print(f"[ZIP_DOWNLOAD]   Size: {zip_size_mb:.2f} MB")
            print(f"[ZIP_DOWNLOAD]   Files: {success_count}/{total_files}")
            print(f"[ZIP_DOWNLOAD]   Success rate: {success_count/total_files*100:.1f}%" if total_files > 0 else "[ZIP_DOWNLOAD]   No files")
            print(f"[ZIP_DOWNLOAD]   Download URL expires in: 1 hour")
            
            if failed_files and len(failed_files) <= 10:
                print(f"[ZIP_DOWNLOAD]   Failed files: {', '.join(failed_files)}")
            elif failed_files:
                print(f"[ZIP_DOWNLOAD]   Failed files (first 10): {', '.join(failed_files[:10])}")
            
            print(f"[ZIP_DOWNLOAD] ========================================")

            # Send JSON response with download URL
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": True,
                    "download_url": download_url,
                    "filename": filename,
                    "size_bytes": len(zip_data),
                    "size_mb": round(zip_size_mb, 2),
                    "total_files": total_files,
                    "success_count": success_count,
                    "failed_count": len(failed_files),
                    "expires_in": "1 hour",
                    "message": f"ZIP berhasil dibuat! {success_count} file dari {total_files}"
                }).encode()
            )

        except Exception as e:
            print(f"[ZIP_DOWNLOAD] ========================================")
            print(f"[ZIP_DOWNLOAD] ❌❌❌ FATAL ERROR")
            print(f"[ZIP_DOWNLOAD] Error type: {type(e).__name__}")
            print(f"[ZIP_DOWNLOAD] Error message: {str(e)}")
            print(f"[ZIP_DOWNLOAD] ========================================")
            
            import traceback
            print("[ZIP_DOWNLOAD] Full traceback:")
            traceback.print_exc()
            print(f"[ZIP_DOWNLOAD] ========================================")
            
            # Prepare detailed error response
            error_message = str(e)
            error_type = type(e).__name__
            
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": False, 
                    "error": error_message,
                    "error_type": error_type,
                    "message": f"Terjadi kesalahan internal: {error_message}"
                }).encode()
            )

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

