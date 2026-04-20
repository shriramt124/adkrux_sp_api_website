import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from fastapi import Depends, HTTPException, Request


_COOKIE_NAME = "adkrux_admin"


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _sign(secret: str, payload_b64: str) -> str:
    sig = hmac.new(secret.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return _b64url_encode(sig)


def _now_ts() -> int:
    return int(time.time())


def issue_session_token(*, secret: str, ttl_s: int = 24 * 3600) -> str:
    # If ttl_s is <= 0, issue a token without expiry.
    payload = {"iat": _now_ts()}
    if int(ttl_s) > 0:
        payload["exp"] = _now_ts() + int(ttl_s)
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _sign(secret, payload_b64)
    return f"{payload_b64}.{sig}"


def verify_session_token(token: str, *, secret: str) -> bool:
    if not token or "." not in token:
        return False
    payload_b64, sig = token.split(".", 1)
    expected = _sign(secret, payload_b64)
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception:
        return False
    exp = payload.get("exp")
    if exp is None:
        return True
    return int(exp or 0) > _now_ts()


def get_admin_session_secret() -> str:
    secret = os.getenv("ADMIN_SESSION_SECRET", "").strip()
    if not secret:
        raise RuntimeError("Missing ADMIN_SESSION_SECRET env var")
    return secret


def get_admin_password() -> str:
    pw = os.getenv("ADMIN_PASSWORD", "").strip()
    if not pw:
        raise RuntimeError("Missing ADMIN_PASSWORD env var")
    return pw


def get_cookie_name() -> str:
    return os.getenv("ADMIN_COOKIE_NAME", _COOKIE_NAME)


def is_admin_request(req: Request) -> bool:
    cookie_name = get_cookie_name()
    token = req.cookies.get(cookie_name)
    if not token:
        return False
    return verify_session_token(token, secret=get_admin_session_secret())


def require_admin(req: Request) -> None:
    if not is_admin_request(req):
        raise HTTPException(status_code=401, detail="Not authenticated")


def require_admin_dep(req: Request) -> None:
    return require_admin(req)
