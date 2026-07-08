import requests
from _keycloak import Keycloak


def call_accountability_job(
    base_url: str,
    kc_auth_url: str,
    kc_realm: str,
    kc_client_id: str,
    kc_client_secret: str,
    job: str,
):
    """
    Invoke a Registry accountability scheduled job via the internal API.

    Parameters:
    - base_url: Registry app base URL (no trailing slash)
    - job: one of quarterly-reminder, weekly-signoff-reminder, monthly-recap, m-plus-one-escalation
    """
    kc = Keycloak(kc_auth_url, kc_realm, kc_client_id, kc_client_secret)
    access_token = kc.get_access_token()
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    url = f"{base_url}/api/internal/accountability/jobs"
    response = requests.post(url, headers=headers, json={"job": job}, timeout=300)

    print(f"Accountability job URL: {url}")
    print(f"Job: {job}")
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text[:1000]!r}")

    response.raise_for_status()
    return response.json()
