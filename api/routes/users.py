from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, EmailStr
from database import query
from auth import admin_only, hash_password, get_current_user
from typing import Optional

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
def get_user_count(current_user=Depends(get_current_user)):
    role = current_user.get('role')
    if role == 'authority':
        district = current_user.get('district')
        node_id = current_user.get('node_id')
        
        dist_count = 0
        if district:
            res_dist = query(
                """
                SELECT COUNT(*) as count 
                FROM users u
                JOIN nodes n ON n.node_id = u.node_id
                WHERE u.role = 'user' AND LOWER(n.district) = LOWER(%s)
                """,
                (district,), fetch='one'
            )
            dist_count = res_dist['count'] if res_dist else 0
            
        node_count = 0
        if not node_id and district:
            # Dynamically resolve first node in authority's district
            res_node_id = query(
                "SELECT node_id FROM nodes WHERE LOWER(district) = LOWER(%s) ORDER BY node_id LIMIT 1",
                (district,), fetch='one'
            )
            if res_node_id:
                node_id = res_node_id['node_id']
                
        if node_id:
            res_node = query(
                "SELECT COUNT(*) as count FROM users WHERE role = 'user' AND node_id = %s",
                (node_id,), fetch='one'
            )
            node_count = res_node['count'] if res_node else 0
            
        return {
            'count': dist_count,
            'district_count': dist_count,
            'node_count': node_count,
            'is_authority': True
        }
        
    result = query("SELECT COUNT(*) as count FROM users WHERE role = 'user'", fetch='one')
    return {'count': result['count'], 'is_authority': False}

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

class AdminUpdateUserRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str
    node_id: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None

@router.put('/{user_id}')
def admin_update_user(user_id: int, data: AdminUpdateUserRequest, current_user=Depends(admin_only)):
    user = query('SELECT role FROM users WHERE user_id = %s', (user_id,), fetch='one')
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    if user['role'] == 'admin':
        raise HTTPException(status_code=403, detail='Cannot modify admin accounts')
    
    location = None
    if data.node_id:
        node = query('SELECT location FROM nodes WHERE node_id = %s', (data.node_id,), fetch='one')
        if node:
            location = node['location']
            
    query("""
        UPDATE users
        SET full_name = %s, email = %s, phone_number = %s, node_id = %s, location = %s, state = %s, district = %s
        WHERE user_id = %s
    """, (data.full_name, data.email, data.phone_number, data.node_id, location, data.state, data.district, user_id), fetch='none')
    return {'ok': True, 'message': 'User profile updated successfully.'}
