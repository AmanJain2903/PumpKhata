def test_google_login_invalid_token(client):
    """Test that providing an invalid Google token returns a 401 Unauthorized."""
    response = client.post(
        "/api/auth/google",
        json={"credential": "invalid_mock_token"}
    )
    assert response.status_code in [401, 422]
    assert "detail" in response.json()
    assert response.json()["detail"] == "Invalid Google token"

# Note: We cannot easily test successful Google login end-to-end without mocking 
# the external `id_token.verify_oauth2_token` call. Since we are testing endpoints 
# without modifying application code, testing the rejection of a bad token ensures
# the endpoint exists and correctly validates inputs.
