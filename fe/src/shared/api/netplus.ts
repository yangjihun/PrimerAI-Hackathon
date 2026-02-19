import type {
  CharacterCardResponse,
  Episode,
  GraphResponse,
  QARequest,
  QAResponse,
  RecapRequest,
  RecapResponse,
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

export async function getGraph(params: {
  title_id: UUID;
  episode_id: UUID;
  current_time_ms: number;
}): Promise<GraphResponse> {
  return withMockFallback(
    "getGraph",
    async () => {
      const query = toQuery({
        title_id: params.title_id,
        episode_id: params.episode_id,
        current_time_ms: params.current_time_ms,
      });
      return apiRequest<GraphResponse>(`/api/graph${query}`);
    },
    () => ({
      meta: {
        title_id: params.title_id,
        episode_id: params.episode_id,
        current_time_ms: params.current_time_ms,
        spoiler_guard_applied: true,
      },
      nodes: [
        { id: "char-a", label: "A", description: "Lead detective", aliases: ["Captain"] },
        { id: "char-b", label: "B", description: "Main suspect", aliases: ["Brother"] },
        { id: "char-c", label: "C", description: "Mediator", aliases: [] },
      ],
      edges: [
        {
          id: "edge-a-b",
          from_character_id: "char-a",
          to_character_id: "char-b",
          relation_type: "MISTRUST",
          is_hypothesis: false,
          confidence: 0.72,
          valid_from_time_ms: 30_000,
          valid_to_time_ms: null,
          evidences: [
            {
              evidence_id: "ev-1",
              representative_time_ms: 30_000,
              summary: "A questions B's statement.",
              lines: [
                {
                  subtitle_line_id: "line-1",
                  start_ms: 30_000,
                  end_ms: 33_000,
                  speaker_text: "A",
                  text: "You were not there at that time.",
                },
              ],
            },
          ],
        },
      ],
      warnings: [],
    }),
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

export async function getCharacterCard(params: {
  character_id: UUID;
  episode_id: UUID;
  current_time_ms: number;
}): Promise<CharacterCardResponse> {
  return withMockFallback(
    "getCharacterCard",
    async () => {
      const query = toQuery({
        episode_id: params.episode_id,
        current_time_ms: params.current_time_ms,
      });
      return apiRequest<CharacterCardResponse>(`/api/characters/${params.character_id}${query}`);
    },
    () => ({
      meta: {
        character_id: params.character_id,
        episode_id: params.episode_id,
        current_time_ms: params.current_time_ms,
        spoiler_guard_applied: true,
      },
      character: {
        id: params.character_id,
        title_id: "title-demo-1",
        canonical_name: params.character_id === "char-b" ? "B" : "A",
        description: "Mock character profile.",
        aliases: [],
      },
      summary: {
        text: "Mock character summary for frontend-only mode.",
        key_events: ["Appears in confrontation scene.", "Connected to the main conflict."],
      },
      evidences: [],
      warnings: [],
    }),
  );
}
