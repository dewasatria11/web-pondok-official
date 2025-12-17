import os
from typing import Dict, Tuple
from supabase import create_client, Client

_CLIENT_CACHE: Dict[Tuple[str, str], Client] = {}

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

    cache_key = (url, key)
    cached = _CLIENT_CACHE.get(cache_key)
    if cached is not None:
        return cached

    client = create_client(url, key)
    _CLIENT_CACHE[cache_key] = client
    return client
