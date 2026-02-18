from __future__ import annotations

import base64
import hashlib
import hmac
import os


def hash_password(password: str, *, iterations: int = 390_000) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return f"pbkdf2_sha256${iterations}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(dk).decode()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        scheme, iter_s, salt_b64, hash_b64 = password_hash.split('$', 3)
        if scheme != 'pbkdf2_sha256':
            return False
        iterations = int(iter_s)
        salt = base64.urlsafe_b64decode(salt_b64.encode('utf-8'))
        expected = base64.urlsafe_b64decode(hash_b64.encode('utf-8'))
    except Exception:
        return False

    actual = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return hmac.compare_digest(expected, actual)

