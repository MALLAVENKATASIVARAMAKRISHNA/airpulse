from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from database import query
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()

class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    node_id: str
    phone_number: str = ''

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SetupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

def build_token(user):
    return create_token({
        'user_id':   user['user_id'],
        'role':      user['role'],
        'node_id':   user['node_id'],
        'full_name': user['full_name'],
        'email':     user['email'],
    })

@router.post('/signup')
def signup(data: SignupRequest):
    existing = query('SELECT user_id FROM users WHERE email = %s', (data.email,), fetch='one')
    if existing:
        raise HTTPException(400, 'An account with this email already exists. Sign in instead.')

    node = query('SELECT location FROM nodes WHERE node_id = %s', (data.node_id,), fetch='one')
    if not node:
        raise HTTPException(400, 'Invalid monitoring location.')

    hashed = hash_password(data.password)
    user = query("""
        INSERT INTO users (full_name, email, password_hash, node_id, phone_number, location, role)
        VALUES (%s, %s, %s, %s, %s, %s, 'user')
        RETURNING user_id, full_name, email, node_id, location, role
    """, (data.full_name, data.email, hashed, data.node_id, data.phone_number, node['location']), fetch='one')

    return {'token': build_token(user), 'user': dict(user)}

@router.post('/login')
def login(data: LoginRequest):
    user = query('SELECT * FROM users WHERE email = %s', (data.email,), fetch='one')
    if not user or not user['password_hash']:
        raise HTTPException(401, 'Incorrect email or password.')
    if not verify_password(data.password, user['password_hash']):
        raise HTTPException(401, 'Incorrect email or password.')
    return {'token': build_token(user), 'user': {
        'user_id': user['user_id'], 'role': user['role'],
        'node_id': user['node_id'], 'full_name': user['full_name'], 'email': user['email'],
    }}

@router.get('/me')
def me(current_user=Depends(get_current_user)):
    user = query('SELECT user_id, full_name, email, node_id, role, location FROM users WHERE user_id = %s',
                 (current_user['user_id'],), fetch='one')
    if not user:
        raise HTTPException(404, 'User not found.')
    return dict(user)

@router.post('/setup')
def setup_admin(data: SetupRequest):
    existing_admin = query("SELECT user_id FROM users WHERE role = 'admin'", fetch='one')
    if existing_admin:
        raise HTTPException(400, 'Admin already exists.')
    hashed = hash_password(data.password)
    user = query("""
        INSERT INTO users (full_name, email, password_hash, role, location)
        VALUES (%s, %s, %s, 'admin', 'AirPulse HQ')
        RETURNING user_id, full_name, email, node_id, location, role
    """, (data.full_name, data.email, hashed), fetch='one')
    return {'token': build_token(user), 'user': dict(user)}

@router.get('/conditions')
def get_conditions():
    return query('SELECT condition_id, condition_name FROM health_conditions ORDER BY condition_id')

@router.post('/health')
def save_health(data: dict, current_user=Depends(get_current_user)):
    query("""
        INSERT INTO user_health (user_id, condition_id, severity_level, age, gender)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE
        SET condition_id = EXCLUDED.condition_id,
            severity_level = EXCLUDED.severity_level,
            age = EXCLUDED.age,
            gender = EXCLUDED.gender
    """, (current_user['user_id'], data['condition_id'], data['severity_level'], data['age'], data['gender']), fetch='none')
    return {'ok': True}

@router.post('/push-token')
def save_push_token(data: dict, current_user=Depends(get_current_user)):
    query('UPDATE users SET push_token = %s WHERE user_id = %s',
          (data.get('token'), current_user['user_id']), fetch='none')
    return {'ok': True}

@router.get('/health')
def get_health(current_user=Depends(get_current_user)):
    row = query("""
        SELECT uh.*, hc.condition_name
        FROM user_health uh
        JOIN health_conditions hc ON hc.condition_id = uh.condition_id
        WHERE uh.user_id = %s
    """, (current_user['user_id'],), fetch='one')
    return dict(row) if row else None
