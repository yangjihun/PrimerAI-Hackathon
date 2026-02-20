import type {
  ChatHistoryClearResponse,
  ChatHistoryResponse,
  Episode,
  QARequest,
  QAResponse,
  RecapRequest,
  RecapResponse,
  SubtitleLine,
  Title,
  UUID,
} from "../types/netplus";
import { apiRequest } from "./http";

interface PaginatedTitlesResponse {
  items: Title[];
  next_cursor: string | null;
}

interface EpisodesResponse {
  title_id: UUID;
  episodes: Episode[];
}

interface EpisodeSubtitlesResponse {
  episode_id: UUID;
  items: SubtitleLine[];
}

interface TitleCreatePayload {
  name: string;
  description?: string;
  thumbnail_url?: string;
}

interface EpisodeCreatePayload {
  title_id: UUID;
  season: number;
  episode_number: number;
  name?: string;
  duration_ms: number;
  video_url?: string;
}

interface SubtitleLineCreatePayload {
  episode_id: UUID;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_text?: string;
}

interface SubtitleLineBulkPayload {
  lines: SubtitleLineCreatePayload[];
  replace_existing?: boolean;
}

interface IngestSubtitleLinesResponse {
  inserted_count: number;
  queued_embedding_jobs: number;
}

interface VideoUploadSignatureRequest {
  episode_id: UUID;
  filename: string;
}

interface VideoUploadSignatureResponse {
  upload_url: string;
  api_key: string;
  timestamp: string;
  folder: string;
  public_id: string;
  signature: string;
}

interface ImageUploadSignatureRequest {
  title_id: UUID;
  filename: string;
}

interface ImageUploadSignatureResponse {
  upload_url: string;
  api_key: string;
  timestamp: string;
  folder: string;
  public_id: string;
  signature: string;
}

const USE_MOCK_DATA =
  (import.meta.env.VITE_USE_MOCK_DATA as string | undefined)?.toLowerCase() === "true";

const MOCK_TITLES: Title[] = [
  {
    id: "title-demo-1",
    name: "Demo Thriller A",
    description: "Frontend mock catalog item for local development.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "title-demo-2",
    name: "Signal Point",
    description: "Crime mystery with layered clues and relationships.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "title-demo-3",
    name: "Midnight Route",
    description: "Suspense drama following a hidden investigation.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1200&q=80",
  },
];

const MOCK_EPISODES: Record<UUID, Episode[]> = {
  "title-demo-1": [
    {
      id: "ep-demo-1-1",
      title_id: "title-demo-1",
      season: 1,
      episode_number: 1,
      name: "The Missing Statement",
      duration_ms: 3_600_000,
    },
    {
      id: "ep-demo-1-2",
      title_id: "title-demo-1",
      season: 1,
      episode_number: 2,
      name: "False Alibi",
      duration_ms: 3_420_000,
    },
  ],
  "title-demo-2": [
    {
      id: "ep-demo-2-1",
      title_id: "title-demo-2",
      season: 1,
      episode_number: 1,
      name: "Silent Floor",
      duration_ms: 3_480_000,
    },
  ],
  "title-demo-3": [
    {
      id: "ep-demo-3-1",
      title_id: "title-demo-3",
      season: 1,
      episode_number: 1,
      name: "Shadow Passenger",
      duration_ms: 3_540_000,
    },
  ],
};

function toQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function withMockFallback<T>(
  label: string,
  request: () => Promise<T>,
  mockFactory: () => T,
): Promise<T> {
  if (USE_MOCK_DATA) {
    return mockFactory();
  }
  try {
    return await request();
  } catch (error) {
    console.warn(`[mock-fallback] ${label}`, error);
    return mockFactory();
  }
}

export async function listTitles(): Promise<Title[]> {
  return withMockFallback(
    "listTitles",
    async () => {
      const response = await apiRequest<PaginatedTitlesResponse>("/api/titles");
      return response.items.map((item) => ({
        ...item,
        description: item.description ?? "",
      }));
    },
    () => MOCK_TITLES,
  );
}

export async function listEpisodes(titleId: UUID): Promise<Episode[]> {
  return withMockFallback(
    "listEpisodes",
    async () => {
      const response = await apiRequest<EpisodesResponse>(`/api/titles/${titleId}/episodes`);
      return response.episodes.map((episode) => ({
        ...episode,
        name: episode.name ?? `Episode ${episode.episode_number}`,
        duration_ms: episode.duration_ms ?? 0,
      }));
    },
    () => MOCK_EPISODES[titleId] ?? [],
  );
}

export async function createRecap(params: RecapRequest): Promise<RecapResponse> {
  return withMockFallback(
    "createRecap",
    async () =>
      apiRequest<RecapResponse>("/api/recap", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    () => ({
      meta: {
        title_id: params.title_id,
        episode_id: params.episode_id,
        current_time_ms: params.current_time_ms,
        spoiler_guard_applied: true,
        model: "mock",
      },
      recap: {
        text: "Mock recap: tension rises as conflicting testimonies emerge.",
        bullets: [
          "A questions B's consistency.",
          "C attempts to calm the conflict.",
          "Trust between characters decreases.",
        ],
      },
      watch_points: [
        "Watch B's reaction in the next scene.",
        "Pay attention to C's neutral stance.",
      ],
      evidences: [],
      warnings: [],
    }),
  );
}

export async function askQuestion(params: QARequest): Promise<QAResponse> {
  return withMockFallback(
    "askQuestion",
    async () =>
      apiRequest<QAResponse>("/api/qa", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    () => ({
      meta: {
        title_id: params.title_id,
        episode_id: params.episode_id,
        current_time_ms: params.current_time_ms,
        spoiler_guard_applied: true,
        model: "mock",
      },
      answer: {
        conclusion: `Mock answer: ${params.question}`,
        context: ["A and B are in active conflict.", "C is trying to mediate the scene."],
        interpretations: [
          {
            label: "Conflict",
            text: "Statements are inconsistent, causing mistrust.",
            confidence: 0.78,
          },
        ],
        overall_confidence: 0.74,
      },
      evidences: [],
      related_graph_focus: null,
      warnings: [],
    }),
  );
}

export async function getQaHistory(params: {
  title_id: UUID;
  episode_id: UUID;
  limit?: number;
}): Promise<ChatHistoryResponse> {
  if (USE_MOCK_DATA) {
    return { items: [] };
  }
  const query = toQuery({
    title_id: params.title_id,
    episode_id: params.episode_id,
    limit: params.limit ?? 100,
  });
  return apiRequest<ChatHistoryResponse>(`/api/qa/history${query}`);
}

export async function clearQaHistory(params: {
  title_id: UUID;
  episode_id: UUID;
}): Promise<ChatHistoryClearResponse> {
  if (USE_MOCK_DATA) {
    return { deleted_messages: 0, deleted_sessions: 0 };
  }
  const query = toQuery({
    title_id: params.title_id,
    episode_id: params.episode_id,
  });
  return apiRequest<ChatHistoryClearResponse>(`/api/qa/history${query}`, {
    method: "DELETE",
  });
}

export async function listEpisodeSubtitles(episodeId: UUID): Promise<SubtitleLine[]> {
  if (USE_MOCK_DATA) {
    return [];
  }
  const response = await apiRequest<EpisodeSubtitlesResponse>(`/api/episodes/${episodeId}/subtitles`);
  return response.items;
}

export async function warmupEpisodeCache(episodeId: UUID): Promise<void> {
  if (USE_MOCK_DATA) return;
  await apiRequest<{ episode_id: UUID; cached_chunks: number }>(
    `/api/episodes/${episodeId}/cache/warmup`,
    { method: "POST" },
  );
}

export async function ingestTitle(payload: TitleCreatePayload): Promise<Title> {
  return apiRequest<Title>("/api/ingest/titles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function ingestEpisode(payload: EpisodeCreatePayload): Promise<Episode> {
  return apiRequest<Episode>("/api/ingest/episodes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function ingestSubtitleLinesBulk(
  payload: SubtitleLineBulkPayload,
): Promise<IngestSubtitleLinesResponse> {
  return apiRequest<IngestSubtitleLinesResponse>("/api/ingest/subtitle-lines:bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteEpisodeSubtitleLines(episodeId: UUID): Promise<IngestSubtitleLinesResponse> {
  return apiRequest<IngestSubtitleLinesResponse>(`/api/ingest/episodes/${episodeId}/subtitle-lines`, {
    method: "DELETE",
  });
}

export async function issueVideoUploadSignature(
  payload: VideoUploadSignatureRequest,
): Promise<VideoUploadSignatureResponse> {
  return apiRequest<VideoUploadSignatureResponse>("/api/ingest/video-upload-signature", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEpisodeVideoUrl(params: {
  episode_id: UUID;
  video_url: string;
}): Promise<Episode> {
  return apiRequest<Episode>(`/api/ingest/episodes/${params.episode_id}/video-url`, {
    method: "PATCH",
    body: JSON.stringify({ video_url: params.video_url }),
  });
}

export async function deleteEpisodeVideoUrl(episodeId: UUID): Promise<Episode> {
  return apiRequest<Episode>(`/api/ingest/episodes/${episodeId}/video-url`, {
    method: "DELETE",
  });
}

export async function issueTitleImageUploadSignature(
  payload: ImageUploadSignatureRequest,
): Promise<ImageUploadSignatureResponse> {
  return apiRequest<ImageUploadSignatureResponse>("/api/ingest/image-upload-signature", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTitleThumbnailUrl(params: {
  title_id: UUID;
  thumbnail_url: string;
}): Promise<Title> {
  return apiRequest<Title>(`/api/ingest/titles/${params.title_id}/thumbnail-url`, {
    method: "PATCH",
    body: JSON.stringify({ thumbnail_url: params.thumbnail_url }),
  });
}

export async function deleteTitleThumbnailUrl(titleId: UUID): Promise<Title> {
  return apiRequest<Title>(`/api/ingest/titles/${titleId}/thumbnail-url`, {
    method: "DELETE",
  });
}
