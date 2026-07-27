def test_get_users_list(client):
    """Test retrieving the list of users (requires auth)."""
    response = client.get("/api/users")
    
    # Since get_current_user is overridden in conftest, it should succeed
    assert response.status_code == 200
