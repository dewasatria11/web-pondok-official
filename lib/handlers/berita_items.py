"""
API Handler untuk CRUD berita (bilingual news/articles)
Supports: GET (list), POST (create), PUT (update), DELETE
"""
from http.server import BaseHTTPRequestHandler

from lib._supabase import supabase_client
from ._crud_helpers import (
    read_json_body,
    send_json,
    now_timestamp,
    allow_cors,
)


TABLE_NAME = "berita"
ORDER_FIELD = "order_index"


def _get_public_client():
    """Client untuk public read (published berita only)"""
    return supabase_client(service_role=False)


def _get_admin_client():
    """Client dengan service role untuk admin operations"""
    return supabase_client(service_role=True)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/berita_items
        Query params:
          - published_only=true: Return only published berita (for public)
          - published_only=false: Return all berita (for admin)
        """
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            published_only = params.get('published_only', ['false'])[0].lower() == 'true'
            
            if published_only:
                # Public access: only published berita
                supa = _get_public_client()
                result = (
                    supa.table(TABLE_NAME)
                    .select("*")
                    .eq("is_published", True)
                    .order(ORDER_FIELD, desc=False)  # Sort by order_index first
                    .execute()
                )
                # Client-side sort by published_date (newest first)
                if result.data:
                    result.data.sort(key=lambda x: (
                        x.get("published_date") or x.get("created_at") or "1970-01-01"
                    ), reverse=True)
            else:
                # Admin access: all berita
                supa = _get_admin_client()
                result = (
                    supa.table(TABLE_NAME)
                    .select("*")
                    .order(ORDER_FIELD, desc=False)  # Sort by order_index
                    .execute()
                )
                # Client-side sort by published_date (newest first) for admin view
                if result.data:
                    result.data.sort(key=lambda x: (
                        x.get("published_date") or x.get("created_at") or "1970-01-01",
                        x.get(ORDER_FIELD) or 0
                    ), reverse=True)

            data = result.data or []
            send_json(self, 200, {"ok": True, "data": data})
            
        except Exception as exc:
            print(f"[BERITA_ITEMS][GET] Error: {exc}")
            import traceback
            traceback.print_exc()
            send_json(
                self,
                500,
                {"ok": False, "error": f"Gagal mengambil data berita: {exc}"},
            )

    def do_POST(self):
        """
        POST /api/berita_items
        Body: {
          "title_id": "Judul Indonesia",
          "title_en": "English Title",
          "content_id": "Konten Indonesia",
          "content_en": "English Content",
          "image_url": "https://...", (optional)
          "is_published": true/false,
          "order_index": 1 (optional, auto-generated if not provided)
        }
        """
        try:
            payload = read_json_body(self)
            
            # Validate required fields
            title_id = (payload.get("title_id") or "").strip()
            title_en = (payload.get("title_en") or "").strip()
            content_id = (payload.get("content_id") or "").strip()
            content_en = (payload.get("content_en") or "").strip()
            
            if not title_id or not content_id:
                raise ValueError("Judul dan konten (Bahasa Indonesia) wajib diisi")
            if not title_en or not content_en:
                raise ValueError("Title and content (English) are required")

            admin_client = _get_admin_client()
            
            # Handle order_index
            order_index = payload.get("order_index")
            if order_index is None:
                # Get highest order_index and add 1
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

            # Build insert payload
            image_url = payload.get("image_url")
            if image_url and isinstance(image_url, str):
                image_url = image_url.strip() or None
            else:
                image_url = None
                
            # Handle published_date
            published_date = payload.get("published_date")
            if published_date and isinstance(published_date, str):
                published_date = published_date.strip() or None
            else:
                published_date = None
            
            insert_payload = {
                "title_id": title_id,
                "title_en": title_en,
                "content_id": content_id,
                "content_en": content_en,
                "image_url": image_url,
                "is_published": payload.get("is_published", False),
                "published_date": published_date,
                ORDER_FIELD: order_index,
            }

            result = admin_client.table(TABLE_NAME).insert(insert_payload).execute()
            created = result.data[0] if result.data else insert_payload

            send_json(
                self,
                200,
                {"ok": True, "message": "Berita berhasil dibuat", "data": created},
            )
            
        except ValueError as exc:
            print(f"[BERITA_ITEMS][POST] Validation error: {exc}")
            send_json(self, 400, {"ok": False, "error": str(exc)})
            
        except Exception as exc:
            print(f"[BERITA_ITEMS][POST] Error: {exc}")
            import traceback
            traceback.print_exc()
            send_json(self, 500, {"ok": False, "error": str(exc)})

    def do_PUT(self):
        """
        PUT /api/berita_items
        
        Bulk reorder:
          Body: { "items": [{"id": 1, "order_index": 1}, ...] }
        
        Single update:
          Body: {
            "id": 1,
            "title_id": "...",
            "title_en": "...",
            "content_id": "...",
            "content_en": "...",
            "image_url": "...",
            "is_published": true/false,
            "order_index": 2
          }
        """
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
                        "message": "Urutan berita berhasil diperbarui",
                        "data": updated,
                    },
                )
                return

            # Single item update
            item_id = payload.get("id")
            if not item_id:
                raise ValueError("Parameter id wajib disertakan")

            update_fields = {}
            if "title_id" in payload:
                title = payload["title_id"].strip()
                if not title:
                    raise ValueError("Judul (Bahasa Indonesia) tidak boleh kosong")
                update_fields["title_id"] = title
                
            if "title_en" in payload:
                title = payload["title_en"].strip()
                if not title:
                    raise ValueError("Title (English) cannot be empty")
                update_fields["title_en"] = title
                
            if "content_id" in payload:
                content = payload["content_id"].strip()
                if not content:
                    raise ValueError("Konten (Bahasa Indonesia) tidak boleh kosong")
                update_fields["content_id"] = content
                
            if "content_en" in payload:
                content = payload["content_en"].strip()
                if not content:
                    raise ValueError("Content (English) cannot be empty")
                update_fields["content_en"] = content
                
            if "image_url" in payload:
                img_val = payload["image_url"]
                if img_val and isinstance(img_val, str):
                    update_fields["image_url"] = img_val.strip() or None
                else:
                    update_fields["image_url"] = None
                
            if "is_published" in payload:
                update_fields["is_published"] = bool(payload["is_published"])
                
            if "published_date" in payload:
                pub_date = payload["published_date"]
                if pub_date and isinstance(pub_date, str):
                    update_fields["published_date"] = pub_date.strip() or None
                else:
                    update_fields["published_date"] = None
                
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
            if not updated:
                raise ValueError(f"Berita dengan id {item_id} tidak ditemukan")
                
            send_json(
                self,
                200,
                {"ok": True, "message": "Berita berhasil diperbarui", "data": updated},
            )
            
        except ValueError as exc:
            print(f"[BERITA_ITEMS][PUT] Validation error: {exc}")
            send_json(self, 400, {"ok": False, "error": str(exc)})
            
        except Exception as exc:
            print(f"[BERITA_ITEMS][PUT] Error: {exc}")
            import traceback
            traceback.print_exc()
            send_json(self, 500, {"ok": False, "error": str(exc)})

    def do_DELETE(self):
        """
        DELETE /api/berita_items
        Body: { "id": 1 }
        """
        try:
            payload = read_json_body(self)
            item_id = payload.get("id")
            if not item_id:
                raise ValueError("Parameter id wajib disertakan")

            admin_client = _get_admin_client()
            result = admin_client.table(TABLE_NAME).delete().eq("id", item_id).execute()
            
            if not result.data:
                raise ValueError(f"Berita dengan id {item_id} tidak ditemukan")

            send_json(
                self,
                200,
                {"ok": True, "message": "Berita berhasil dihapus"},
            )
            
        except ValueError as exc:
            print(f"[BERITA_ITEMS][DELETE] Validation error: {exc}")
            send_json(self, 400, {"ok": False, "error": str(exc)})
            
        except Exception as exc:
            print(f"[BERITA_ITEMS][DELETE] Error: {exc}")
            import traceback
            traceback.print_exc()
            send_json(self, 500, {"ok": False, "error": str(exc)})

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        allow_cors(self, ["GET", "POST", "PUT", "DELETE", "OPTIONS"])

