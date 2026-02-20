# NetPlus (AI Hackathon MVP)

영상 시청 중 현재 시점 기준으로
- `Net+ 챗봇` (작품 질문/일상 질문 분기)
- `내용 요약` (20초/1분/3분)
을 제공하는 서비스입니다.

구성:
- `be`: FastAPI 백엔드
- `fe`: React + TypeScript + Vite 프론트엔드

---

## 1) 기술 스택

### Backend
- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL (로컬은 Docker Compose)
- OpenAI API (선택)
- Redis/Valkey 캐시 (선택)

### Frontend
- React 18
- TypeScript
- Vite

---

## 2) 핵심 기능

- 시청 시간(`current_time_ms`) 기반 QA/RAG
- 내용 요약(20초/1분/3분 프리셋)
- 질문 스타일(친구/비서/평론가) 반영
- 일상 질문 vs 작품 질문 의도 분류
- 질문별 기준 시점 타임라인 표시 (채팅 메시지 상단)
- 채팅 히스토리 저장/복원/초기화
- 에피소드 선택 시 Redis 캐시 warmup
- 관리자 인제스트(작품/에피소드/자막/영상 URL/썸네일)

---

## 3) 로컬 실행

## 3-1. Backend 실행

```powershell
cd be
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

백엔드 기본 주소:
- `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`

## 3-2. Frontend 실행

```powershell
cd fe
npm install
npm run dev
```

프론트 기본 주소:
- `http://127.0.0.1:5173`

Vite 프록시가 `/api`를 `http://localhost:8000`으로 전달합니다.

---

## 4) Docker Compose (be 기준)

```powershell
cd be
docker compose up -d --build
```

포함 서비스:
- `postgres` (5432)
- `api` (8000)

`api` 컨테이너는 시작 시 `alembic upgrade head`를 자동 수행합니다.

---

## 5) 환경 변수

샘플: `be/.env.example`

주요 변수:
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `USE_OPENAI`
- `AUTH_JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `ADMIN_EMAIL`
- `REDIS_URL`
- `REDIS_CACHE_TTL_SECONDS`
- `CHAT_HISTORY_WINDOW`
- `USE_PGVECTOR`

`USE_PGVECTOR`:
- `false`(기본): pgvector 미사용, 기존 검색 경로 사용
- `true`: PostgreSQL에서 pgvector 확장/컬럼이 준비된 경우 벡터 SQL 검색 사용

주의:
- DB 서버에 `vector` extension이 실제 설치되어 있어야 합니다.
- 미지원 환경에서는 `USE_PGVECTOR=false`로 두세요.

---

## 6) API 요약

### 기본/인증
- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### 카탈로그/시청
- `GET /api/titles`
- `GET /api/titles/{titleId}`
- `GET /api/titles/{titleId}/episodes`
- `GET /api/episodes/{episodeId}/subtitles`
- `POST /api/episodes/{episodeId}/cache/warmup`

### AI
- `POST /api/qa`
- `POST /api/recap`
- `GET /api/qa/history`
- `DELETE /api/qa/history`

### 인물
- `GET /api/characters/{characterId}`
- `POST /api/resolve-entity`

### 관리자 인제스트
- `POST /api/ingest/titles`
- `POST /api/ingest/episodes`
- `POST /api/ingest/subtitle-lines:bulk`
- `DELETE /api/ingest/episodes/{episode_id}/subtitle-lines`
- `POST /api/ingest/video-upload-signature`
- `PATCH /api/ingest/episodes/{episode_id}/video-url`
- `DELETE /api/ingest/episodes/{episode_id}/video-url`
- `POST /api/ingest/image-upload-signature`
- `PATCH /api/ingest/titles/{title_id}/thumbnail-url`
- `DELETE /api/ingest/titles/{title_id}/thumbnail-url`

---

## 7) 배포 메모 (Render/Netlify)

- Backend(Render): Dockerfile 사용
- Frontend(Netlify): `VITE_API_BASE_URL`를 Render 백엔드 URL로 지정
- CORS:
  - Backend `ENVIRONMENT=production`
  - Backend `CORS_ALLOWED_ORIGINS=https://<프론트도메인>`

---

## 8) 보안 주의

- `.env`/실제 키는 절대 커밋하지 마세요.
- 노출된 키(OPENAI/CLOUDINARY/JWT/DB)는 즉시 재발급/교체하세요.
- `AUTH_JWT_SECRET`는 충분히 긴 랜덤 값으로 설정하세요.

