from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Welcome to the MPLAD Risk Intelligence API" in data["message"]
    assert data["health_check"] == "/api/v1/health"


def test_health_check_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "MPLAD Risk Intelligence API"
    assert "timestamp" in data
    assert data["details"]["system"] == "SIH26102 - Neural Nova"
