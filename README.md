# OpenAI Hackathon Starter

This repository is split into two apps:

- `be`: Python FastAPI backend
- `fe`: React + TypeScript frontend (Vite)

## Prerequisites

- Python 3.12+
- Node.js 20+
- npm

## Backend (`be`)

```powershell
cd be

# Create venv once (skip if already created)
python -m venv .venv

# Activate venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run API server
uvicorn app.main:app --reload
```

Backend URLs:
- API root: `http://127.0.0.1:8000/`
- Swagger UI: `http://127.0.0.1:8000/docs`

## Frontend (`fe`) - Vite

```powershell
cd fe
npm install
npm run dev
```

Frontend URL:
- App: `http://127.0.0.1:5173/`

## Run Both

Use two terminals:

1. Terminal A: run backend commands in `be`
2. Terminal B: run frontend commands in `fe`

## Environment Files

Both `be` and `fe` ignore local env files via `.gitignore`:

- `.env`
- `.env.*`

If needed, keep committed samples as:

- `.env.example`
cd fe