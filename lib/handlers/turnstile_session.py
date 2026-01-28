"""
Cloudflare Turnstile Session Handler
Handles verification and session management for landing page Turnstile
"""

import os
import json
from datetime import datetime, timedelta
import requests
from typing import Tuple
from http.server import BaseHTTPRequestHandler


def verify_turnstile_token(token: str, remote_ip: str = "") -> Tuple[bool, str]:
    """
    Verify Cloudflare Turnstile token with Cloudflare API
    
    Args:
        token: Turnstile response token
        remote_ip: User's IP address (optional)
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    secret_key = (
        os.getenv("TURNSTILE_SECRET_KEY")
        or os.getenv("CLOUDFLARE_TURNSTILE_SECRET_KEY")
    )
    
    if not secret_key:
        print("[TURNSTILE] Warning: No secret key configured")
        return False, "Server configuration error"
    
    if not token:
        return False, "No verification token provided"
    
    url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    payload = {
        "secret": secret_key,
        "response": token,
    }
    
    if remote_ip:
        payload["remoteip"] = remote_ip
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        success = data.get("success", False)
        
        if success:
            print(f"[TURNSTILE] Token verification successful")
            return True, ""
        else:
            error_codes = data.get("error-codes", [])
            print(f"[TURNSTILE] Verification failed: {error_codes}")
            return False, f"Verification failed: {', '.join(error_codes)}"
            
    except requests.RequestException as exc:
        print(f"[TURNSTILE] Network error: {exc}")
        return False, "Network error during verification"
    except Exception as exc:
        print(f"[TURNSTILE] Unexpected error: {exc}")
        return False, "Unexpected error during verification"


class handler(BaseHTTPRequestHandler):
    """Handler for Turnstile session verification endpoint"""
    
    @staticmethod
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()
    
    @staticmethod
    def do_POST(self):
        """Handle POST /api/verify-turnstile-session - Verify Turnstile token"""
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body) if body else {}
            
            token = data.get("cf-turnstile-response") or data.get("cf_turnstile_response")
            
            if not token:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "No Turnstile token provided"
                }).encode())
                return
            
            # Get client IP
            client_ip = self.headers.get("CF-Connecting-IP") or self.headers.get("X-Real-IP") or ""
            
            # Verify with Cloudflare
            is_valid, error_msg = verify_turnstile_token(token, client_ip)
            
            if is_valid:
                # Send success response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "message": "Verification successful",
                    "expires_at": (datetime.now() + timedelta(hours=1)).isoformat()
                }).encode())
            else:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": error_msg or "Verification failed"
                }).encode())
                
        except Exception as exc:
            print(f"[TURNSTILE SESSION] Error: {exc}")
            import traceback
            traceback.print_exc()
            
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": "Server error"
            }).encode())
