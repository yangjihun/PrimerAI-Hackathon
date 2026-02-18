from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from app.core.config import get_settings


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def _b64url_decode(data: str) -> bytes:
    pad = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + pad).encode('utf-8'))


def _sign(message: bytes, secret: str) -> str:
    sig = hmac.new(secret.encode('utf-8'), message, hashlib.sha256).digest()
    return _b64url_encode(sig)


def create_access_token(*, user_id: str, email: str, name: str) -> str:
    settings = get_settings()
    now = int(time.time())
    payload = {
        'sub': user_id,
        'email': email,
        'name': name,
        'iat': now,
        'exp': now + settings.auth_jwt_exp_minutes * 60,
    }
    header = {'alg': 'HS256', 'typ': 'JWT'}
    header_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f'{header_b64}.{payload_b64}'.encode('utf-8')
    signature = _sign(signing_input, settings.auth_jwt_secret)
    return f'{header_b64}.{payload_b64}.{signature}'


def decode_access_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        header_b64, payload_b64, signature = token.split('.')
        signing_input = f'{header_b64}.{payload_b64}'.encode('utf-8')
        expected = _sign(signing_input, settings.auth_jwt_secret)
        if not hmac.compare_digest(expected, signature):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get('exp', 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None

