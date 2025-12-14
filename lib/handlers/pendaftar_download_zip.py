from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import parse_qs, urlparse
from io import BytesIO
import zipfile
import re
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from lib._supabase import supabase_client


# Configuration
MAX_PENDAFTAR_PER_REQUEST = 200  # Increased to handle all pendaftar
MAX_CONCURRENT_DOWNLOADS = 15   # More parallel download workers for speed
DOWNLOAD_TIMEOUT_SECONDS = 55   # Increased timeout (Vercel max is 60s)


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


def download_single_file(supa, file_info):
    """Download a single file from storage - used by thread pool"""
    try:
        file_path = file_info['path']
        file_bytes = supa.storage.from_("pendaftar-files").download(file_path)
        if file_bytes:
            return {
                'success': True,
                'path': file_path,
                'zip_path': file_info['zip_path'],
                'data': file_bytes,
                'size': len(file_bytes)
            }
        else:
            return {'success': False, 'path': file_path, 'error': 'Empty file'}
    except Exception as e:
        return {'success': False, 'path': file_path, 'error': str(e)[:100]}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/pendaftar_download_zip?only=all&status=verified&limit=50
        
        Response: JSON with signed download URL (expires in 1 hour)
        
        OPTIMIZATIONS:
        - Concurrent file downloads (10 workers)
        - Limited pendaftar per request (max 50)
        - Early timeout detection
        - Progress tracking
        """
        start_time = time.time()
        
        try:
            print("[ZIP_DOWNLOAD] ========================================")
            print("[ZIP_DOWNLOAD] Starting ZIP download request (OPTIMIZED)")
            
            # Parse query parameters
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            
            only_type = (params.get("only", ["all"])[0] or "all").strip()
            status_filter = (params.get("status", [""])[0] or "").strip()
            date_from = (params.get("date_from", [""])[0] or "").strip()
            date_to = (params.get("date_to", [""])[0] or "").strip()
            limit = int(params.get("limit", [str(MAX_PENDAFTAR_PER_REQUEST)])[0] or MAX_PENDAFTAR_PER_REQUEST)
            limit = min(limit, MAX_PENDAFTAR_PER_REQUEST)  # Enforce max limit
            
            print(f"[ZIP_DOWNLOAD] Filters: only={only_type}, status={status_filter}, limit={limit}")

            # Get Supabase client with SERVICE_ROLE
            print("[ZIP_DOWNLOAD] Initializing Supabase client...")
            supa = supabase_client(service_role=True)
            print("[ZIP_DOWNLOAD] ✓ Supabase client initialized")

            # Build query for pendaftar
            query = supa.table("pendaftar").select("*")
            
            # Apply filters
            if status_filter in ["pending", "verified", "rejected", "diterima", "revisi", "ditolak"]:
                query = query.eq("statusberkas", status_filter.upper())
            
            if date_from:
                query = query.gte("created_at", date_from)
            
            if date_to:
                query = query.lte("created_at", date_to)
            
            # Apply limit
            query = query.limit(limit)
            
            # Execute query
            print(f"[ZIP_DOWNLOAD] Querying pendaftar table (limit: {limit})...")
            try:
                pendaftar_result = query.order("namalengkap").execute()
            except Exception as e:
                print(f"[ZIP_DOWNLOAD] ❌ Error querying database: {e}")
                raise Exception(f"Database query failed: {str(e)}")

            pendaftar_count = len(pendaftar_result.data) if pendaftar_result.data else 0
            print(f"[ZIP_DOWNLOAD] ✓ Query successful, found {pendaftar_count} pendaftar")

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

            # PHASE 1: Collect all files to download
            print("[ZIP_DOWNLOAD] PHASE 1: Collecting files to download...")
            files_to_download = []
            skipped_pendaftar = []
            
            for idx, pendaftar in enumerate(pendaftar_list, 1):
                # Check timeout
                elapsed = time.time() - start_time
                if elapsed > DOWNLOAD_TIMEOUT_SECONDS * 0.3:  # 30% of timeout for collection
                    print(f"[ZIP_DOWNLOAD] ⚠️ Collection phase taking too long, stopping early")
                    break
                
                nisn = pendaftar.get("nisn", "")
                nama = pendaftar.get("namalengkap", "Unknown")
                slug_name = slugify(nama)
                
                if not nisn:
                    skipped_pendaftar.append(f"{nama} (no NISN)")
                    continue
                
                # List files from storage for this pendaftar
                try:
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
                    
                    for file_obj in storage_files:
                        if not isinstance(file_obj, dict):
                            continue
                        
                        file_name = file_obj.get("name", "")
                        if not file_name:
                            continue
                        
                        # Check if file type matches filter
                        if not any(file_name.lower().endswith(ext) for ext in target_extensions):
                            continue
                        
                        folder = detect_file_type(file_name)
                        file_path = f"{nisn}/{file_name}"
                        zip_path = f"{slug_name}/{folder}/{file_name}"
                        
                        files_to_download.append({
                            'path': file_path,
                            'zip_path': zip_path,
                            'nama': nama
                        })
                        
                except Exception as e:
                    print(f"[ZIP_DOWNLOAD] ⚠️ Error listing files for {nisn}: {e}")
                    continue

            print(f"[ZIP_DOWNLOAD] ✓ Found {len(files_to_download)} files to download")
            
            if not files_to_download:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False, 
                        "error": "Tidak ada berkas ditemukan untuk pendaftar yang dipilih"
                    }).encode()
                )
                return

            # PHASE 2: Download files concurrently
            print(f"[ZIP_DOWNLOAD] PHASE 2: Downloading {len(files_to_download)} files with {MAX_CONCURRENT_DOWNLOADS} workers...")
            
            downloaded_files = []
            failed_files = []
            
            with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_DOWNLOADS) as executor:
                # Submit all downloads
                future_to_file = {
                    executor.submit(download_single_file, supa, file_info): file_info 
                    for file_info in files_to_download
                }
                
                # Process completed downloads
                for future in as_completed(future_to_file):
                    # Check timeout
                    elapsed = time.time() - start_time
                    if elapsed > DOWNLOAD_TIMEOUT_SECONDS:
                        print(f"[ZIP_DOWNLOAD] ⚠️ Timeout approaching ({elapsed:.1f}s), stopping downloads")
                        executor.shutdown(wait=False, cancel_futures=True)
                        break
                    
                    result = future.result()
                    if result['success']:
                        downloaded_files.append(result)
                    else:
                        failed_files.append(f"{result['path']} ({result.get('error', 'unknown')})")

            print(f"[ZIP_DOWNLOAD] ✓ Downloaded {len(downloaded_files)}/{len(files_to_download)} files")

            if not downloaded_files:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False, 
                        "error": "Tidak ada berkas yang berhasil diunduh",
                        "failed_details": failed_files[:10]
                    }).encode()
                )
                return

            # PHASE 3: Create ZIP file
            print("[ZIP_DOWNLOAD] PHASE 3: Creating ZIP file...")
            zip_buffer = BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as zip_file:
                for file_data in downloaded_files:
                    zip_file.writestr(file_data['zip_path'], file_data['data'])

            zip_buffer.seek(0)
            zip_data = zip_buffer.getvalue()
            
            zip_size_mb = len(zip_data) / 1024 / 1024
            print(f"[ZIP_DOWNLOAD] ✓ ZIP created: {zip_size_mb:.2f} MB ({len(downloaded_files)} files)")

            # PHASE 4: Upload to storage
            print("[ZIP_DOWNLOAD] PHASE 4: Uploading ZIP to storage...")
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"semua-berkas_{timestamp}.zip"
            storage_path = f"exports/{filename}"

            try:
                upload_result = supa.storage.from_("temp-downloads").upload(
                    path=storage_path,
                    file=zip_data,
                    file_options={
                        "content-type": "application/zip",
                        "cache-control": "3600"
                    }
                )
                print(f"[ZIP_DOWNLOAD] ✓ Upload successful")
            except Exception as e:
                print(f"[ZIP_DOWNLOAD] ❌ Upload failed: {e}")
                raise Exception(f"Failed to upload ZIP to storage: {str(e)}")

            # Generate signed URL
            print("[ZIP_DOWNLOAD] Generating signed URL...")
            try:
                signed_url_result = supa.storage.from_("temp-downloads").create_signed_url(
                    path=storage_path,
                    expires_in=3600
                )
                
                if isinstance(signed_url_result, dict) and 'signedURL' in signed_url_result:
                    download_url = signed_url_result['signedURL']
                elif isinstance(signed_url_result, dict) and 'signedUrl' in signed_url_result:
                    download_url = signed_url_result['signedUrl']
                elif hasattr(signed_url_result, 'signed_url'):
                    download_url = signed_url_result.signed_url
                else:
                    download_url = supa.storage.from_("temp-downloads").get_public_url(storage_path)
                
                print(f"[ZIP_DOWNLOAD] ✓ Signed URL generated")
            except Exception as e:
                print(f"[ZIP_DOWNLOAD] ❌ Failed to generate signed URL: {e}")
                raise Exception(f"Failed to generate download URL: {str(e)}")

            # Cleanup old files (non-blocking, best effort)
            try:
                old_files = supa.storage.from_("temp-downloads").list(path="exports")
                if isinstance(old_files, list):
                    files_list = old_files
                elif hasattr(old_files, 'data'):
                    files_list = old_files.data or []
                else:
                    files_list = []
                
                cutoff_time = datetime.now() - timedelta(hours=24)
                for file_obj in files_list[:10]:  # Limit cleanup to prevent timeout
                    if not isinstance(file_obj, dict):
                        continue
                    file_name = file_obj.get("name", "")
                    created_at = file_obj.get("created_at", "")
                    if file_name and created_at:
                        try:
                            file_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                            if file_time < cutoff_time:
                                supa.storage.from_("temp-downloads").remove([f"exports/{file_name}"])
                        except:
                            pass
            except:
                pass  # Ignore cleanup errors

            # Calculate total time
            total_time = time.time() - start_time
            print(f"[ZIP_DOWNLOAD] ========================================")
            print(f"[ZIP_DOWNLOAD] ✓✓✓ SUCCESS in {total_time:.1f}s")
            print(f"[ZIP_DOWNLOAD]   Files: {len(downloaded_files)}/{len(files_to_download)}")
            print(f"[ZIP_DOWNLOAD]   Size: {zip_size_mb:.2f} MB")
            print(f"[ZIP_DOWNLOAD] ========================================")

            # Send response
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
                    "total_files": len(files_to_download),
                    "success_count": len(downloaded_files),
                    "failed_count": len(failed_files),
                    "processing_time_seconds": round(total_time, 1),
                    "pendaftar_processed": len(pendaftar_list),
                    "expires_in": "1 hour",
                    "message": f"ZIP berhasil dibuat! {len(downloaded_files)} file dari {len(files_to_download)}"
                }).encode()
            )

        except Exception as e:
            total_time = time.time() - start_time
            print(f"[ZIP_DOWNLOAD] ========================================")
            print(f"[ZIP_DOWNLOAD] ❌❌❌ FATAL ERROR after {total_time:.1f}s")
            print(f"[ZIP_DOWNLOAD] Error: {str(e)}")
            print(f"[ZIP_DOWNLOAD] ========================================")
            
            import traceback
            traceback.print_exc()
            
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": False, 
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "processing_time_seconds": round(total_time, 1),
                    "message": f"Terjadi kesalahan: {str(e)}"
                }).encode()
            )

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


