import os, hmac, hashlib, datetime, urllib.parse
from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter()

def _sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

def _signing_key(secret, date, region, service):
    k = _sign(('AWS4' + secret).encode('utf-8'), date)
    k = _sign(k, region)
    k = _sign(k, service)
    return _sign(k, 'aws4_request')

def build_wss_url():
    region     = os.environ.get('AWS_REGION', 'ap-south-1')
    endpoint   = os.environ.get('AWS_IOT_ENDPOINT', 'a154ie33qhakmk-ats.iot.ap-south-1.amazonaws.com')
    access_key = os.environ.get('AWS_ACCESS_KEY_ID', '')
    secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY', '')

    now        = datetime.datetime.utcnow()
    amz_date   = now.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = now.strftime('%Y%m%d')
    service    = 'iotdevicegateway'
    algorithm  = 'AWS4-HMAC-SHA256'
    scope      = f'{date_stamp}/{region}/{service}/aws4_request'

    qs  = f'X-Amz-Algorithm={algorithm}'
    qs += f'&X-Amz-Credential={urllib.parse.quote_plus(f"{access_key}/{scope}")}'
    qs += f'&X-Amz-Date={amz_date}'
    qs += f'&X-Amz-Expires=86400'
    qs += f'&X-Amz-SignedHeaders=host'

    canonical = '\n'.join(['GET', '/mqtt', qs, f'host:{endpoint}\n', 'host', hashlib.sha256(b'').hexdigest()])
    sts       = '\n'.join([algorithm, amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    sig       = hmac.new(_signing_key(secret_key, date_stamp, region, service), sts.encode(), hashlib.sha256).hexdigest()

    return f'wss://{endpoint}/mqtt?{qs}&X-Amz-Signature={sig}'

@router.get('/url')
def get_iot_url(current_user=Depends(get_current_user)):
    return {'url': build_wss_url(), 'endpoint': os.environ.get('AWS_IOT_ENDPOINT', '')}
