#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Handler: Get Active Gelombang (PUBLIC)
Endpoint: GET /api/gelombang_active
Returns: Single active gelombang or null
"""

from http.server import BaseHTTPRequestHandler
import json
from typing import Dict, Any

try:
    from .._supabase import supabase_client
except ImportError:
    from _supabase import supabase_client


def _send_json(request_handler, code: int, payload: Dict[str, Any]) -> None:
    """Helper to send JSON response with CORS headers"""
    data = json.dumps(payload, default=str).encode('utf-8')
    request_handler.send_response(code)
    request_handler.send_header('Content-Type', 'application/json; charset=utf-8')
    request_handler.send_header('Content-Length', str(len(data)))
    request_handler.send_header('Access-Control-Allow-Origin', '*')
    request_handler.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    request_handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    request_handler.end_headers()
    request_handler.wfile.write(data)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/gelombang_active
        Returns: { ok: true, data: { id, nama, start_date, end_date, tahun_ajaran, is_active, urutan } | null }
        """
        print("[GELOMBANG_ACTIVE] GET request received")
        
        try:
            # Initialize Supabase client (ANON key for public access)
            supa = supabase_client(service_role=False)
            print("[GELOMBANG_ACTIVE] Supabase client initialized (ANON)")
            
            # Query only active gelombang
            result = (
                supa.table("gelombang")
                .select("id,nama,start_date,end_date,tahun_ajaran,is_active,urutan")
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            
            print(f"[GELOMBANG_ACTIVE] Query result: {result.data}")
            
            # Return single active gelombang or null
            active_gelombang = result.data[0] if result.data else None
            
            if active_gelombang:
                print(f"[GELOMBANG_ACTIVE] Active gelombang found: {active_gelombang['nama']}")
            else:
                print("[GELOMBANG_ACTIVE] No active gelombang found")
            
            return _send_json(self, 200, {
                "ok": True,
                "data": active_gelombang
            })
            
        except Exception as e:
            print(f"[GELOMBANG_ACTIVE] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return _send_json(self, 500, {
                "ok": False,
                "error": str(e)
            })
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        return _send_json(self, 204, {})

