from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_health_check():
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_user_signup_and_login():
    payload = {'email': 'demo@example.com', 'password': 'Secret123!', 'name': 'Demo User', 'phone': '+1 (555) 123-4567', 'role': 'user'}
    signup = client.post('/api/auth/signup', json=payload)
    assert signup.status_code == 200
    assert signup.json()['user']['email'] == payload['email']

    login = client.post('/api/auth/login', json={'email': payload['email'], 'password': payload['password']})
    assert login.status_code == 200
    assert login.json()['user']['email'] == payload['email']
    assert 'token' in login.json()


def test_claims_require_authentication():
    response = client.get('/api/claims')
    assert response.status_code == 401


def test_role_based_claim_access():
    admin = client.post('/api/auth/signup', json={'email': 'admin@example.com', 'password': 'Admin123!', 'name': 'Admin User', 'phone': '+1 (555) 456-7890', 'role': 'admin'})
    admin_token = admin.json()['token']
    user = client.post('/api/auth/signup', json={'email': 'staff@example.com', 'password': 'Staff123!', 'name': 'Staff User', 'phone': '+1 (555) 111-2222', 'role': 'user'})
    user_token = user.json()['token']

    admin_claims = client.get('/api/claims', headers={'Authorization': f'Bearer {admin_token}'})
    assert admin_claims.status_code == 200

    user_claims = client.get('/api/claims', headers={'Authorization': f'Bearer {user_token}'})
    assert user_claims.status_code == 200
    assert isinstance(user_claims.json(), list)


def test_claim_update_and_filtering():
    signup = client.post('/api/auth/signup', json={'email': 'filter-edit@example.com', 'password': 'Filter123!', 'name': 'Filter User', 'phone': '+1 (555) 777-8899', 'role': 'user'})
    token = signup.json()['token']

    created = client.post('/api/claims', json={
        'patient': 'Jane Smith',
        'provider': 'Care Center',
        'payer': 'Blue Cross',
        'dos': '2026-09-18',
        'charged': 1000,
        'paid': 100,
        'balance': 900,
        'status': 'Pending',
    }, headers={'Authorization': f'Bearer {token}'})
    assert created.status_code == 200

    claim_id = created.json()['id']
    updated = client.put(f'/api/claims/{claim_id}', json={
        'patient': 'Jane Smith',
        'provider': 'Care Center',
        'payer': 'Aetna',
        'dos': '2026-09-18',
        'charged': 1200,
        'paid': 200,
        'balance': 1000,
        'status': 'Review',
    }, headers={'Authorization': f'Bearer {token}'})
    assert updated.status_code == 200
    assert updated.json()['payer'] == 'Aetna'
    assert updated.json()['status'] == 'Review'

    filtered = client.get('/api/claims?status=Review&search=Jane&payer=Aetna&from=2026-09-01&to=2026-09-30', headers={'Authorization': f'Bearer {token}'})
    assert filtered.status_code == 200
    assert any(item['id'] == claim_id for item in filtered.json())


def test_create_reservation():
    response = client.post('/api/reservations', json={
        'guestName': 'Alice Johnson',
        'roomType': 'Deluxe Suite',
        'checkIn': '2026-10-15',
        'checkOut': '2026-10-18',
        'guests': 2,
        'status': 'Pending'
    })
    assert response.status_code == 200
    assert response.json()['guestName'] == 'Alice Johnson'
