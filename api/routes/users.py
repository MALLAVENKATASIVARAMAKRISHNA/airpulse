from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, EmailStr
from database import query
from auth import admin_only, hash_password

router = APIRouter()

@router.get('/')
def get_users(current_user=Depends(admin_only)):
    return query("""
        SELECT u.user_id, u.full_name, u.email, u.node_id, u.location, u.role, u.phone_number, u.state, u.district, u.must_change_password,
               hc.condition_name, uh.severity_level, uh.age, uh.gender
        FROM users u
        LEFT JOIN user_health uh ON uh.user_id = u.user_id
        LEFT JOIN health_conditions hc ON hc.condition_id = uh.condition_id
        WHERE u.role != 'admin'
        ORDER BY u.user_id
    """)

@router.get('/count')
def get_user_count(current_user=Depends(admin_only)):
    result = query("SELECT COUNT(*) as count FROM users WHERE role = 'user'", fetch='one')
    return {'count': result['count']}

@router.patch('/{user_id}/role')
def update_user_role(user_id: int, role: str = Body(..., embed=True), current_user=Depends(admin_only)):
    if role not in ('user', 'authority'):
        raise HTTPException(status_code=400, detail='Role must be user or authority')
    query("UPDATE users SET role = %s WHERE user_id = %s AND role != 'admin'", (role, user_id), fetch='none')
    return {'ok': True}

class CreateAuthorityRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str
    state: str
    district: str

@router.post('/authority')
def create_authority(data: CreateAuthorityRequest, current_user=Depends(admin_only)):
    existing = query('SELECT user_id FROM users WHERE email = %s', (data.email,), fetch='one')
    if existing:
        raise HTTPException(status_code=400, detail='Email is already registered')
    hashed_pw = hash_password('authority@123')
    query("""
        INSERT INTO users (full_name, email, phone_number, password_hash, role, state, district, must_change_password)
        VALUES (%s, %s, %s, %s, 'authority', %s, %s, TRUE)
    """, (data.full_name, data.email, data.phone_number, hashed_pw, data.state, data.district), fetch='none')
    return {'ok': True, 'message': 'Authority created successfully.'}
