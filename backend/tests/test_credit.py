import pytest

@pytest.mark.xfail(reason="SQLite BigInteger autoincrement issue triggers IntegrityError on session creation")
def test_credit_account_lifecycle(client):
    """Test creating a credit account, retrieving it, and logging a transaction."""
    
    # 1. First, create a pump to attach the credit account to
    pump_response = client.post("/api/pumps/", json={"name": "Credit Test Pump"})
    assert pump_response.status_code in [200, 201]
    pump_id = pump_response.json()["id"]

    # 2. Create Credit Account
    acc_response = client.post(
        "/api/credit/accounts",
        json={
            "account_name": "Test Customer Account",
            "pump_id": pump_id,
            "current_outstanding_balance": 0.0
        }
    )
    assert acc_response.status_code in [200, 201]
    account_id = acc_response.json()["id"]

    # 3. Log a charge transaction
    tx_response = client.post(
        f"/api/credit/accounts/{account_id}/transactions",
        json={
            "account_id": account_id,
            "type": "CHARGE",
            "amount": 100.50,
            "notes": "Test fuel charge",
            "log_date": "2026-07-27",
            "log_timestamp": "2026-07-27T10:00:00Z",
            "payment_method": None
        }
    )
    assert tx_response.status_code in [200, 201]

    # 4. Verify balance updated
    get_acc_response = client.get(f"/api/credit/accounts/{account_id}")
    assert get_acc_response.status_code == 200
    assert float(get_acc_response.json()["current_outstanding_balance"]) == 100.50
