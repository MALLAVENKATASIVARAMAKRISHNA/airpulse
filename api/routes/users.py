from fastapi import APIRouter, Depends, HTTPException, Body
from database import query
from auth import admin_only

router = APIRouter()

@router.get('/')
def get_users(current_user=Depends(admin_only)):
    return query("""
        SELECT u.user_id, u.full_name, u.email, u.node_id, u.location, u.role, u.phone_number,
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
