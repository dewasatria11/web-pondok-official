import json
from datetime import datetime, timezone


def read_json_body(request_handler):
    """Parse JSON body safely, returning dict even when empty."""
    try:
        length = int(request_handler.headers.get("Content-Length", 0))
    except (TypeError, ValueError):
        length = 0

    if length <= 0:
        return {}

    raw = request_handler.rfile.read(length)
    if not raw:
        return {}

    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Body bukan JSON valid: {exc}") from exc


def send_json(request_handler, status_code, payload):
    """Send JSON response with CORS headers."""
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request_handler.send_response(status_code)
    request_handler.send_header("Content-Type", "application/json; charset=utf-8")
    request_handler.send_header("Access-Control-Allow-Origin", "*")
    request_handler.end_headers()
    request_handler.wfile.write(body)


def now_timestamp():
    """Return timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


def allow_cors(request_handler, methods):
    """Send preflight CORS response."""
    request_handler.send_response(200)
    request_handler.send_header("Access-Control-Allow-Origin", "*")
    request_handler.send_header("Access-Control-Allow-Methods", ", ".join(methods))
    request_handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    request_handler.end_headers()
