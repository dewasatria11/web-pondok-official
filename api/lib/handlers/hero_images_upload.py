"""
API Handler: POST /api/hero_images_upload
Upload new hero image to slider
"""
from http.server import BaseHTTPRequestHandler
import json
import base64
import uuid
from datetime import datetime
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode())
            
            print("[HERO_UPLOAD] Uploading hero image...")
            
            # Validate required fields
            if not data.get('image_base64'):
                raise ValueError("Missing image_base64")
            
            if not data.get('filename'):
                raise ValueError("Missing filename")
            
            # Get Supabase client with service role for admin operations
            supa = supabase_client(service_role=True)
            
            # Get current count of hero images
            existing_result = supa.table("hero_images").select("id").execute()
            current_count = len(existing_result.data) if existing_result.data else 0
            
            # Limit to max 5 images
            if current_count >= 5:
                raise ValueError("Maximum 5 hero images allowed. Please delete one first.")
            
            # Decode base64 image
            image_data = data['image_base64']
            if ',' in image_data:
                image_data = image_data.split(',')[1]  # Remove data:image/...;base64, prefix
            
            image_bytes = base64.b64decode(image_data)
            
            # Generate unique filename
            file_ext = data['filename'].split('.')[-1] if '.' in data['filename'] else 'jpg'
            unique_filename = f"hero-{uuid.uuid4().hex[:12]}.{file_ext}"
            
            print(f"[HERO_UPLOAD] Uploading to storage: {unique_filename}")
            
            # Upload to Supabase Storage (bucket: hero-images)
            try:
                upload_result = supa.storage.from_("hero-images").upload(
                    path=unique_filename,
                    file=image_bytes,
                    file_options={"content-type": f"image/{file_ext}"}
                )
                
                print(f"[HERO_UPLOAD] Storage upload result: {upload_result}")
            except Exception as storage_error:
                error_msg = str(storage_error)
                print(f"[HERO_UPLOAD] ❌ Storage upload failed: {error_msg}")
                
                # Check for common errors
                if "Bucket not found" in error_msg or "404" in error_msg:
                    raise ValueError("Storage bucket 'hero-images' belum dibuat. Silakan buat bucket di Supabase Dashboard > Storage dengan nama 'hero-images' dan set sebagai PUBLIC.")
                elif "already exists" in error_msg.lower():
                    raise ValueError("File dengan nama yang sama sudah ada. Silakan coba lagi.")
                else:
                    raise ValueError(f"Gagal upload ke storage: {error_msg}")
            
            # Get public URL
            public_url = supa.storage.from_("hero-images").get_public_url(unique_filename)
            
            # Clean URL - remove trailing ? if present
            if isinstance(public_url, str) and public_url.endswith('?'):
                public_url = public_url.rstrip('?')
            
            print(f"[HERO_UPLOAD] Public URL: {public_url}")
            
            # Insert record into hero_images table
            display_order = data.get('display_order', current_count + 1)
            
            insert_result = supa.table("hero_images").insert({
                "image_url": public_url,
                "display_order": display_order,
                "is_active": True,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }).execute()
            
            print(f"[HERO_UPLOAD] ✅ Image uploaded successfully: {unique_filename}")
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            response = {
                "ok": True,
                "message": "Hero image uploaded successfully",
                "data": insert_result.data[0] if insert_result.data else None
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except ValueError as e:
            print(f"[HERO_UPLOAD] ❌ Validation error: {e}")
            
            self.send_response(400)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            self.wfile.write(json.dumps({
                "ok": False,
                "error": str(e)
            }).encode())
            
        except Exception as e:
            print(f"[HERO_UPLOAD] ❌ Error: {e}")
            
            self.send_response(500)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            self.wfile.write(json.dumps({
                "ok": False,
                "error": str(e)
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

