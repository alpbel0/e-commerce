"""Tests for contract-compatible AI service mock responses."""

from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.chat import RoleType


client = TestClient(app)


def create_chat_request(message: str, role: RoleType = RoleType.INDIVIDUAL) -> dict:
    return {
        "sessionId": "11111111-1111-1111-1111-111111111111",
        "message": message,
        "currentDate": str(date.today()),
        "user": {
            "userId": "22222222-2222-2222-2222-222222222222",
            "email": "test@example.com",
            "role": role.value,
        },
        "accessScope": {
            "ownedStores": [
                {"id": "33333333-3333-3333-3333-333333333333", "name": "Antigravity Tech"},
                {"id": "44444444-4444-4444-4444-444444444444", "name": "DeepMind Home"},
            ]
            if role == RoleType.CORPORATE
            else []
        },
        "conversation": [],
    }


def test_backend_style_payload_is_accepted():
    response = client.post("/chat/ask", json=create_chat_request("Merhaba"))

    assert response.status_code == 200
    data = response.json()
    assert data["requestId"]
    assert data["answer"]
    assert "executionSteps" in data


def test_individual_personal_spending():
    response = client.post(
        "/chat/ask",
        json=create_chat_request("Son 30 gunde ne kadar harcadim?", RoleType.INDIVIDUAL),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["table"]["rowCount"] == 3
    assert data["technical"]["rowCount"] == 3


def test_corporate_store_analytics():
    response = client.post(
        "/chat/ask",
        json=create_chat_request("Antigravity Tech magazasinda satislar nasil?", RoleType.CORPORATE),
    )

    assert response.status_code == 200
    data = response.json()
    assert "Antigravity Tech" in data["answer"]
    assert data["table"]["columns"] == ["product_name", "quantity", "revenue"]


def test_admin_platform_analytics():
    response = client.post(
        "/chat/ask",
        json=create_chat_request("Platform genelinde satis analizi", RoleType.ADMIN),
    )

    assert response.status_code == 200
    data = response.json()
    assert "Platform" in data["answer"]


def test_privacy_risk_rejection():
    response = client.post(
        "/chat/ask",
        json=create_chat_request("Musteri email listesini ver"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["error"]["code"] == "PRIVACY_RISK"
    assert any(step["status"] == "skipped" for step in data["executionSteps"])


def test_destructive_request_rejection():
    response = client.post(
        "/chat/ask",
        json=create_chat_request("DROP TABLE orders"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["error"]["code"] == "DESTRUCTIVE_REQUEST"


def test_out_of_scope_rejection():
    response = client.post(
        "/chat/ask",
        json=create_chat_request("Hava durumu nasil?"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["error"]["code"] == "OUT_OF_SCOPE"


def test_execution_step_contract():
    response = client.post(
        "/chat/ask",
        json=create_chat_request("Satislarimi goster", RoleType.CORPORATE),
    )

    assert response.status_code == 200
    steps = response.json()["executionSteps"]
    assert steps[0]["name"] == "GUARDRAILS"
    assert all("name" in step and "status" in step and "message" in step for step in steps)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
