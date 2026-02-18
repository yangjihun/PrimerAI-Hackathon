# NetPlus MVP Backend

FastAPI backend implementing NetPlus P0:
- Time-based RAG with spoiler guard
- Evidence-first recap and QA
- Graph / relation / character endpoints
- Entity resolve endpoint

## Stack

- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL (SQLite fallback for local/tests)
- OpenAI adapter (optional)

## Quickstart

```powershell
cd be
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

## PostgreSQL with Docker

```powershell
cd be
docker compose up -d postgres
docker compose ps
```

`.env` uses this default connection:

`DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/netplus`

## Run API

```powershell
uvicorn app.main:app --reload
```

## DB Migration

```powershell
alembic upgrade head
```

## Seed Demo Data

```powershell
python scripts/seed_demo_data.py
python scripts/build_chunks.py
```

## Tests

```powershell
pytest -q
```

## Policy Guarantees

- Retrieval guard: `subtitle_chunks.start_ms <= current_time_ms`
- Evidence guard: evidence lines after `current_time_ms` are removed by validator
- Cross-episode evidence is removed by validator
- QA degrade: if evidence missing, response returns low confidence and `EVIDENCE_INSUFFICIENT`

## Main Endpoints

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/titles`
- `GET /api/titles/{titleId}`
- `GET /api/titles/{titleId}/episodes`
- `POST /api/recap`
- `POST /api/qa`
- `GET /api/graph`
- `GET /api/relations/{relationId}`
- `GET /api/characters/{characterId}`
- `POST /api/resolve-entity`

See `openapi.yaml` for contract details.
