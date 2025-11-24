"""
API Handler: GET/POST /api/maintenance_status
Menyimpan flag maintenance global agar admin bisa mengunci situs saat perawatan.
"""
from http.server import BaseHTTPRequestHandler

from lib._supabase import supabase_client
from ._crud_helpers import (
    allow_cors,
    now_timestamp,
    read_json_body,
    send_json,
)

TABLE_NAME = "maintenance_settings"


def _public_client():
    return supabase_client(service_role=True)


def _admin_client():
    return supabase_client(service_role=True)


def _normalize_row(row):
    if not row:
        return {
            "active": False,
            "message": "",
            "updated_at": None,
            "updated_by": "",
        }
    return {
        "active": bool(row.get("is_active") or row.get("active") or False),
        "message": row.get("message") or "",
        "updated_at": row.get("updated_at"),
        "updated_by": row.get("updated_by") or row.get("updatedBy") or "",
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            result = (
                _public_client()
                .table(TABLE_NAME)
                .select("*")
                .limit(1)
                .execute()
            )
            row = result.data[0] if result and result.data else None
            send_json(
                self,
                200,
                {"ok": True, "data": _normalize_row(row)},
            )
        except Exception as exc:
            print(f"[MAINTENANCE][GET] Error: {exc}")
            send_json(
                self,
                500,
                {"ok": False, "error": "Gagal memuat status maintenance"},
            )

    def do_POST(self):
        try:
            payload = read_json_body(self)
            active = bool(payload.get("active"))
            message = (payload.get("message") or "").strip()
            updated_by = (payload.get("updatedBy") or payload.get("updated_by") or "").strip()

            admin = _admin_client()
            record = {
                "is_active": active,
                "message": message,
                "updated_by": updated_by,
                "updated_at": now_timestamp(),
            }

            existing = admin.table(TABLE_NAME).select("id").limit(1).execute()

            if existing.data:
                record_id = existing.data[0]["id"]
                result = (
                    admin.table(TABLE_NAME)
                    .update(record)
                    .eq("id", record_id)
                    .execute()
                )
                data = result.data[0] if result.data else {**record, "id": record_id}
            else:
                result = admin.table(TABLE_NAME).insert(record).execute()
                data = result.data[0] if result.data else record

            send_json(
                self,
                200,
                {"ok": True, "message": "Status maintenance diperbarui", "data": _normalize_row(data)},
            )
        except ValueError as exc:
            send_json(self, 400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            print(f"[MAINTENANCE][POST] Error: {exc}")
            send_json(
                self,
                500,
                {"ok": False, "error": "Gagal menyimpan status maintenance"},
            )

    def do_OPTIONS(self):
        allow_cors(self, ["GET", "POST", "OPTIONS"])
