import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def _bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def _admin_email_allowed(email: str | None) -> bool:
    configured = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if not configured:
        return True
    return bool(email) and email.strip().lower() == configured


def _decode_supabase_admin(token: str) -> dict:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        # Supabase access tokens are HS256 JWTs signed with the project's JWT
        # secret. Disable PyJWT's built-in audience check so we can validate the
        # expected audience explicitly and keep the error message stable.
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("aud") not in (None, "authenticated"):
        raise HTTPException(status_code=401, detail="Invalid token")

    email = payload.get("email")
    if not _admin_email_allowed(email):
        raise HTTPException(status_code=403, detail="Admin access required")

    return {
        "id": payload.get("sub"),
        "email": email,
        "auth_provider": "supabase",
    }


async def _decode_legacy_admin(token: str) -> dict:
    from server import db

    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(request: Request) -> dict:
    # The React admin now signs in with Supabase Auth and sends the Supabase
    # access token as a Bearer token. Keep the old cookie/JWT path as a fallback
    # for compatibility, but prefer the browser's Supabase token when present.
    token = _bearer_token(request)
    if token:
        return _decode_supabase_admin(token)

    token = request.cookies.get("access_token")
    if token:
        return await _decode_legacy_admin(token)

    raise HTTPException(status_code=401, detail="Not authenticated")
