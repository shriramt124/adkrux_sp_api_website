import json
import logging
import requests
from requests import RequestException

logger = logging.getLogger(__name__)

class LwaAuthenticator:
    """Authenticates with Login with Amazon (LWA) using OAuth 2.0 to get Access Tokens."""
    
    LWA_ENDPOINT = "https://api.amazon.com/auth/o2/token"

    def __init__(self, client_id: str, client_secret: str, refresh_token: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        
        # Cache token to avoid redundant calls
        self._access_token = None

    def get_access_token(self) -> str:
        """Fetch a new access token from LWA, or return cached one if valid logic applies."""
        # For simplicity in a batch script, we simply fetch a fresh token immediately.
        # Tokens are valid for 1 hour. If the script takes > 1 hr, caching logic should track expiry time.
        logger.info("Requesting fresh LWA Access Token...")

        payload = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        try:
            response = requests.post(self.LWA_ENDPOINT, data=payload, timeout=15)
        except RequestException as e:
            logger.error(f"LWA token request failed due to network error: {e}")
            raise Exception("Auth Error: Could not reach Amazon LWA endpoint.")

        if response.status_code == 200:
            data = response.json()
            self._access_token = data.get("access_token")
            logger.info("Successfully received LWA Access Token.")
            return self._access_token
        else:
            error = None
            error_description = None
            request_id = (
                response.headers.get("x-amzn-requestid")
                or response.headers.get("x-amzn-RequestId")
                or response.headers.get("x-request-id")
            )

            try:
                body = response.json()
                error = body.get("error")
                error_description = body.get("error_description")
            except Exception:
                body = None

            if error or error_description:
                details = f"{error or 'unknown_error'}: {error_description or ''}".strip()
            else:
                text = (response.text or "").strip()
                details = text[:300] if text else "(no response body)"

            rid = f" request_id={request_id}" if request_id else ""
            logger.error(
                "Failed to authenticate with Amazon LWA. "
                f"Status={response.status_code}{rid} Details={details}"
            )

            # Provide actionable hints without leaking secrets
            if error == "invalid_grant":
                hint = "Refresh token is invalid/revoked/expired (generate a new refresh token for this LWA app)."
            elif error == "invalid_client":
                hint = "Client ID/secret mismatch (ensure the secret VALUE matches the app that issued the refresh token)."
            else:
                hint = "Check LWA credentials and network access."

            raise Exception(
                f"Auth Error: Could not get LWA token ({response.status_code}). {details}. Hint: {hint}"
            )
