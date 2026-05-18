# Full-Stack SP-API Web Dashboard

This project is the Web UI version of the `adkrux-spapi-publisher` CLI tool. It utilizes a high-performance Python FastAPI backend and a responsive React JS frontend bound together via Server-Sent Events to provide real-time Amazon listing updates directly in your browser.

## Architecture Structure

- `/backend`: Contains the Python FastAPI server, the `.env` credentials, and the `spapi_client` framework to communicate with Amazon.
- `/frontend`: Contains the `index.html` React application.

## Prerequisites
1. Python 3.8+ installed on your system.
2. Admin password configured.
3. Client credentials configured via a single plain JSON file (local for dev OR SharePoint/OneDrive for prod).

## Admin Login + Client Credentials (New)

This app is now protected by a single admin password, and supports multiple clients.

- **Admin auth (required):**
	- `ADMIN_PASSWORD` (the single password you type on the login screen)
	- `ADMIN_SESSION_SECRET` (a long random string stored only on the server; used to sign the login cookie)
	- Optional: `ADMIN_COOKIE_SECURE=true` (recommended in prod; requires HTTPS)
	- Optional: `ADMIN_COOKIE_SAMESITE=lax` (default)

- **Client credentials source (choose one):**
	1) Local JSON (recommended for dev)
		 - `SPAPI_CLIENTS_CONFIG_PATH=clients.json`
		 - See `backend/clients.example.json` for schema.
		 - See `backend/clients.production.template.json` for a 2-client template.
	2) SharePoint/OneDrive JSON via Microsoft Graph (recommended for prod)
		 - `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`
		 - `SPAPI_CLIENTS_SITE_ID`, `SPAPI_CLIENTS_DRIVE_ID`, `SPAPI_CLIENTS_ITEM_PATH`

- **Graph permissions (typical for app-only):**
	- `Sites.Read.All` (Application permission) + admin consent

- **Helper to discover `site_id` / `drive_id`:**
	```bash
	cd backend
	python tools/graph_bootstrap.py \
	  --hostname "<your-tenant>.sharepoint.com" \
	  --site-path "<YourSiteName>" \
	  --drive-name "Documents" \
	  --item-path "Adkrux/clients.json"
	```

- **CORS (required for cookie login when using Vite):**
	- `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

## Setup Instructions

1. Open your terminal and navigate to the backend folder:
```bash
cd backend
```

2. Install the necessary Python packages using pip:
```bash
pip install -r requirements.txt
```

## How to Run the App
### Dev mode (recommended)

Open two terminals.

Terminal A (backend):

```bash
cd backend
pip install -r requirements.txt

# backend/.env must include:
# - ADMIN_PASSWORD
# - ADMIN_SESSION_SECRET

uvicorn main:app --reload --port 8000
```

Terminal B (frontend):

```bash
cd frontend
npm install
npm run dev
```

Open:

- http://127.0.0.1:5173

Login:

- Password is the value of `ADMIN_PASSWORD` in `backend/.env`

1. Start the backend:
```bash
cd backend
pip install -r requirements.txt

# example dev env
export ADMIN_PASSWORD='admin'
export ADMIN_SESSION_SECRET='dev-secret-change-me'
export SPAPI_CLIENTS_CONFIG_PATH='clients.example.json'
export CORS_ORIGINS='http://localhost:5173,http://127.0.0.1:5173'

uvicorn main:app --reload --port 8000
```

2. Start the frontend (Vite):
```bash
cd frontend
npm install
npm run dev
```

3. Open:
```text
http://localhost:5173
```

## Production (Vercel frontend)

Frontend is hosted at `https://adkrux-sp-api-website.vercel.app/`.

To make login (cookie auth) work cross-domain, set these **backend** env vars in your hosting provider:

- `CORS_ORIGINS=https://adkrux-sp-api-website.vercel.app`
	- You can also include dev origins if you want: `http://localhost:5173,http://127.0.0.1:5173,...`
- `ADMIN_COOKIE_SECURE=true` (required for HTTPS)
- `ADMIN_COOKIE_SAMESITE=none` (required when frontend and backend are on different domains)

Optional (if you use Vercel preview URLs):

- `CORS_ORIGIN_REGEX=https://.*\.vercel\.app`

Frontend API calls:

- By default, production frontend calls `https://api-spi.fastapicloud.dev`.
- Override with `VITE_API_BASE_URL` in Vercel env vars if your backend URL changes.

## How to Use the UI
1. **Prepare your Data:** Drag your Cloudinary-processed Excel file (`-cloud.xlsx`) into the dotted drop zone in the browser.
2. **Select Attributes:** Check the boxes for exactly what fields you wish to update on Amazon (Title, Description, Images, etc).
3. **Dry Run Testing:** Ensure the `DRY RUN MODE` checkbox is enabled so you can preview the generated Amazon payload in the UI terminal log before sending it to live instances.
4. **Deploy:** Click the "Deploy to Amazon" button. As the FastAPI backend patches each SKU, the response will stream instantly into the embedded UI terminal at the bottom of the screen!
# sp-api-web
# adkrux_sp_api_website
