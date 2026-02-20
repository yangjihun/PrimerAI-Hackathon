
# NetPlus (AI Hackathon)

## 프로젝트 소개

NetPlus는 영상 시청 중 사용자가 놓친 맥락을 **스포일러 없이** 설명하고 **요약을 제공**하는 **타임라인 기반 시청 보조 챗봇**입니다.

---

## 문제 상황 정의

### 사용자가 겪는 문제
- **끊어보기/이어보기**: 출퇴근/이동 중 짧게 보다가 다시 켜면 “여기까지 무슨 내용이었지?”가 반복됨
- **순간 놓침**: 소음/알림/대화/딴짓으로 대사 한두 줄만 놓쳐도 맥락이 끊기고, 이후 장면이 이해가 어려워짐
- **즉시 복구의 부재**: “방금 왜 화난 거야?”, “저 사람 누구였지?” 같은 질문이 생겨도 바로 해결하기 어려움
- **되감기 비용**: 되감기/자막 다시보기/이전 회차 재생은 시간이 들고 몰입이 끊김
- **검색의 스포일러 리스크**: 커뮤니티/리뷰/위키 검색은 정보는 빠르지만 스포일러 위험이 큼

### 해결 기준
- 답변/요약은 **현재 시점까지만** 근거로 사용 (스포일러 구조적 차단)
- **근거(자막/대사)와 타임라인**을 함께 제시해 신뢰 확보

---

## 구성

<div>
  <img src="https://img.shields.io/badge/be-FastAPI-000000?style=for-the-badge&logo=fastapi&logoColor=009688" />
</div>
<div>
  <img src="https://img.shields.io/badge/fe-React-000000?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/fe-TypeScript-000000?style=for-the-badge&logo=typescript&logoColor=3178C6" />
  <img src="https://img.shields.io/badge/fe-Vite-000000?style=for-the-badge&logo=vite&logoColor=646CFF" />
</div>

---

## 1) 기술 스택

### Backend
<div>
  <img src="https://img.shields.io/badge/Python-000000?style=for-the-badge&logo=python&logoColor=3776AB" />
  <img src="https://img.shields.io/badge/FastAPI-000000?style=for-the-badge&logo=fastapi&logoColor=009688" />
  <img src="https://img.shields.io/badge/SQLAlchemy-000000?style=for-the-badge&logo=sqlalchemy&logoColor=D71F00" />
  <img src="https://img.shields.io/badge/PostgreSQL-000000?style=for-the-badge&logo=postgresql&logoColor=336791" />
  <img src="https://img.shields.io/badge/Docker%20Compose-000000?style=for-the-badge&logo=docker&logoColor=2496ED" />
  <img src="https://img.shields.io/badge/Redis-000000?style=for-the-badge&logo=redis&logoColor=DC382D" />
</div>

### Frontend
<div>
  <img src="https://img.shields.io/badge/React-000000?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-000000?style=for-the-badge&logo=typescript&logoColor=3178C6" />
  <img src="https://img.shields.io/badge/Vite-000000?style=for-the-badge&logo=vite&logoColor=646CFF" />
</div>

### Deploy
<div>
  <img src="https://img.shields.io/badge/Render-000000?style=for-the-badge&logo=render&logoColor=46E3B7" />
  <img src="https://img.shields.io/badge/Netlify-000000?style=for-the-badge&logo=netlify&logoColor=00C7B7" />
</div>

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

### 3-1. Backend 실행

```powershell
cd be
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
````

백엔드 기본 주소:

* `http://127.0.0.1:8000`
* Docs: `http://127.0.0.1:8000/docs`

### 3-2. Frontend 실행

```powershell
cd fe
npm install
npm run dev
```

프론트 기본 주소:

* `http://127.0.0.1:5173`

Vite 프록시가 `/api`를 `http://localhost:8000`으로 전달합니다.

---

## 4) Docker Compose (be 기준)

```powershell
cd be
docker compose up -d --build
```

포함 서비스:

* `postgres` (5432)
* `api` (8000)

`api` 컨테이너는 시작 시 `alembic upgrade head`를 자동 수행합니다.

---

## 5) API 요약

### 기본/인증

* `GET /api/health`
* `POST /api/auth/signup`
* `POST /api/auth/login`
* `GET /api/auth/me`

### 카탈로그/시청

* `GET /api/titles`
* `GET /api/titles/{titleId}`
* `GET /api/titles/{titleId}/episodes`
* `GET /api/episodes/{episodeId}/subtitles`
* `POST /api/episodes/{episodeId}/cache/warmup`

### AI

* `POST /api/qa`
* `POST /api/qa/stream`
* `POST /api/recap`
* `GET /api/qa/history`
* `DELETE /api/qa/history`

### 인물

* `GET /api/characters/{characterId}`
* `GET /api/characters/{characterId}`
* `POST /api/resolve-entity`

### 관리자 인제스트

* `POST /api/ingest/titles`
* `POST /api/ingest/episodes`
* `POST /api/ingest/subtitle-lines:bulk`
* `DELETE /api/ingest/episodes/{episode_id}/subtitle-lines`
* `POST /api/ingest/video-upload-signature`
* `PATCH /api/ingest/episodes/{episode_id}/video-url`
* `DELETE /api/ingest/episodes/{episode_id}/video-url`
* `POST /api/ingest/image-upload-signature`
* `PATCH /api/ingest/titles/{title_id}/thumbnail-url`
* `DELETE /api/ingest/titles/{title_id}/thumbnail-url`
* `DELETE /api/ingest/titles/{title_id}`

---

## 6) 배포 (Render/Netlify)

<div>
  <img src="https://img.shields.io/badge/Backend-Render-000000?style=for-the-badge&logo=render&logoColor=46E3B7" />
  <img src="https://img.shields.io/badge/Backend-Dockerfile-000000?style=for-the-badge&logo=docker&logoColor=2496ED" />
</div>

<div>
  <img src="https://img.shields.io/badge/Frontend-Netlify-000000?style=for-the-badge&logo=netlify&logoColor=00C7B7" />
</div>

