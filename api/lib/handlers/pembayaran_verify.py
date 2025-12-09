from http.server import BaseHTTPRequestHandler
import json
import re
from typing import List, Optional
from lib._supabase import supabase_client

def _normalize_digits(value: str) -> str:
    """Hilangkan semua karakter non-digit."""
    return re.sub(r"\D", "", value or "")

def _dedupe(values: List[str]) -> List[str]:
    seen = set()
    result: List[str] = []
    for value in values:
        if not value:
            continue
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode("utf-8"))

            raw_identifier = str(
                data.get("nisn")
                or data.get("identifier")
                or data.get("nik")
                or ""
            ).strip()

            if not raw_identifier:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Identifier (NISN / NIK) wajib diisi"}).encode())
                return

            normalized_identifier = _normalize_digits(raw_identifier)
            identifier_candidates = _dedupe(
                [raw_identifier, normalized_identifier]
            )

            if not normalized_identifier or len(normalized_identifier) not in (10, 16):
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "Identifier tidak valid. Gunakan NISN (10 digit) atau NIK (16 digit)"
                }).encode())
                return

            if "status" not in data or not data["status"]:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "status is required"}).encode())
                return

            valid_statuses = ["VERIFIED", "REJECTED"]
            status = str(data["status"]).upper()
            if status not in valid_statuses:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
                }).encode())
                return

            supa = supabase_client(service_role=True)

            # Cari pembayaran berdasarkan NISN/NIK
            payment_row: Optional[dict] = None
            matched_identifier: Optional[str] = None
            for candidate in identifier_candidates:
                if not candidate:
                    continue
                found = False
                for field in ("nisn", "nik"):
                    try:
                        result = (
                            supa.table("pembayaran")
                            .select("*")
                            .eq(field, candidate)
                            .order("updated_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                    except Exception as query_error:
                        print(
                            f"[PEMBAYARAN_VERIFY] Warning: gagal query pembayaran field={field} candidate={candidate}: {query_error}"
                        )
                        continue

                    if result.data:
                        payment_row = result.data[0]
                        matched_identifier = candidate
                        found = True
                        break
                if found:
                    break

            if not payment_row:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Pembayaran dengan NISN/NIK tersebut tidak ditemukan"}).encode())
                return

            payment_id = payment_row.get("id")
            if not payment_id:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Data pembayaran tidak lengkap (ID kosong)"}).encode())
                return

            verified_by = data.get("verified_by", data.get("verifiedBy", "admin"))
            update_payload = {
                "status_pembayaran": status,
                "verified_by": verified_by,
                "catatan_admin": data.get("catatan_admin", ""),
                "tanggal_verifikasi": "now()",
                "updated_at": "now()",
            }

            update_result = (
                supa.table("pembayaran").update(update_payload).eq("id", payment_id).execute()
            )

            if not update_result.data:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Gagal memperbarui data pembayaran"}).encode())
                return

            pendaftar_updated = False
            if status == "VERIFIED":
                try:
                    pendaftar_identifiers = _dedupe(
                        identifier_candidates
                        + [
                            str(payment_row.get("nisn") or "").strip(),
                            _normalize_digits(payment_row.get("nisn") or ""),
                            str(payment_row.get("nik") or "").strip(),
                            _normalize_digits(payment_row.get("nik") or ""),
                        ]
                    )

                    pendaftar_row: Optional[dict] = None
                    for candidate in pendaftar_identifiers:
                        if not candidate:
                            continue
                        matched = False
                        for field in ("nisn", "nikcalon", "nik"):
                            try:
                                res = (
                                    supa.table("pendaftar")
                                    .select("id")
                                    .eq(field, candidate)
                                    .order("updatedat", desc=True)
                                    .limit(1)
                                    .execute()
                                )
                            except Exception as p_query_error:
                                print(
                                    f"[PEMBAYARAN_VERIFY] Warning: gagal query pendaftar field={field} candidate={candidate}: {p_query_error}"
                                )
                                continue

                            if res.data:
                                pendaftar_row = res.data[0]
                                matched = True
                                break
                        if matched:
                            break

                    if pendaftar_row and pendaftar_row.get("id"):
                        pendaftar_update = {
                            "statusberkas": "DITERIMA",
                            "verifiedby": verified_by,
                            "verifiedat": "now()",
                            "updatedat": "now()",
                        }
                        supa.table("pendaftar").update(pendaftar_update).eq(
                            "id", pendaftar_row["id"]
                        ).execute()
                        pendaftar_updated = True
                except Exception as update_err:
                    print(f"Warning: Gagal update status pendaftar: {update_err}")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "message": f"Pembayaran berhasil di{status.lower()}",
                "identifier": matched_identifier or normalized_identifier,
                "status": status,
                "pendaftar_updated": pendaftar_updated,
            }).encode())

        except Exception as e:
            print(f"Error in pembayaran_verify: {str(e)}")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
