export type UUID = string;

export type Title = {
  id: UUID;
  name: string;
  description: string;
};

export type Episode = {
  id: UUID;
  title_id: UUID;
  season: number;
  episode_number: number;
  name: string;
  duration_ms: number;
};

export type Character = {
  id: UUID;
  title_id: UUID;
  canonical_name: string;
  description?: string;
  aliases: string[];
};

export type EvidenceLine = {
  subtitle_line_id: UUID;
  start_ms: number;
  end_ms: number;
  speaker_text?: string;
  text: string;
};

export type Evidence = {
  evidence_id: UUID;
  representative_time_ms: number;
  summary: string;
  lines: EvidenceLine[];
};

export type RelationType =
  | "FAMILY"
  | "ROMANCE"
  | "ALLY"
  | "MISTRUST"
  | "BOSS_SUBORDINATE"
  | "FRIEND"
  | "RIVAL"
  | "UNKNOWN";

export type GraphNode = {
  id: UUID;
  label: string;
  description?: string;
  aliases: string[];
};

export type GraphEdge = {
  id: UUID;
  from_character_id: UUID;
  to_character_id: UUID;
  relation_type: RelationType;
  is_hypothesis: boolean;
  confidence: number;
  valid_from_time_ms: number;
  valid_to_time_ms: number | null;
  evidences: Evidence[];
};

export type GraphResponse = {
  meta: {
    title_id: UUID;
    episode_id: UUID;
    current_time_ms: number;
    spoiler_guard_applied: boolean;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: Array<{ code: string; message: string }>;
};

export type RecapPreset = "TWENTY_SEC" | "ONE_MIN" | "THREE_MIN";
export type RecapMode = "GENERAL" | "CHARACTER_FOCUSED" | "CONFLICT_FOCUSED";

export type RecapRequest = {
  title_id: UUID;
  episode_id: UUID;
  current_time_ms: number;
  preset: RecapPreset;
  mode?: RecapMode;
};

export type RecapResponse = {
  meta: {
    title_id: UUID;
    episode_id: UUID;
    current_time_ms: number;
    spoiler_guard_applied: boolean;
    model: string;
  };
  recap: { text: string; bullets: string[] };
  watch_points: string[];
  evidences: Evidence[];
  warnings: Array<{ code: string; message: string }>;
};

export type QARequest = {
  title_id: UUID;
  episode_id: UUID;
  current_time_ms: number;
  question: string;
  focus?: {
    character_ids?: UUID[];
    relation_id?: UUID | null;
  };
};

export type Interpretation = {
  label: string;
  text: string;
  confidence: number;
};

export type QAResponse = {
  meta: {
    title_id: UUID;
    episode_id: UUID;
    current_time_ms: number;
    spoiler_guard_applied: boolean;
    model: string;
  };
  answer: {
    conclusion: string;
    context: string[];
    interpretations: Interpretation[];
    overall_confidence: number;
  };
  evidences: Evidence[];
  related_graph_focus: {
    relation_id: UUID | null;
    highlight: { type: "RELATION" | "CHARACTER"; ids: UUID[] } | null;
  } | null;
  warnings: Array<{ code: string; message: string }>;
};

export type CharacterCardResponse = {
  meta: {
    character_id: UUID;
    episode_id: UUID;
    current_time_ms: number;
    spoiler_guard_applied: boolean;
  };
  character: Character;
  summary: {
    text: string;
    key_events: string[];
  };
  evidences: Evidence[];
  warnings: Array<{ code: string; message: string }>;
};

