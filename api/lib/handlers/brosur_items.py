"""
API Handler untuk CRUD brosur_items
"""
from http.server import BaseHTTPRequestHandler

from .._supabase import supabase_client
from ._crud_helpers import (
    read_json_body,
    send_json,
    now_timestamp,
    allow_cors,
)


TABLE_NAME = "brosur_items"
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
            print(f"[BROSUR_ITEMS][GET] Error: {exc}")
            send_json(
                self, 500, {"ok": False, "error": f"Gagal mengambil data: {exc}"}
            )

    def do_POST(self):
        try:
            payload = read_json_body(self)
            title = (payload.get("title") or "").strip()
            description = (payload.get("description") or "").strip()
            button_label = (payload.get("button_label") or "Unduh PDF").strip()
            title_en = (payload.get("title_en") or "").strip()
            description_en = (payload.get("description_en") or "").strip()
            button_label_en = (payload.get("button_label_en") or "Download PDF").strip()
            button_url = (payload.get("button_url") or "").strip()
            file_path = (payload.get("file_path") or "").strip()
            file_mime = (payload.get("file_mime") or "").strip()
            file_size = payload.get("file_size")
            icon_class = (payload.get("icon_class") or "bi bi-file-earmark-arrow-down").strip()
            order_index = payload.get(ORDER_FIELD)

            if (
                not title
                or not description
                or not button_url
                or not title_en
                or not description_en
                or not button_label_en
            ):
                raise ValueError("Isi judul, deskripsi, label tombol, dan URL di kedua bahasa")

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
                "description": description,
                "button_label": button_label or "Unduh PDF",
                "title_en": title_en,
                "description_en": description_en,
                "button_label_en": button_label_en or "Download PDF",
                "button_url": button_url,
                "file_path": file_path or None,
                "file_mime": file_mime or None,
                "file_size": file_size if file_size is not None else None,
                "icon_class": icon_class or "bi bi-file-earmark-arrow-down",
                ORDER_FIELD: order_index,
            }
            result = admin.table(TABLE_NAME).insert(insert_payload).execute()
            created = result.data[0] if result.data else insert_payload

            send_json(
                self,
                200,
                {"ok": True, "message": "Brosur berhasil ditambahkan", "data": created},
            )
        except Exception as exc:
            print(f"[BROSUR_ITEMS][POST] Error: {exc}")
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
                        "message": "Urutan brosur diperbarui",
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
            if "button_label" in payload and payload["button_label"] is not None:
                update_fields["button_label"] = payload["button_label"].strip() or "Unduh PDF"
            if "title_en" in payload and payload["title_en"]:
                update_fields["title_en"] = payload["title_en"].strip()
            if "description_en" in payload and payload["description_en"]:
                update_fields["description_en"] = payload["description_en"].strip()
            if "button_label_en" in payload and payload["button_label_en"] is not None:
                update_fields["button_label_en"] = payload["button_label_en"].strip() or "Download PDF"
            if "button_url" in payload and payload["button_url"]:
                update_fields["button_url"] = payload["button_url"].strip()
            if "file_path" in payload:
                update_fields["file_path"] = (payload.get("file_path") or "").strip() or None
            if "file_mime" in payload:
                update_fields["file_mime"] = (payload.get("file_mime") or "").strip() or None
            if "file_size" in payload:
                file_size_val = payload.get("file_size")
                update_fields["file_size"] = int(file_size_val) if file_size_val is not None else None
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
                {"ok": True, "message": "Brosur berhasil diperbarui", "data": updated},
            )
        except Exception as exc:
            print(f"[BROSUR_ITEMS][PUT] Error: {exc}")
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
                {"ok": True, "message": "Brosur berhasil dihapus"},
            )
        except Exception as exc:
            print(f"[BROSUR_ITEMS][DELETE] Error: {exc}")
            send_json(self, 400, {"ok": False, "error": str(exc)})

    def do_OPTIONS(self):
        allow_cors(self, ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
