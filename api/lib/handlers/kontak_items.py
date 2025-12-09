"""
API Handler untuk CRUD kontak_items
"""
from http.server import BaseHTTPRequestHandler

from .._supabase import supabase_client
from ._crud_helpers import (
    read_json_body,
    send_json,
    now_timestamp,
    allow_cors,
)


TABLE_NAME = "kontak_items"
ORDER_FIELD = "order_index"


def _public():
    return supabase_client(service_role=False)


def _admin():
    return supabase_client(service_role=True)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            result = (
                _public()
                .table(TABLE_NAME)
                .select("*")
                .order(ORDER_FIELD, desc=False)
                .execute()
            )
            send_json(self, 200, {"ok": True, "data": result.data or []})
        except Exception as exc:
            print(f"[KONTAK_ITEMS][GET] Error: {exc}")
            send_json(
                self, 500, {"ok": False, "error": f"Gagal mengambil data: {exc}"}
            )

    def do_POST(self):
        try:
            payload = read_json_body(self)
            title = (payload.get("title") or "").strip()
            value = (payload.get("value") or "").strip()
            title_en = (payload.get("title_en") or "").strip()
            value_en = (payload.get("value_en") or "").strip()
            item_type = (payload.get("item_type") or "info").strip() or "info"
            link_url = (payload.get("link_url") or "").strip() or None
            icon_class = (payload.get("icon_class") or "bi bi-info-circle").strip()
            order_index = payload.get(ORDER_FIELD)

            if not title or not value or not title_en or not value_en:
                raise ValueError("Judul dan nilai kontak (ID & EN) wajib diisi")

            admin = _admin()
            if order_index is None:
                order_result = (
                    admin.table(TABLE_NAME)
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
                "value": value,
                "title_en": title_en,
                "value_en": value_en,
                "item_type": item_type,
                "link_url": link_url,
                "icon_class": icon_class or "bi bi-info-circle",
                ORDER_FIELD: order_index,
            }
            result = admin.table(TABLE_NAME).insert(insert_payload).execute()
            created = result.data[0] if result.data else insert_payload

            send_json(
                self,
                200,
                {"ok": True, "message": "Kontak berhasil ditambahkan", "data": created},
            )
        except Exception as exc:
            print(f"[KONTAK_ITEMS][POST] Error: {exc}")
            send_json(self, 400, {"ok": False, "error": str(exc)})

    def do_PUT(self):
        try:
            payload = read_json_body(self)

            items = payload.get("items")
            if isinstance(items, list):
                admin = _admin()
                updated = []
                for idx, item in enumerate(items):
                    item_id = item.get("id")
                    if not item_id:
                        continue
                    new_order = item.get(ORDER_FIELD, idx + 1)
                    data = {ORDER_FIELD: int(new_order), "updated_at": now_timestamp()}
                    res = (
                        admin.table(TABLE_NAME)
                        .update(data)
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
                        "message": "Urutan kontak diperbarui",
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
            if "value" in payload and payload["value"]:
                update_fields["value"] = payload["value"].strip()
            if "title_en" in payload and payload["title_en"]:
                update_fields["title_en"] = payload["title_en"].strip()
            if "value_en" in payload and payload["value_en"]:
                update_fields["value_en"] = payload["value_en"].strip()
            if "item_type" in payload and payload["item_type"]:
                update_fields["item_type"] = payload["item_type"].strip() or "info"
            if "link_url" in payload:
                link_val = payload["link_url"]
                update_fields["link_url"] = link_val.strip() if link_val else None
            if "icon_class" in payload and payload["icon_class"]:
                update_fields["icon_class"] = payload["icon_class"].strip()
            if ORDER_FIELD in payload and payload[ORDER_FIELD] is not None:
                update_fields[ORDER_FIELD] = int(payload[ORDER_FIELD])

            if not update_fields:
                raise ValueError("Tidak ada perubahan yang dikirim")

            update_fields["updated_at"] = now_timestamp()

            admin = _admin()
            result = (
                admin.table(TABLE_NAME)
                .update(update_fields)
                .eq("id", item_id)
                .execute()
            )
            updated = result.data[0] if result.data else None

            send_json(
                self,
                200,
                {"ok": True, "message": "Kontak berhasil diperbarui", "data": updated},
            )
        except Exception as exc:
            print(f"[KONTAK_ITEMS][PUT] Error: {exc}")
            send_json(self, 400, {"ok": False, "error": str(exc)})

    def do_DELETE(self):
        try:
            payload = read_json_body(self)
            item_id = payload.get("id")
            if not item_id:
                raise ValueError("Parameter id wajib disertakan")

            _admin().table(TABLE_NAME).delete().eq("id", item_id).execute()
            send_json(
                self,
                200,
                {"ok": True, "message": "Kontak berhasil dihapus"},
            )
        except Exception as exc:
            print(f"[KONTAK_ITEMS][DELETE] Error: {exc}")
            send_json(self, 400, {"ok": False, "error": str(exc)})

    def do_OPTIONS(self):
        allow_cors(self, ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
