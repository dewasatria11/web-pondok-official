"""
Admin Users Management Handler
Uses Supabase Admin API with service_role key for full user CRUD
"""

import os
import json
import urllib.request
import urllib.error

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://sxbvadzcwpaovkhghttv.supabase.co')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

def send_cors_headers(handler):
    """Send CORS headers"""
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

def send_json_response(handler, status_code, data):
    """Send JSON response"""
    handler.send_response(status_code)
    handler.send_header('Content-Type', 'application/json')
    send_cors_headers(handler)
    handler.end_headers()
    handler.wfile.write(json.dumps(data).encode('utf-8'))

def make_admin_request(method, endpoint, data=None):
    """Make request to Supabase Admin API"""
    if not SUPABASE_SERVICE_KEY:
        return {'error': 'Service role key not configured'}, 500
    
    url = f"{SUPABASE_URL}/auth/v1/admin/{endpoint}"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json'
    }
    
    try:
        req_data = json.dumps(data).encode('utf-8') if data else None
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result, response.status
            
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        try:
            error_data = json.loads(error_body)
            return {'error': error_data.get('msg', error_data.get('message', str(e)))}, e.code
        except:
            return {'error': str(e)}, e.code
    except Exception as e:
        return {'error': str(e)}, 500


class handler:
    @staticmethod
    def do_OPTIONS(h):
        """Handle CORS preflight"""
        h.send_response(200)
        send_cors_headers(h)
        h.send_header('Access-Control-Max-Age', '86400')
        h.end_headers()
    
    @staticmethod
    def do_GET(h):
        """List all admin users"""
        try:
            print('[ADMIN USERS] Listing all users...')
            
            result, status_code = make_admin_request('GET', 'users')
            
            if status_code != 200:
                send_json_response(h, status_code, {'ok': False, 'error': result.get('error', 'Failed to list users')})
                return
            
            # Filter and format users
            users = result.get('users', [])
            formatted_users = []
            
            for user in users:
                formatted_users.append({
                    'id': user.get('id'),
                    'email': user.get('email'),
                    'created_at': user.get('created_at'),
                    'last_sign_in_at': user.get('last_sign_in_at'),
                    'email_confirmed_at': user.get('email_confirmed_at'),
                })
            
            print(f'[ADMIN USERS] Found {len(formatted_users)} users')
            send_json_response(h, 200, {
                'ok': True,
                'users': formatted_users,
                'total': len(formatted_users)
            })
            
        except Exception as e:
            print(f'[ADMIN USERS] Error listing users: {e}')
            send_json_response(h, 500, {'ok': False, 'error': str(e)})
    
    @staticmethod
    def do_POST(h):
        """Create new admin user"""
        try:
            content_length = int(h.headers.get('Content-Length', 0))
            body = h.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
            
            email = data.get('email', '').strip()
            password = data.get('password', '')
            
            if not email or not password:
                send_json_response(h, 400, {'ok': False, 'error': 'Email dan password wajib diisi'})
                return
            
            if len(password) < 6:
                send_json_response(h, 400, {'ok': False, 'error': 'Password minimal 6 karakter'})
                return
            
            print(f'[ADMIN USERS] Creating user: {email}')
            
            # Create user with admin API
            result, status_code = make_admin_request('POST', 'users', {
                'email': email,
                'password': password,
                'email_confirm': True  # Auto-confirm email
            })
            
            if status_code not in [200, 201]:
                error_msg = result.get('error', 'Failed to create user')
                if 'already been registered' in str(error_msg).lower():
                    error_msg = 'Email sudah terdaftar'
                send_json_response(h, status_code, {'ok': False, 'error': error_msg})
                return
            
            print(f'[ADMIN USERS] ✅ User created: {email}')
            send_json_response(h, 201, {
                'ok': True,
                'message': 'Akun admin berhasil dibuat',
                'user': {
                    'id': result.get('id'),
                    'email': result.get('email'),
                    'created_at': result.get('created_at')
                }
            })
            
        except json.JSONDecodeError:
            send_json_response(h, 400, {'ok': False, 'error': 'Invalid JSON'})
        except Exception as e:
            print(f'[ADMIN USERS] Error creating user: {e}')
            send_json_response(h, 500, {'ok': False, 'error': str(e)})
    
    @staticmethod
    def do_DELETE(h):
        """Delete admin user"""
        try:
            # Get user ID from query params
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(h.path)
            params = parse_qs(parsed.query)
            user_id = params.get('user_id', [''])[0]
            
            if not user_id:
                send_json_response(h, 400, {'ok': False, 'error': 'user_id wajib diisi'})
                return
            
            print(f'[ADMIN USERS] Deleting user: {user_id}')
            
            result, status_code = make_admin_request('DELETE', f'users/{user_id}')
            
            if status_code not in [200, 204]:
                send_json_response(h, status_code, {'ok': False, 'error': result.get('error', 'Failed to delete user')})
                return
            
            print(f'[ADMIN USERS] ✅ User deleted: {user_id}')
            send_json_response(h, 200, {
                'ok': True,
                'message': 'Akun admin berhasil dihapus'
            })
            
        except Exception as e:
            print(f'[ADMIN USERS] Error deleting user: {e}')
            send_json_response(h, 500, {'ok': False, 'error': str(e)})
