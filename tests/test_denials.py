from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_denials_endpoints_are_available():
    response = client.get('/api/denials')
    assert response.status_code in {200, 401}
