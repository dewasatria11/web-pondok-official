"""
API Handler: PUT /api/hero_images_update_order
Update display order of hero images
"""
from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
from lib._supabase import supabase_client

class handler(BaseHTTPRequestHandler):
    def do_PUT(self):
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode())
            
            # Validate required fields
            if not data.get('orders'):
                raise ValueError("Missing orders array")
            
            if not isinstance(data['orders'], list):
                raise ValueError("orders must be an array")
            
            print(f"[HERO_UPDATE_ORDER] Updating order for {len(data['orders'])} images...")
            
            # Get Supabase client with service role for admin operations
            supa = supabase_client(service_role=True)
            
            # Update each image's display_order
            updated_count = 0
            for order_data in data['orders']:
                image_id = order_data.get('id')
                display_order = order_data.get('display_order')
                
                if not image_id or display_order is None:
                    continue
                
                update_result = supa.table("hero_images").update({
                    "display_order": display_order,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", image_id).execute()
                
                if update_result.data:
                    updated_count += 1
                    print(f"[HERO_UPDATE_ORDER] Updated ID {image_id} to order {display_order}")
            
            print(f"[HERO_UPDATE_ORDER] ✅ Updated {updated_count} images")
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            response = {
                "ok": True,
                "message": f"Updated display order for {updated_count} images",
                "updated_count": updated_count
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except ValueError as e:
            print(f"[HERO_UPDATE_ORDER] ❌ Validation error: {e}")
            
            self.send_response(400)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            self.wfile.write(json.dumps({
                "ok": False,
                "error": str(e)
            }).encode())
            
        except Exception as e:
            print(f"[HERO_UPDATE_ORDER] ❌ Error: {e}")
            
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
        self.send_header("Access-Control-Allow-Methods", "PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

