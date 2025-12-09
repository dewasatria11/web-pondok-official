"""
API Handler untuk CRUD biaya_items
"""
from http.server import BaseHTTPRequestHandler

from .._supabase import supabase_client
from ._crud_helpers import (
    read_json_body,
    send_json,
    now_timestamp,
    allow_cors,
)


TABLE_NAME = "biaya_items"
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
            print(f"[BIAYA_ITEMS][GET] Error: {exc}")
            send_json(
                self, 500, {"ok": False, "error": f"Gagal mengambil data: {exc}"}
            )

    def do_POST(self):
        try:
            payload = read_json_body(self)
            label = (payload.get("label") or "").strip()
            amount = (payload.get("amount") or "").strip()
            label_en = (payload.get("label_en") or "").strip()
            amount_en = (payload.get("amount_en") or "").strip()
            order_index = payload.get(ORDER_FIELD)

            if not label or not amount or not label_en or not amount_en:
                raise ValueError("Label dan nominal (ID & EN) wajib diisi")

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
                "label": label,
                "amount": amount,
                "label_en": label_en,
                "amount_en": amount_en,
                ORDER_FIELD: order_index,
            }
            result = admin.table(TABLE_NAME).insert(insert_payload).execute()
            created = result.data[0] if result.data else insert_payload

            send_json(
                self,
                200,
                {"ok": True, "message": "Biaya berhasil ditambahkan", "data": created},
            )
        except Exception as exc:
            print(f"[BIAYA_ITEMS][POST] Error: {exc}")
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
                        "message": "Urutan biaya diperbarui",
                        "data": updated,
                    },
                )
                return

            item_id = payload.get("id")
            if not item_id:
                raise ValueError("Parameter id wajib disertakan")

            update_fields = {}
            if "label" in payload and payload["label"]:
                update_fields["label"] = payload["label"].strip()
            if "amount" in payload and payload["amount"]:
                update_fields["amount"] = payload["amount"].strip()
            if "label_en" in payload and payload["label_en"]:
                update_fields["label_en"] = payload["label_en"].strip()
            if "amount_en" in payload and payload["amount_en"]:
                update_fields["amount_en"] = payload["amount_en"].strip()
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
                {"ok": True, "message": "Biaya berhasil diperbarui", "data": updated},
            )
        except Exception as exc:
            print(f"[BIAYA_ITEMS][PUT] Error: {exc}")
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
                {"ok": True, "message": "Biaya berhasil dihapus"},
            )
        except Exception as exc:
            print(f"[BIAYA_ITEMS][DELETE] Error: {exc}")
            send_json(self, 400, {"ok": False, "error": str(exc)})

    def do_OPTIONS(self):
        allow_cors(self, ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
