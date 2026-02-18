# Watch 페이지 개발 가이드

## 프로젝트 구조 (FSD 아키텍처)

```
src/
├── app/                    # 앱 초기화, 라우팅
│   ├── App.tsx            # 라우터 설정
│   └── index.css          # 전역 스타일
├── pages/                  # 페이지 컴포넌트
│   └── watch/
│       └── ui/
│           └── WatchPage.tsx
├── widgets/               # 독립적인 기능 블록
│   └── netplus-sidebar/
│       └── ui/
│           └── NetPlusSidebar.tsx
├── features/              # 사용자 기능
│   ├── companion-chat/
│   │   └── ui/
│   │       └── CompanionChatPanel.tsx
│   ├── relationship-graph/
│   │   └── ui/
│   │       └── RelationshipGraphPanel.tsx
│   └── recap/
│       └── ui/
│           └── RecapPanel.tsx
├── entities/              # 비즈니스 엔티티 (필요시 확장)
├── shared/                # 공유 리소스
│   ├── api/
│   │   └── netplus.ts     # API 서비스 레이어 (현재 mock)
│   ├── types/
│   │   └── netplus.ts     # 타입 정의
│   ├── lib/
│   │   └── utils.ts       # 유틸리티 함수
│   └── ui/                # 공유 UI 컴포넌트
│       ├── Button.tsx
│       ├── Card.tsx
│       └── EvidenceQuote.tsx
└── main.tsx               # 진입점
```

## 주요 기능

### 1. Watch 페이지 (`/watch`)
- 넷플릭스 스타일의 시청 레이아웃
- 비디오 플레이어 영역 (현재 placeholder)
- 작품/회차 선택 드롭다운
- 추천 콘텐츠 섹션
- 우측 NetPlus 사이드바

### 2. NetPlus 사이드바
3개의 탭으로 구성:
- **함께 보는 친구 (Companion Chat)**: AI와 대화하며 질문/답변
- **관계도 (Relationship Graph)**: 인물 관계 시각화
- **리캡 (Recap)**: 지난 내용 요약 생성

### 3. Evidence 기반 UX
모든 답변/요약/관계에는 근거(Evidence)가 포함:
- 근거 자막 1~2줄
- 타임스탬프
- EvidenceQuote 컴포넌트로 표시

### 4. 스포일러 방지
- `currentTimeMs` 기준으로 현재 시점 이후 정보 제외
- 모든 API 호출에 `current_time_ms` 파라미터 필수

## API 연동 (향후)

현재는 `shared/api/netplus.ts`에 mock 구현이 있습니다.
실제 FastAPI 백엔드와 연동할 때:

1. `shared/api/netplus.ts`의 함수들을 `fetch`로 교체
2. 환경 변수로 API 베이스 URL 설정
3. 타입은 그대로 유지 (OpenAPI 스펙과 일치)

예시:
```typescript
export async function createRecap(params: RecapRequest): Promise<RecapResponse> {
  const response = await fetch(`${API_BASE_URL}/api/recap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return response.json();
}
```

## 스타일링

- 전역 CSS (`app/index.css`) 사용
- CSS 변수로 테마 관리 (`:root`)
- 다크 테마 기본
- 반응형: 데스크톱(고정 사이드바) / 모바일(drawer overlay)

## 실행 방법

```bash
cd fe
npm install
npm run dev
```

브라우저에서 `http://localhost:5173/watch` 접속

## 주요 컴포넌트 설명

### WatchPage
- 메인 시청 페이지
- 작품/회차 선택
- 현재 시청 시점(`currentTimeMs`) 관리
- 사이드바 열기/닫기 제어

### NetPlusSidebar
- 3개 탭 전환
- 현재 회차/시점 표시
- 모바일에서 drawer로 동작

### CompanionChatPanel
- 사용자 질문 입력
- 빠른 프리셋 버튼
- AI 답변 표시 (결론, 맥락, 해석, 근거)

### RelationshipGraphPanel
- 인물 노드 클릭 → 인물 요약 카드
- 관계 엣지 클릭 → 관계 상세 + 근거
- 현재 시점 기준 필터링

### RecapPanel
- 프리셋 선택 (20초/1분/3분)
- 모드 선택 (인물 중심/갈등 중심)
- 요약 + 관전 포인트 + 근거 표시

## 타입 정의

모든 타입은 `shared/types/netplus.ts`에 정의되어 있습니다.
OpenAPI 스펙과 일치하도록 설계되었습니다.

## 향후 개선 사항

1. 실제 비디오 플레이어 연동 (예: Video.js, Plyr)
2. 그래프 시각화 라이브러리 추가 (예: react-flow, vis.js)
3. 채팅 히스토리 저장/복원
4. 키보드 단축키 지원
5. 접근성 개선 (ARIA 라벨, 키보드 네비게이션)

