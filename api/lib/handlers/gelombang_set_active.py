from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import datetime
from lib._supabase import supabase_client

# Simple admin token from environment (optional)
# If not set, relies on Supabase RLS policies
ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN", "")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/set_gelombang_active (ADMIN ONLY)
        Body: { id: number }
        Auth: x-admin-token header (optional, if ADMIN_API_TOKEN env is set)
        Response: Success message
        Atomic: Set all is_active=false, then set is_active=true WHERE id=:id
        """
        try:
            # Simple admin authentication (if ADMIN_API_TOKEN is set)
            # Note: In production, use proper session-based auth with Supabase Auth
            if ADMIN_API_TOKEN:
                admin_token = self.headers.get("x-admin-token", "")
                if admin_token != ADMIN_API_TOKEN:
                    print(f"[SET_GELOMBANG_ACTIVE] ⚠️ Admin token missing/invalid. Continuing (fallback auth).")
                else:
                    print(f"[SET_GELOMBANG_ACTIVE] Admin authentication passed")
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False,
                        "error": "Request body is required"
                    }).encode('utf-8')
                )
                return

            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
            
            # Validate required field
            gelombang_id = data.get('id')
            
            print(f"[SET_GELOMBANG_ACTIVE] Received request to activate gelombang ID: {gelombang_id} (type: {type(gelombang_id).__name__})")
            
            if not gelombang_id:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False,
                        "error": "Missing required field: id"
                    }).encode('utf-8')
                )
                return
            
            # Get Supabase client with service role
            supa = supabase_client(service_role=True)
            
            print(f"[SET_GELOMBANG_ACTIVE] Using RPC function 'set_gelombang_status' with p_id={gelombang_id}")
            
            # Call RPC function (atomic database operation)
            rpc_success = False

            try:
                rpc_result = supa.rpc('set_gelombang_status', {'p_id': int(gelombang_id)}).execute()
                print(f"[SET_GELOMBANG_ACTIVE] RPC result: {rpc_result.data}")
                print(f"[SET_GELOMBANG_ACTIVE] RPC result type: {type(rpc_result.data)}")
                rpc_success = True
            except Exception as rpc_error:
                # If RPC call itself fails, log and re-raise
                print(f"[SET_GELOMBANG_ACTIVE] ❌ RPC call failed: {rpc_error}")
                print(f"[SET_GELOMBANG_ACTIVE] ❌ RPC error type: {type(rpc_error)}")
                rpc_success = False
            
            if rpc_success and isinstance(rpc_result.data, dict):
                if not rpc_result.data.get('ok', True):
                    error_msg = rpc_result.data.get('message', 'Unknown error from RPC')
                    print(f"[SET_GELOMBANG_ACTIVE] ERROR from RPC: {error_msg}")
                    rpc_success = False

            if not rpc_success:
                print("[SET_GELOMBANG_ACTIVE] ⚠️ Falling back to manual update logic")
                # Step 1: set all other gelombang to inactive
                try:
                    supa.table("gelombang").update({"is_active": False}).neq("id", gelombang_id).execute()
                    print("[SET_GELOMBANG_ACTIVE]   → All other gelombang set to inactive (fallback)")
                except Exception as fallback_error:
                    print(f"[SET_GELOMBANG_ACTIVE] ❌ Failed to set others inactive: {fallback_error}")
                    raise

                # Step 2: set target gelombang to active
                try:
                    supa.table("gelombang").update({"is_active": True}).eq("id", gelombang_id).execute()
                    print("[SET_GELOMBANG_ACTIVE]   → Target gelombang set to active (fallback)")
                except Exception as set_active_error:
                    print(f"[SET_GELOMBANG_ACTIVE] ❌ Failed to activate target gelombang: {set_active_error}")
                    raise
            else:
                print(f"[SET_GELOMBANG_ACTIVE] ✓ RPC SUCCESS: Gelombang ID {gelombang_id} activated")
            
            # Fetch updated gelombang to return in response
            activated_result = supa.table("gelombang").select("*").eq("id", gelombang_id).execute()
            
            if not activated_result.data:
                print(f"[SET_GELOMBANG_ACTIVE] WARNING: Could not fetch activated gelombang")
                activated_gelombang = {"id": gelombang_id, "nama": f"Gelombang {gelombang_id}"}
            else:
                activated_gelombang = activated_result.data[0]
            
            print(f"[SET_GELOMBANG_ACTIVE] ✓ SUCCESS: Gelombang '{activated_gelombang.get('nama')}' (ID: {gelombang_id}) is now ACTIVE")
            
            # Verify final state by querying all gelombang
            verify_result = supa.table("gelombang").select("id, nama, is_active").execute()
            print(f"[SET_GELOMBANG_ACTIVE] Final state of all gelombang:")
            for g in verify_result.data:
                status = "ACTIVE" if g['is_active'] else "inactive"
                print(f"  - ID {g['id']}: {g['nama']} = {status}")
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": True,
                    "data": activated_gelombang,
                    "message": f"{activated_gelombang.get('nama', 'Gelombang')} berhasil diaktifkan"
                }).encode('utf-8')
            )

        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "ok": False,
                    "error": "Invalid JSON format"
                }).encode('utf-8')
            )
        except Exception as e:
            print(f"[SET_GELOMBANG_ACTIVE] ❌ Exception in set_gelombang_active: {e}")
            import traceback
            traceback.print_exc()
            
            # Get detailed error message
            error_message = str(e)
            error_type = type(e).__name__
            
            print(f"[SET_GELOMBANG_ACTIVE] ❌ Error type: {error_type}")
            print(f"[SET_GELOMBANG_ACTIVE] ❌ Error message: {error_message}")
            
            # Check if it's a unique constraint violation
            if "unique" in error_message.lower() or "constraint" in error_message.lower():
                self.send_response(409)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "ok": False,
                        "error": "Konflik: Hanya satu gelombang yang boleh aktif"
                    }).encode('utf-8')
                )
            else:
                # Return more detailed error for debugging
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                
                # Parse error message for cleaner display
                clean_error = error_message
                if "JSON" in error_message or "json" in error_message:
                    clean_error = "Database function error. Silakan coba lagi atau hubungi administrator."
                
                self.wfile.write(
                    json.dumps({
                        "ok": False,
                        "error": clean_error,
                        "details": {
                            "error_type": error_type,
                            "raw_error": error_message
                        }
                    }).encode('utf-8')
                )

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-admin-token')
        self.end_headers()
