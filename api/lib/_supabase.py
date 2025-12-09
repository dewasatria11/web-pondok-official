# /api/_supabase.py
import os
from supabase import create_client, Client

def supabase_client(service_role: bool = False) -> Client:
    """
    Buat Supabase client.
    - service_role=True  → pakai SERVICE_ROLE_KEY (khusus server, akses penuh)
    - service_role=False → pakai ANON_KEY (akses publik)
    """
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if service_role
        else os.getenv("SUPABASE_ANON_KEY")
    )

    if not url or not key:
        raise ValueError("ENV SUPABASE_URL / SUPABASE_*_KEY belum di-set.")

    return create_client(url, key)
