import os
import bcrypt
from jose import jwt, JWTError
from fastapi import HTTPException, Header
from dotenv import load_dotenv

load_dotenv()

SECRET = os.getenv('JWT_SECRET', 'changeme')
ALGO   = 'HS256'

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(payload: dict) -> str:
    return jwt.encode(payload, SECRET, algorithm=ALGO)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGO])
    except JWTError:
        raise HTTPException(status_code=401, detail='Invalid or expired token')

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Not authenticated')
    token = authorization.split(' ')[1]
    return decode_token(token)

def admin_only(authorization: str = Header(None)):
    user = get_current_user(authorization)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    return user
