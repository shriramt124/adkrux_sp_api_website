import os
import json
import asyncio
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from spapi_client.parser import ExcelParser
from spapi_client.patcher import SpApiPatcher
from dotenv import load_dotenv
import logging

from admin_auth import (
    get_admin_password,
    get_admin_session_secret,
    get_cookie_name,
    issue_session_token,
    require_admin_dep,
)
from credential_store import CredentialStore

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI()

cors_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000,https://adkrux-sp-api-website.vercel.app",
    ).split(",")
    if o.strip()
]
cors_origin_regex = (os.getenv("CORS_ORIGIN_REGEX", "").strip() or None)

app.add_middleware(
    CORSMiddleware,
    # Cookie auth requires explicit origins when allow_credentials=True.
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cred_store = CredentialStore()


@app.on_event("startup")
def _startup() -> None:
    # Ensure admin env vars exist early (fail-fast)
    _ = get_admin_password()
    _ = get_admin_session_secret()
    # Load client credentials (Graph or local file).
    cred_store.reload()


from pydantic import BaseModel


class LoginRequest(BaseModel):
    password: str


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    if (req.password or "").strip() != get_admin_password():
        raise HTTPException(status_code=401, detail="Invalid password")

    # Keep admin logged in unless they click Logout.
    # We implement this as a long-lived cookie (10 years) rather than a short TTL.
    cookie_max_age_s = 10 * 365 * 24 * 3600
    token = issue_session_token(secret=get_admin_session_secret(), ttl_s=cookie_max_age_s)
    resp = JSONResponse({"ok": True})
    resp.set_cookie(
        key=get_cookie_name(),
        value=token,
        httponly=True,
        samesite=os.getenv("ADMIN_COOKIE_SAMESITE", "lax"),
        secure=os.getenv("ADMIN_COOKIE_SECURE", "false").lower() == "true",
        max_age=cookie_max_age_s,
        path="/",
    )
    return resp


@app.post("/api/auth/logout")
async def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(get_cookie_name(), path="/")
    return resp


@app.get("/api/auth/me")
async def me(_: None = Depends(require_admin_dep)):
    return {"ok": True}


@app.get("/api/clients")
async def list_clients(_: None = Depends(require_admin_dep)):
    cred_store.maybe_reload(max_age_s=int(os.getenv("SPAPI_CLIENTS_CACHE_S", "300")))
    return {"clients": cred_store.list_clients_safe()}


@app.get("/api/clients/meta")
async def clients_meta(_: None = Depends(require_admin_dep)):
    cred_store.maybe_reload(max_age_s=int(os.getenv("SPAPI_CLIENTS_CACHE_S", "300")))
    return cred_store.meta_safe()

@app.post("/api/process")
async def process_listings(
    file: UploadFile = File(...),
    flags: str = Form(...),
    client_id: str = Form(...),
    account_type: str = Form(default="seller"),  # "seller" or "vendor"
    override_id: str = Form(default=""),
    _: None = Depends(require_admin_dep),
):
    """
    Streaming Endpoint: Yields SSE events as Amazon completes patches.
    """
    flag_data = json.loads(flags)
    
    # Save uploaded file to temp path
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    async def event_generator():
        cred_store.maybe_reload(max_age_s=int(os.getenv("SPAPI_CLIENTS_CACHE_S", "300")))
        try:
            client = cred_store.get_client(client_id)
        except KeyError:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Unknown client_id: {client_id}'})}\n\n"
            return

        override_id_clean = (override_id or "").strip()

        if account_type == "vendor":
            if not client.vendor:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Client {client.id} has no vendor credentials configured'})}\n\n"
                return
            active_id = override_id_clean or client.vendor.default_vendor_code
            active_client_id = client.vendor.vendor_client_id
            active_client_secret = client.vendor.vendor_client_secret
            active_refresh_token = client.vendor.vendor_refresh_token
            account_label = f"Vendor Central ({client.name})"
        else:
            if not client.seller:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Client {client.id} has no seller credentials configured'})}\n\n"
                return
            active_id = override_id_clean or client.seller.default_seller_id
            active_client_id = client.seller.lwa_client_id
            active_client_secret = client.seller.lwa_client_secret
            active_refresh_token = client.seller.lwa_refresh_token
            account_label = f"Seller Central ({client.name})"

        yield f"data: {json.dumps({'type': 'info', 'message': f'Received {file.filename} → {account_label} | client_id={client.id} | id={active_id}'})}\n\n"
        await asyncio.sleep(0.5)

        try:
            # 1. Parse Excel
            yield f"data: {json.dumps({'type': 'info', 'message': 'Parsing Excel file mapping...'})}\n\n"
            parser = ExcelParser(
                filepath=tmp_path,
                enable_search_terms=flag_data.get("search_terms", False),
                enable_title=flag_data.get("title", False),
                enable_description=flag_data.get("description", False),
                enable_bullet_points=flag_data.get("bullet_points", False),
                enable_main_image=flag_data.get("main_image", False),
                enable_lifestyle_images=flag_data.get("lifestyle_images", False),
                enable_why_choose_us_image=flag_data.get("why_choose_us_image", False),
            )
            data_rows = parser.parse()
            
            if not data_rows:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No valid parsing targets found in Excel file.'})}\n\n"
                return
                
            yield f"data: {json.dumps({'type': 'info', 'message': f'Extracted {len(data_rows)} rows. Connecting to SP-API.'})}\n\n"
            
            # Initialize patcher using the right credentials
            from spapi_client.auth import LwaAuthenticator
            authenticator = LwaAuthenticator(active_client_id, active_client_secret, active_refresh_token)
            patcher = SpApiPatcher(seller_id=active_id, authenticator=authenticator)
            
            # 2. Iterate and Stream Patches
            success_count = 0
            for item in data_rows:
                sku = item["sku"]
                country = item["country"]
                
                try:
                    success, message = patcher.patch_listing(
                        sku=sku,
                        country_code=country,
                        payload_data=item,
                        dry_run=flag_data.get("dry_run", False)
                    )
                    
                    if success:
                        success_count += 1
                        yield f"data: {json.dumps({'type': 'success', 'sku': sku, 'country': country, 'response': message})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'error', 'sku': sku, 'country': country, 'message': message})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'sku': sku, 'country': country, 'message': str(e)})}\n\n"
                
                # Slight buffer to prevent hammering SP-API rate limits
                await asyncio.sleep(0.5)
                
            yield f"data: {json.dumps({'type': 'complete', 'message': f'Batch finished. {success_count} Updates Applied.'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Critical Error: {str(e)}'})}\n\n"
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    return StreamingResponse(event_generator(), media_type="text/event-stream")

from pydantic import BaseModel

class DeleteRequest(BaseModel):
    sku: str
    asin: str = None
    country: str
    account_type: str = "seller"
    client_id: str
    override_id: str = None

@app.delete("/api/listing")
async def delete_api_listing(req: DeleteRequest, _: None = Depends(require_admin_dep)):
    cred_store.maybe_reload(max_age_s=int(os.getenv("SPAPI_CLIENTS_CACHE_S", "300")))
    try:
        client = cred_store.get_client(req.client_id)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown client_id: {req.client_id}")

    override_id_clean = (req.override_id or "").strip()
    if req.account_type == "vendor":
        if not client.vendor:
            raise HTTPException(status_code=400, detail=f"Client {client.id} has no vendor credentials")
        active_id = override_id_clean or client.vendor.default_vendor_code
        active_client_id = client.vendor.vendor_client_id
        active_client_secret = client.vendor.vendor_client_secret
        active_refresh_token = client.vendor.vendor_refresh_token
    else:
        if not client.seller:
            raise HTTPException(status_code=400, detail=f"Client {client.id} has no seller credentials")
        active_id = override_id_clean or client.seller.default_seller_id
        active_client_id = client.seller.lwa_client_id
        active_client_secret = client.seller.lwa_client_secret
        active_refresh_token = client.seller.lwa_refresh_token

    try:
        from spapi_client.auth import LwaAuthenticator
        authenticator = LwaAuthenticator(active_client_id, active_client_secret, active_refresh_token)
        patcher = SpApiPatcher(seller_id=active_id, authenticator=authenticator)
        
        success, message = patcher.delete_listing(sku=req.sku, asin=req.asin, country_code=req.country)
        
        if success:
            return {"status": "success", "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeleteAttributeRequest(BaseModel):
    sku: str
    asin: str = None
    country: str
    attribute_key: str
    dry_run: bool = False
    account_type: str = "seller"
    client_id: str
    override_id: str = None

@app.patch("/api/listing/attribute")
async def delete_listing_attribute(req: DeleteAttributeRequest, _: None = Depends(require_admin_dep)):
    """
    Removes a single attribute (title, bullet point, image slot, etc.)
    from a listing using patchListingsItem with op=delete.
    """
    cred_store.maybe_reload(max_age_s=int(os.getenv("SPAPI_CLIENTS_CACHE_S", "300")))
    try:
        client = cred_store.get_client(req.client_id)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown client_id: {req.client_id}")

    override_id_clean = (req.override_id or "").strip()
    if req.account_type == "vendor":
        if not client.vendor:
            raise HTTPException(status_code=400, detail=f"Client {client.id} has no vendor credentials")
        active_id           = override_id_clean or client.vendor.default_vendor_code
        active_client_id    = client.vendor.vendor_client_id
        active_client_secret = client.vendor.vendor_client_secret
        active_refresh_token = client.vendor.vendor_refresh_token
    else:
        if not client.seller:
            raise HTTPException(status_code=400, detail=f"Client {client.id} has no seller credentials")
        active_id           = override_id_clean or client.seller.default_seller_id
        active_client_id    = client.seller.lwa_client_id
        active_client_secret = client.seller.lwa_client_secret
        active_refresh_token = client.seller.lwa_refresh_token

    try:
        from spapi_client.auth import LwaAuthenticator
        authenticator = LwaAuthenticator(active_client_id, active_client_secret, active_refresh_token)
        patcher = SpApiPatcher(seller_id=active_id, authenticator=authenticator)

        success, result = patcher.delete_attribute(
            sku=req.sku,
            asin=req.asin,
            country_code=req.country,
            attribute_key=req.attribute_key,
            dry_run=req.dry_run
        )

        if success:
            return {"status": "success", "data": result}
        else:
            raise HTTPException(status_code=400, detail=result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount statically built React if it exists
app.mount("/", StaticFiles(directory="static", html=True), name="frontend")
