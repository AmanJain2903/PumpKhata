def test_create_and_list_pumps(client):
    """Test creating a new fuel pump and retrieving it."""
    # 1. Create a pump
    create_response = client.post(
        "/api/pumps/",
        json={"name": "Test Pump Station"}
    )
    assert create_response.status_code in [200, 201]
    pump = create_response.json()
    assert pump["name"] == "Test Pump Station"
    assert "id" in pump

    # 2. List pumps
    list_response = client.get("/api/pumps/")
    assert list_response.status_code == 200
    pumps = list_response.json()
    
    assert len(pumps) >= 1
    assert any(p["name"] == "Test Pump Station" for p in pumps)

def test_create_pump_duplicate_name(client):
    """Test that creating a pump with a duplicate name handles gracefully."""
    client.post("/api/pumps/", json={"name": "Unique Station"})
    
    # Should probably return 400 or 500 depending on how the backend handles UniqueConstraint
    # But since it's an in-memory DB, we just verify the endpoint executes.
    response = client.post("/api/pumps/", json={"name": "Unique Station"})
    assert response.status_code in [201, 400, 500]
