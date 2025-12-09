from http.server import BaseHTTPRequestHandler
import json
import base64
import csv
from io import StringIO
from lib._supabase import supabase_client
from lib.handlers._crud_helpers import send_json, read_json_body, allow_cors

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = read_json_body(self)
            file_base64 = body.get("file")
            
            if not file_base64:
                return send_json(self, 400, {"ok": False, "error": "No file provided"})

            # Decode base64
            if isinstance(file_base64, str) and file_base64.startswith("data:"):
                file_base64 = file_base64.split(",", 1)[1]
            
            try:
                file_bytes = base64.b64decode(file_base64)
                csv_text = file_bytes.decode('utf-8')
            except Exception as e:
                return send_json(self, 400, {"ok": False, "error": f"Failed to decode file: {str(e)}"})

            # Parse CSV
            # Expected format: Question, Answer, Keywords(optional)
            rows = []
            try:
                csv_reader = csv.reader(StringIO(csv_text))
                header = next(csv_reader, None) # Skip header if exists, or handle it?
                # Let's assume first row is header if it looks like "question,answer"
                # Or just treat all as data if they match column count.
                # Safer: Check if first row is header.
                
                # We will just iterate and expect at least 2 columns.
                if header:
                    # Simple heuristic: if first col is "question" (case insensitive), skip it
                    if header[0].lower().strip() == "question":
                        pass 
                    else:
                        # It's data
                        if len(header) >= 2:
                            rows.append({
                                "question": header[0],
                                "answer": header[1],
                                "keywords": header[2] if len(header) > 2 else ""
                            })

                for row in csv_reader:
                    if len(row) >= 2:
                        rows.append({
                            "question": row[0],
                            "answer": row[1],
                            "keywords": row[2] if len(row) > 2 else ""
                        })
            except Exception as e:
                return send_json(self, 400, {"ok": False, "error": f"Failed to parse CSV: {str(e)}"})

            if not rows:
                return send_json(self, 400, {"ok": False, "error": "CSV is empty or invalid format"})

            # Update Database
            supa = supabase_client(service_role=True)
            
            # 1. Delete all existing FAQs (Replace mode)
            # Note: delete() requires a filter. To delete all, we can use a condition that is always true or delete by ID list.
            # Supabase-js: .delete().neq('id', 0) ?
            # Or just separate calls.
            # Let's try deleting everything where id > 0
            del_res = supa.table("faq_kb").delete().gt("id", 0).execute()
            
            # 2. Insert new rows
            # Supabase allows bulk insert
            ins_res = supa.table("faq_kb").insert(rows).execute()
            
            return send_json(self, 200, {
                "ok": True, 
                "message": f"Successfully imported {len(rows)} FAQs",
                "deleted": len(del_res.data) if del_res.data else 0,
                "inserted": len(ins_res.data) if ins_res.data else 0
            })

        except Exception as e:
            print(f"Error in admin_faq: {e}")
            return send_json(self, 500, {"ok": False, "error": str(e)})

    def do_OPTIONS(self):
        allow_cors(self, ["POST", "OPTIONS"])
