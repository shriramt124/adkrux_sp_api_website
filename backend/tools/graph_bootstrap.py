import argparse
import json
import os
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv


def _get_graph_access_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
        "scope": "https://graph.microsoft.com/.default",
    }
    resp = requests.post(token_url, data=data, timeout=30)
    resp.raise_for_status()
    js = resp.json()
    tok = js.get("access_token")
    if not tok:
        raise RuntimeError("Graph token missing access_token")
    return tok


def _get(token: str, url: str) -> Dict[str, Any]:
    resp = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        status = resp.status_code
        body = (resp.text or "").strip()
        snippet = body[:500] + ("…" if len(body) > 500 else "")
        if status in (401, 403):
            raise SystemExit(
                "Graph request was unauthorized/forbidden. Most common causes:\n"
                "- Missing Microsoft Graph *Application* permission: Sites.Read.All (or Sites.Selected + site grant)\n"
                "- Admin consent not granted after adding permission\n"
                "- Wrong tenant/client/secret (token is for a different tenant)\n\n"
                f"URL: {url}\nHTTP {status}: {snippet}"
            ) from e
        raise SystemExit(f"Graph request failed. URL: {url} HTTP {status}: {snippet}") from e
    return resp.json()


def main() -> None:
    # Allow using backend/.env when running locally.
    load_dotenv(override=True)

    ap = argparse.ArgumentParser(
        description="Resolve SharePoint site_id/drive_id and verify JSON path for adkrux-spapi-web client config."
    )
    ap.add_argument("--hostname", required=True, help="e.g. contoso.sharepoint.com")
    ap.add_argument(
        "--site-path",
        required=True,
        help=(
            "Server-relative site path after the hostname. Examples: "
            "'sites/MyTeamSite' or 'personal/user_domain_com'. Do NOT include the hostname."
        ),
    )
    ap.add_argument("--drive-name", default=None, help="Drive display name (optional). If omitted, prints all drives.")
    ap.add_argument(
        "--item-path",
        default=None,
        help="Path to the JSON file inside the drive root (e.g. Adkrux/clients.json)",
    )
    args = ap.parse_args()

    tenant_id = os.getenv("GRAPH_TENANT_ID", "").strip()
    client_id = os.getenv("GRAPH_CLIENT_ID", "").strip()
    client_secret = os.getenv("GRAPH_CLIENT_SECRET", "").strip()
    if not (tenant_id and client_id and client_secret):
        raise SystemExit(
            "Missing env vars: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET (Graph app client-credential flow)"
        )

    token = _get_graph_access_token(tenant_id, client_id, client_secret)

    site_path = str(args.site_path or "").strip().lstrip("/")
    # Graph expects: /sites/{hostname}:/{server-relative-path}
    site = _get(token, f"https://graph.microsoft.com/v1.0/sites/{args.hostname}:/{site_path}")
    site_id = site.get("id")
    if not site_id:
        raise SystemExit("Could not resolve site id")

    drives = _get(token, f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives").get("value") or []
    if not drives:
        raise SystemExit("No drives found for the resolved site")

    drive_id: Optional[str] = None
    if args.drive_name:
        for d in drives:
            if str(d.get("name") or "").strip().lower() == args.drive_name.strip().lower():
                drive_id = d.get("id")
                break
        if not drive_id:
            names = [d.get("name") for d in drives]
            raise SystemExit(f"Drive '{args.drive_name}' not found. Available drives: {names}")
    else:
        print("Resolved site_id:")
        print(site_id)
        print("\nAvailable drives:")
        for d in drives:
            print(f"- {d.get('name')}  id={d.get('id')}")
        print("\nRe-run with --drive-name to pick a drive.")
        return

    print("Resolved values:")
    print(json.dumps({"site_id": site_id, "drive_id": drive_id}, indent=2))

    if args.item_path:
        item_path = args.item_path.lstrip("/")
        meta = _get(
            token,
            f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{item_path}",
        )
        print("\nVerified item metadata:")
        print(json.dumps({"name": meta.get("name"), "size": meta.get("size"), "id": meta.get("id")}, indent=2))

        print("\nSet these env vars in your backend runtime:")
        print(f"GRAPH_TENANT_ID=... (already set)")
        print(f"GRAPH_CLIENT_ID=... (already set)")
        print(f"GRAPH_CLIENT_SECRET=... (already set)")
        print(f"SPAPI_CLIENTS_SITE_ID={site_id}")
        print(f"SPAPI_CLIENTS_DRIVE_ID={drive_id}")
        print(f"SPAPI_CLIENTS_ITEM_PATH=/{item_path}")


if __name__ == "__main__":
    main()
