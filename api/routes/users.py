from fastapi import APIRouter, Depends
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
        WHERE u.role = 'user'
        ORDER BY u.user_id
    """)

@router.get('/count')
def get_user_count(current_user=Depends(admin_only)):
    result = query("SELECT COUNT(*) as count FROM users WHERE role = 'user'", fetch='one')
    return {'count': result['count']}
