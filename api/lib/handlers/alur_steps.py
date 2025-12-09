"""
API Handler untuk CRUD alur_pendaftaran_steps
"""
from http.server import BaseHTTPRequestHandler

from .._supabase import supabase_client
from ._crud_helpers import (
    read_json_body,
    send_json,
    now_timestamp,
    allow_cors,
)


TABLE_NAME = "alur_pendaftaran_steps"
ORDER_FIELD = "order_index"


def _get_public_client():
    return supabase_client(service_role=False)


def _get_admin_client():
    return supabase_client(service_role=True)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            supa = _get_public_client()
            result = (
                supa.table(TABLE_NAME)
                .select("*")
                .order(ORDER_FIELD, desc=False)
                .execute()
            )

            data = result.data or []
            send_json(self, 200, {"ok": True, "data": data})
        except Exception as exc:
            print(f"[ALUR_STEPS][GET] Error: {exc}")
            send_json(
                self,
                500,
                {"ok": False, "error": f"Gagal mengambil data: {exc}"},
            )

    def do_POST(self):
        try:
            payload = read_json_body(self)
            title = (payload.get("title") or "").strip()
            description = (payload.get("description") or "").strip()
            title_en = (payload.get("title_en") or "").strip()
            description_en = (payload.get("description_en") or "").strip()
            order_index = payload.get("order_index")

            if not title or not description:
                raise ValueError("Judul dan deskripsi wajib diisi")
            if not title_en or not description_en:
                raise ValueError("Title EN dan description EN wajib diisi")

            admin_client = _get_admin_client()

            if order_index is None:
                # Ambil order terbesar lalu tambahkan 1
                order_result = (
                    admin_client.table(TABLE_NAME)
                    .select(ORDER_FIELD)
                    .order(ORDER_FIELD, desc=True)
                    .limit(1)
                    .execute()
                )
                if order_result.data:
                    order_index = (order_result.data[0].get(ORDER_FIELD) or 0) + 1
                else:
                    order_index = 1

            insert_payload = {
                "title": title,
                "description": description,
                "title_en": title_en,
                "description_en": description_en,
                ORDER_FIELD: order_index,
            }

            result = admin_client.table(TABLE_NAME).insert(insert_payload).execute()
            created = result.data[0] if result.data else insert_payload

            send_json(
                self,
                200,
                {"ok": True, "message": "Alur berhasil dibuat", "data": created},
            )
        except Exception as exc:
            print(f"[ALUR_STEPS][POST] Error: {exc}")
            send_json(
                self,
                400,
                {"ok": False, "error": str(exc)},
            )

    def do_PUT(self):
        try:
            payload = read_json_body(self)

            # Bulk reorder support
            items = payload.get("items")
            if isinstance(items, list):
                updated = []
                admin_client = _get_admin_client()

                for idx, item in enumerate(items):
                    item_id = item.get("id")
                    if not item_id:
                        continue
                    order_value = item.get(ORDER_FIELD, idx + 1)
                    update_payload = {
                        ORDER_FIELD: order_value,
                        "updated_at": now_timestamp(),
                    }
                    res = (
                        admin_client.table(TABLE_NAME)
                        .update(update_payload)
                        .eq("id", item_id)
                        .execute()
                    )
                    if res.data:
                        updated.append(res.data[0])

                send_json(
                    self,
                    200,
                    {
                        "ok": True,
                        "message": "Urutan alur berhasil diperbarui",
                        "data": updated,
                    },
                )
                return

            item_id = payload.get("id")
            if not item_id:
                raise ValueError("Parameter id wajib disertakan")

            update_fields = {}
            if "title" in payload and payload["title"]:
                update_fields["title"] = payload["title"].strip()
            if "description" in payload and payload["description"]:
                update_fields["description"] = payload["description"].strip()
            if "title_en" in payload and payload["title_en"]:
                update_fields["title_en"] = payload["title_en"].strip()
            if "description_en" in payload and payload["description_en"]:
                update_fields["description_en"] = payload["description_en"].strip()
            if ORDER_FIELD in payload and payload[ORDER_FIELD] is not None:
                update_fields[ORDER_FIELD] = int(payload[ORDER_FIELD])

            if not update_fields:
                raise ValueError("Tidak ada perubahan yang dikirim")

            update_fields["updated_at"] = now_timestamp()

            admin_client = _get_admin_client()
            result = (
                admin_client.table(TABLE_NAME)
                .update(update_fields)
                .eq("id", item_id)
                .execute()
            )

            updated = result.data[0] if result.data else None
            send_json(
                self,
                200,
                {"ok": True, "message": "Alur berhasil diperbarui", "data": updated},
            )
        except Exception as exc:
            print(f"[ALUR_STEPS][PUT] Error: {exc}")
            send_json(
                self,
                400,
                {"ok": False, "error": str(exc)},
            )

    def do_DELETE(self):
        try:
            payload = read_json_body(self)
            item_id = payload.get("id")
            if not item_id:
                raise ValueError("Parameter id wajib disertakan")

            admin_client = _get_admin_client()
            admin_client.table(TABLE_NAME).delete().eq("id", item_id).execute()

            send_json(
                self,
                200,
                {"ok": True, "message": "Alur berhasil dihapus"},
            )
        except Exception as exc:
            print(f"[ALUR_STEPS][DELETE] Error: {exc}")
            send_json(
                self,
                400,
                {"ok": False, "error": str(exc)},
            )

    def do_OPTIONS(self):
        allow_cors(self, ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
