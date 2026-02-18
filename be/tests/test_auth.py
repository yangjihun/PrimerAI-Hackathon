def test_signup_login_and_me(client):
    signup_response = client.post(
        '/api/auth/signup',
        json={
            'name': 'Tester',
            'email': 'tester@example.com',
            'password': 'secure-pass-123',
        },
    )
    assert signup_response.status_code == 200
    signup_payload = signup_response.json()
    assert signup_payload['user']['email'] == 'tester@example.com'
    assert signup_payload['access_token']

    login_response = client.post(
        '/api/auth/login',
        json={
            'email': 'tester@example.com',
            'password': 'secure-pass-123',
        },
    )
    assert login_response.status_code == 200
    login_payload = login_response.json()
    assert login_payload['access_token']

    me_response = client.get(
        '/api/auth/me',
        headers={'Authorization': f"Bearer {login_payload['access_token']}"},
    )
    assert me_response.status_code == 200
    me_payload = me_response.json()
    assert me_payload['email'] == 'tester@example.com'


def test_login_invalid_password(client):
    client.post(
        '/api/auth/signup',
        json={
            'name': 'Tester',
            'email': 'tester2@example.com',
            'password': 'secure-pass-123',
        },
    )

    login_response = client.post(
        '/api/auth/login',
        json={
            'email': 'tester2@example.com',
            'password': 'wrong-password',
        },
    )

    assert login_response.status_code == 401
    payload = login_response.json()
    assert payload['code'] == 'UNAUTHORIZED'

