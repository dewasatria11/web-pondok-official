"""
API Handler: DELETE /api/hero_images_delete
Delete hero image from slider
"""
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_DELETE(self):
        try:
            # Parse query parameters
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            
            image_id = query_params.get('id', [None])[0]
            
            if not image_id:
                raise ValueError("Missing id parameter")
            
            print(f"[HERO_DELETE] Deleting hero image ID: {image_id}")
            
            # Get Supabase client with service role for admin operations
            supa = supabase_client(service_role=True)
            
            # Get image data first (to delete from storage)
            image_result = supa.table("hero_images").select("*").eq("id", image_id).execute()
            
            if not image_result.data or len(image_result.data) == 0:
                raise ValueError(f"Hero image with ID {image_id} not found")
            
            image_data = image_result.data[0]
            image_url = image_data.get('image_url', '')
            
            # Extract filename from URL
            filename = image_url.split('/')[-1] if image_url else None
            
            # Delete from storage (hero-images bucket)
            if filename:
                try:
                    print(f"[HERO_DELETE] Deleting from storage: {filename}")
                    supa.storage.from_("hero-images").remove([filename])
                    print(f"[HERO_DELETE] ✅ Deleted from storage: {filename}")
                except Exception as storage_err:
                    print(f"[HERO_DELETE] ⚠️ Storage delete warning: {storage_err}")
                    # Continue even if storage delete fails
            
            # Delete from database
            delete_result = supa.table("hero_images").delete().eq("id", image_id).execute()
            
            print(f"[HERO_DELETE] ✅ Image deleted from database: ID {image_id}")
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            response = {
                "ok": True,
                "message": "Hero image deleted successfully",
                "deleted_id": image_id
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except ValueError as e:
            print(f"[HERO_DELETE] ❌ Validation error: {e}")
            
            self.send_response(400)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            self.wfile.write(json.dumps({
                "ok": False,
                "error": str(e)
            }).encode())
            
        except Exception as e:
            print(f"[HERO_DELETE] ❌ Error: {e}")
            
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
        self.send_header("Access-Control-Allow-Methods", "DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

