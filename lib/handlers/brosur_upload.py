from http.server import BaseHTTPRequestHandler
import base64
import re
import time
from lib._supabase import supabase_client
from lib.handlers._crud_helpers import read_json_body, send_json, allow_cors


def _slugify_filename(name: str) -> str:
    # Keep alnum, dash, underscore; replace others with dash
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name).strip("-")
    return slug or "brosur"


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = read_json_body(self)
            file_b64 = body.get("file")
            file_name = (body.get("fileName") or "brosur.pdf").strip()

            if not file_b64 or not file_name:
                return send_json(self, 400, {"ok": False, "error": "File dan nama wajib diisi"})

            # Allow PDF, JPG, PNG
            ext = (file_name.split(".")[-1] or "").lower()
            allowed_extensions = {"pdf", "jpg", "jpeg", "png"}
            if ext not in allowed_extensions:
                return send_json(self, 400, {"ok": False, "error": "Hanya PDF, JPG, atau PNG yang diperbolehkan"})

            # Map extension to MIME type
            mime_types = {
                "pdf": "application/pdf",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png"
            }
            content_type = mime_types.get(ext, "application/octet-stream")

            # Strip data URL prefix if present
            if isinstance(file_b64, str) and file_b64.startswith("data:"):
                file_b64 = file_b64.split(",", 1)[1]

            try:
                file_bytes = base64.b64decode(file_b64)
            except Exception as e:
                return send_json(self, 400, {"ok": False, "error": f"Gagal decode file: {e}"})

            if not file_bytes:
                return send_json(self, 400, {"ok": False, "error": "Isi file kosong"})

            max_size = 8 * 1024 * 1024  # 8MB
            if len(file_bytes) > max_size:
                return send_json(self, 400, {"ok": False, "error": "Ukuran file maksimal 8MB"})

            base_name = ".".join(file_name.split(".")[:-1]) or "brosur"
            safe_name = _slugify_filename(base_name)
            ts = int(time.time())
            storage_path = f"brosur/{ts}-{safe_name}.{ext}"

            try:
                supa = supabase_client(service_role=True)
                supa.storage.from_("brosur-files").upload(
                    path=storage_path,
                    file=file_bytes,
                    file_options={
                        "content-type": content_type,
                    },
                )
                public_url = supa.storage.from_("brosur-files").get_public_url(storage_path)
            except Exception as e:
                msg = str(e)
                if "Bucket not found" in msg or "404" in msg:
                    msg = "Bucket storage 'brosur-files' belum dibuat. Silakan buat bucket publik bernama brosur-files."
                return send_json(self, 500, {"ok": False, "error": msg})

            return send_json(
                self,
                200,
                {
                    "ok": True,
                    "url": public_url,
                    "path": storage_path,
                    "size": len(file_bytes),
                    "mime": content_type,
                },
            )
        except Exception as e:
            print(f"[BROSUR_UPLOAD] Error: {e}")
            return send_json(self, 500, {"ok": False, "error": str(e)})

    def do_OPTIONS(self):
        allow_cors(self, ["POST", "OPTIONS"])
