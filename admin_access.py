"""Authorization for writes that change the shared training registry or news feeds."""
import os
import secrets
from ipaddress import ip_address
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False, scheme_name="CyclonexAdmin")


def _loopback(host: str | None) -> bool:
    if host == "localhost":
        return True
    try:
        return bool(host and ip_address(host).is_loopback)
    except ValueError:
        return False


def _direct_local_request(request: Request) -> bool:
    if os.getenv("RENDER") or os.getenv("VERCEL") or os.getenv("RENDER_SERVICE_ID"):
        return False
    if not request.client or not _loopback(request.client.host) or not _loopback(request.url.hostname):
        return False
    if any(name in request.headers for name in ("forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto")):
        return False
    origin = request.headers.get("origin")
    if origin is None:
        return True
    try:
        parsed = urlsplit(origin)
        return parsed.scheme in ("http", "https") and _loopback(parsed.hostname)
    except ValueError:
        return False


def require_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    configured = os.getenv("CYCLONEX_ADMIN_TOKEN", "").strip()
    if not configured:
        if _direct_local_request(request):
            return
        raise HTTPException(status_code=403, detail="Shared administration is unavailable until the backend administrator configures an admin token.")
    if credentials and secrets.compare_digest(configured.encode("utf-8"), credentials.credentials.encode("utf-8")):
        return
    raise HTTPException(status_code=401, detail="A valid administrator bearer token is required.", headers={"WWW-Authenticate": "Bearer"})
