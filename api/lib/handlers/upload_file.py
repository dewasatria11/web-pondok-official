from http.server import BaseHTTPRequestHandler
import json
import base64
import re
from datetime import datetime
from io import BytesIO
from PIL import Image
from lib._supabase import supabase_client

# ---------- Utilities (format-preserving) ----------
def _maybe_downscale(img: Image.Image, max_side: int = 1600) -> Image.Image:
    w, h = img.size
    if max(w, h) > max_side:
        if w >= h:
            new_w = max_side
            new_h = int(h * (max_side / w))
        else:
            new_h = max_side
            new_w = int(w * (max_side / h))
        return img.resize((new_w, new_h), resample=Image.LANCZOS)
    return img

def compress_image_keep_format(file_data: bytes, target_kb: int, orig_ext: str):
    """
    JPG/JPEG: turunkan quality bertahap (min quality 40) + optional downscale.
    PNG: pertahankan PNG (alpha aman), quantize + optimize + compress_level,
         lalu optional downscale bertahap.
    Return: (bytes_hasil, ext_out, mime_out)
    """
    ext = (orig_ext or "jpg").lower()

    if ext in ["jpg", "jpeg"]:
        img = Image.open(BytesIO(file_data)).convert("RGB")
        img = _maybe_downscale(img, max_side=1600)
        quality, min_quality = 85, 40
        best = None
        while True:
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            size_kb = buf.tell() / 1024
            print(f"[COMP-JPG] {size_kb:.1f} KB @q={quality}")
            best = buf.getvalue()
            if size_kb <= target_kb or quality <= min_quality:
                break
            quality -= 5
        return best, ("jpeg" if ext == "jpeg" else "jpg"), "image/jpeg"

    if ext == "png":
        img = Image.open(BytesIO(file_data))
        has_alpha = (img.mode in ("RGBA", "LA")) or ("transparency" in img.info)
        if not has_alpha and img.mode not in ("RGB", "L", "P"):
            img = img.convert("RGB")
        img = _maybe_downscale(img, max_side=1600)

        palette_steps = [256, 128, 64]
        best_bytes, best_size = None, float("inf")
        for colors in palette_steps:
            candidate = img
            if candidate.mode not in ("P", "L"):
                if has_alpha:
                    rgb = candidate.convert("RGB")
                    q = rgb.quantize(colors=colors, method=Image.MEDIANCUT)
                    candidate = q.convert("RGBA")
                    if "A" not in candidate.getbands():
                        candidate.putalpha(255)
                else:
                    candidate = candidate.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT)

            buf = BytesIO()
            candidate.save(buf, format="PNG", optimize=True, compress_level=9)
            size_kb = buf.tell() / 1024
            print(f"[COMP-PNG] {size_kb:.1f} KB @colors={colors}")

            if size_kb < best_size:
                best_size = size_kb
                best_bytes = buf.getvalue()

            if size_kb <= target_kb:
                break

        # downscale bertahap jika masih besar
        tries = 0
        while best_size > target_kb and tries < 4:
            tries += 1
            w, h = img.size
            new_w = max(600, int(w * 0.9))
            new_h = max(600, int(h * 0.9))
            if new_w == w and new_h == h:
                break
            img = img.resize((new_w, new_h), resample=Image.LANCZOS)

            buf = BytesIO()
            img_to_save = img
            if img_to_save.mode not in ("RGB", "L", "RGBA", "P"):
                img_to_save = img_to_save.convert("RGBA" if has_alpha else "RGB")

            img_to_save.save(buf, format="PNG", optimize=True, compress_level=9)
            size_kb = buf.tell() / 1024
            print(f"[COMP-PNG-DS] {size_kb:.1f} KB @downscale#{tries}")
            if size_kb < best_size:
                best_size = size_kb
                best_bytes = buf.getvalue()

        if best_bytes is None:
            best_bytes = file_data
        return best_bytes, "png", "image/png"

    # bukan gambar
    return file_data, ext, None


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # === helper lokal: tidak bergantung pada atribut class lain ===
        def send_json(code: int, payload: dict):
            self.send_response(code)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode())

        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(length)
            try:
                data = json.loads(raw.decode("utf-8"))
            except Exception as e:
                return send_json(400, {"ok": False, "error": f"Invalid JSON body: {e}"})

            file_base64 = data.get("file")
            file_name   = data.get("fileName")
            file_type   = data.get("fileType")
            nisn        = data.get("nisn")
            already_compressed = data.get("alreadyCompressed", False)
            client_mime_type = data.get("mimeType")

            print(f"[REQ] upload_file: name={file_name}, type={file_type}, nisn={nisn}, client_compressed={already_compressed}")

            # Validasi input
            if not all([file_base64, file_name, nisn]):
                return send_json(400, {"ok": False, "error": "Missing required fields: file, fileName, nisn"})

            if nisn == "undefined" or not str(nisn).strip():
                return send_json(400, {"ok": False, "error": "NISN tidak valid"})

            if not re.match(r"^\d{10}$", str(nisn)):
                return send_json(400, {"ok": False, "error": "Format NISN tidak valid. Harus 10 digit angka"})

            # Ambil base64 data (hilangkan prefix data:)
            if isinstance(file_base64, str) and file_base64.startswith("data:"):
                try:
                    file_base64 = file_base64.split(",", 1)[1]
                except Exception:
                    return send_json(400, {"ok": False, "error": "Format data URL tidak valid"})

            # Decode
            try:
                file_data = base64.b64decode(file_base64)
            except Exception as e:
                return send_json(400, {"ok": False, "error": f"Gagal decode file: {e}"})

            print(f"[INFO] decoded bytes: {len(file_data)}")

            # Validasi ekstensi
            allowed = ["jpg", "jpeg", "png", "pdf", "doc", "docx"]
            ext = (file_name.split(".")[-1] or "").lower()
            if ext not in allowed:
                return send_json(400, {"ok": False, "error": f"Tipe file tidak diizinkan. Hanya: {', '.join(allowed)}"})

            # Kompresi gambar berdasarkan flag alreadyCompressed dari client
            forced_mime = None
            if ext in ["jpg", "jpeg", "png"]:
                if already_compressed:
                    print("[INFO] Gambar sudah dikompresi client-side. Melewati kompresi server.")
                    # Jika sudah dikompresi client, gunakan MIME dari client atau default
                    forced_mime = client_mime_type or (f"image/{ext}" if ext != "jpeg" else "image/jpeg")
                else:
                    print("[INFO] Gambar belum dikompresi client-side. Melakukan kompresi server.")
                    try:
                        file_data, ext, forced_mime = compress_image_keep_format(
                            file_data, target_kb=500, orig_ext=ext
                        )
                        print(f"[INFO] after server compress: {len(file_data)} bytes, ext={ext}, mime={forced_mime}")
                    except Exception as e:
                        print(f"[WARN] kompresi server gagal: {e}")
                        forced_mime = None # Reset forced_mime if server compression failed
            else:
                print(f"[INFO] File {file_name} bukan gambar, tidak dikompresi.")
                # For non-image files, use client_mime_type if provided, else rely on mime_map
                forced_mime = client_mime_type if client_mime_type else None

            # Batas akhir server
            if len(file_data) > 5 * 1024 * 1024:
                return send_json(400, {"ok": False, "error": "Ukuran file maksimal 5MB setelah kompres"})

            # Filename unik (gunakan file_name dari client, karena sudah diformat di client)
            unique_filename = f"{nisn}/{file_name}"
            print(f"[INFO] path: {unique_filename}")

            # Upload ke Supabase
            try:
                supa = supabase_client(service_role=True)
                mime_map = {
                    "jpg": "image/jpeg",
                    "jpeg": "image/jpeg",
                    "png": "image/png",
                    "pdf": "application/pdf",
                    "doc": "application/msword",
                    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                }
                content_type = forced_mime or mime_map.get(ext, "application/octet-stream")

                resp = supa.storage.from_("pendaftar-files").upload(
                    path=unique_filename,
                    file=file_data,
                    file_options={"content-type": content_type},
                )
                print(f"[INFO] upload resp: {resp}")

                public_url = supa.storage.from_("pendaftar-files").get_public_url(unique_filename)
                print(f"[INFO] public url: {public_url}")

                return send_json(200, {"ok": True, "url": public_url, "filename": unique_filename})
            except Exception as e:
                msg = str(e)
                print(f"[ERR] upload error: {msg}")
                if "Bucket not found" in msg or "404" in msg:
                    msg = "Storage bucket 'pendaftar-files' belum dibuat. Silakan buat bucket di Supabase Dashboard > Storage."
                elif "duplicate" in msg.lower():
                    msg = "File dengan nama yang sama sudah ada."
                return send_json(500, {"ok": False, "error": msg})

        except Exception as e:
            # last-resort error handler
            print(f"[FATAL] {e}")
            return send_json(500, {"ok": False, "error": f"Internal error: {e}"})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
