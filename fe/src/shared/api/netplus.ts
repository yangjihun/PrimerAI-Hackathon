import type {
  UUID,
  Title,
  Episode,
  Character,
  GraphEdge,
  GraphResponse,
  RecapRequest,
  RecapResponse,
  QARequest,
  QAResponse,
  CharacterCardResponse,
} from "../types/netplus";

const titles: Title[] = [
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    name: "Demo Thriller A",
    description: "도시 연쇄 사건 속에서 엇갈리는 신뢰와 의심",
  },
  {
    id: "4fa85f64-5717-4562-b3fc-2c963f66afa7",
    name: "미스터리 연대기",
    description: "과거와 현재를 오가는 추리 스릴러",
  },
  {
    id: "5fa85f64-5717-4562-b3fc-2c963f66afa8",
    name: "도시의 그림자",
    description: "복잡한 인간관계와 배신의 드라마",
  },
  {
    id: "6fa85f64-5717-4562-b3fc-2c963f66afa9",
    name: "추적자들",
    description: "형사와 범인의 치열한 두뇌 게임",
  },
  {
    id: "7fa85f64-5717-4562-b3fc-2c963f66afaa",
    name: "잃어버린 기억",
    description: "기억을 찾아가는 미스터리 로맨스",
  },
  {
    id: "8fa85f64-5717-4562-b3fc-2c963f66afab",
    name: "비밀의 문",
    description: "가족의 비밀을 파헤치는 서스펜스",
  },
];

const episodes: Episode[] = [
  {
    id: "b1b2b3b4-1111-2222-3333-444455556666",
    title_id: titles[0].id,
    season: 1,
    episode_number: 1,
    name: "의심의 시작",
    duration_ms: 3_600_000,
  },
  {
    id: "b2b2b3b4-1111-2222-3333-444455556667",
    title_id: titles[1].id,
    season: 1,
    episode_number: 1,
    name: "첫 번째 단서",
    duration_ms: 3_600_000,
  },
  {
    id: "b3b2b3b4-1111-2222-3333-444455556668",
    title_id: titles[2].id,
    season: 1,
    episode_number: 1,
    name: "그림자의 시작",
    duration_ms: 3_600_000,
  },
  {
    id: "b4b2b3b4-1111-2222-3333-444455556669",
    title_id: titles[3].id,
    season: 1,
    episode_number: 1,
    name: "추적의 시작",
    duration_ms: 3_600_000,
  },
  {
    id: "b5b2b3b4-1111-2222-3333-44445555666a",
    title_id: titles[4].id,
    season: 1,
    episode_number: 1,
    name: "기억의 조각",
    duration_ms: 3_600_000,
  },
  {
    id: "b6b2b3b4-1111-2222-3333-44445555666b",
    title_id: titles[5].id,
    season: 1,
    episode_number: 1,
    name: "비밀의 시작",
    duration_ms: 3_600_000,
  },
];

const characters: Character[] = [
  {
    id: "c1111111-2222-3333-4444-555566667777",
    title_id: titles[0].id,
    canonical_name: "A",
    description: "주인공 형사. 빠르게 결론을 내리는 성향.",
    aliases: ["형사 A", "A 선배"],
  },
  {
    id: "c8888888-9999-aaaa-bbbb-ccccdddd0000",
    title_id: titles[0].id,
    canonical_name: "B",
    description: "참고인. 진술이 자주 바뀌어 의심받음.",
    aliases: ["참고인 B"],
  },
  {
    id: "c9999999-0000-1111-2222-333344445555",
    title_id: titles[0].id,
    canonical_name: "C",
    description: "중재자 역할. 사실 확인을 중시함.",
    aliases: ["팀장 C"],
  },
  {
    id: "c2222222-3333-4444-5555-666677778888",
    title_id: titles[0].id,
    canonical_name: "D",
    description: "A의 동료 형사. 신중한 성격.",
    aliases: ["D 형사"],
  },
  {
    id: "c3333333-4444-5555-6666-777788889999",
    title_id: titles[0].id,
    canonical_name: "E",
    description: "B의 변호사. 논리적 접근을 선호.",
    aliases: ["변호사 E"],
  },
  {
    id: "c4444444-5555-6666-7777-888899990000",
    title_id: titles[0].id,
    canonical_name: "F",
    description: "사건의 핵심 인물. 과거가 수상함.",
    aliases: ["F"],
  },
];

const relationEdges: GraphEdge[] = [
  {
    id: "r0000001-2222-3333-4444-555566667777",
    from_character_id: characters[0].id,
    to_character_id: characters[1].id,
    relation_type: "MISTRUST",
    is_hypothesis: false,
    confidence: 0.72,
    valid_from_time_ms: 590_000,
    valid_to_time_ms: null,
    evidences: [
      {
        evidence_id: "e1111111-2222-3333-4444-555566667777",
        representative_time_ms: 602_000,
        summary: "A가 B를 의심하게 된 직접 발언",
        lines: [
          {
            subtitle_line_id: "s1111111-aaaa-bbbb-cccc-222233334444",
            start_ms: 601_500,
            end_ms: 603_000,
            speaker_text: "A",
            text: "너, 그때 거기 없었잖아.",
          },
        ],
      },
    ],
  },
  {
    id: "r0000002-2222-3333-4444-555566667777",
    from_character_id: characters[2].id,
    to_character_id: characters[0].id,
    relation_type: "ALLY",
    is_hypothesis: true,
    confidence: 0.49,
    valid_from_time_ms: 430_000,
    valid_to_time_ms: null,
    evidences: [
      {
        evidence_id: "e2222222-2222-3333-4444-555566667777",
        representative_time_ms: 441_000,
        summary: "C가 A에게 증거 중심 접근을 제안",
        lines: [
          {
            subtitle_line_id: "s2222222-aaaa-bbbb-cccc-222233334444",
            start_ms: 440_600,
            end_ms: 442_000,
            speaker_text: "C",
            text: "감정 말고 증거로 가자.",
          },
        ],
      },
    ],
  },
  {
    id: "r0000003-2222-3333-4444-555566667777",
    from_character_id: characters[0].id,
    to_character_id: characters[3].id,
    relation_type: "FRIEND",
    is_hypothesis: false,
    confidence: 0.85,
    valid_from_time_ms: 120_000,
    valid_to_time_ms: null,
    evidences: [
      {
        evidence_id: "e3333333-2222-3333-4444-555566667777",
        representative_time_ms: 125_000,
        summary: "A와 D의 친밀한 대화",
        lines: [
          {
            subtitle_line_id: "s3333333-aaaa-bbbb-cccc-222233334444",
            start_ms: 124_000,
            end_ms: 126_000,
            speaker_text: "A",
            text: "D야, 이번엔 정말 다를 것 같아.",
          },
        ],
      },
    ],
  },
  {
    id: "r0000004-2222-3333-4444-555566667777",
    from_character_id: characters[1].id,
    to_character_id: characters[4].id,
    relation_type: "BOSS_SUBORDINATE",
    is_hypothesis: false,
    confidence: 0.78,
    valid_from_time_ms: 200_000,
    valid_to_time_ms: null,
    evidences: [
      {
        evidence_id: "e4444444-2222-3333-4444-555566667777",
        representative_time_ms: 205_000,
        summary: "E가 B의 변호사임을 확인",
        lines: [
          {
            subtitle_line_id: "s4444444-aaaa-bbbb-cccc-222233334444",
            start_ms: 204_000,
            end_ms: 206_000,
            speaker_text: "E",
            text: "제가 당신의 변호사입니다.",
          },
        ],
      },
    ],
  },
  {
    id: "r0000005-2222-3333-4444-555566667777",
    from_character_id: characters[2].id,
    to_character_id: characters[1].id,
    relation_type: "MISTRUST",
    is_hypothesis: true,
    confidence: 0.55,
    valid_from_time_ms: 500_000,
    valid_to_time_ms: null,
    evidences: [
      {
        evidence_id: "e5555555-2222-3333-4444-555566667777",
        representative_time_ms: 510_000,
        summary: "C가 B의 진술에 의문 제기",
        lines: [
          {
            subtitle_line_id: "s5555555-aaaa-bbbb-cccc-222233334444",
            start_ms: 509_000,
            end_ms: 511_000,
            speaker_text: "C",
            text: "그 말이 맞는지 확인이 필요해.",
          },
        ],
      },
    ],
  },
  {
    id: "r0000006-2222-3333-4444-555566667777",
    from_character_id: characters[5].id,
    to_character_id: characters[1].id,
    relation_type: "UNKNOWN",
    is_hypothesis: true,
    confidence: 0.42,
    valid_from_time_ms: 300_000,
    valid_to_time_ms: null,
    evidences: [
      {
        evidence_id: "e6666666-2222-3333-4444-555566667777",
        representative_time_ms: 305_000,
        summary: "F와 B의 모호한 관계 암시",
        lines: [
          {
            subtitle_line_id: "s6666666-aaaa-bbbb-cccc-222233334444",
            start_ms: 304_000,
            end_ms: 306_000,
            speaker_text: "B",
            text: "F... 그 사람은...",
          },
        ],
      },
    ],
  },
];

const relationLabel: Record<GraphEdge["relation_type"], string> = {
  FAMILY: "가족",
  ROMANCE: "연인",
  ALLY: "동맹",
  MISTRUST: "불신",
  BOSS_SUBORDINATE: "상사-부하",
  FRIEND: "친구",
  RIVAL: "라이벌",
  UNKNOWN: "미확인",
};

const sleep = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));

export async function listTitles(): Promise<Title[]> {
  await sleep();
  return titles;
}

export async function listEpisodes(titleId: UUID): Promise<Episode[]> {
  await sleep();
  return episodes.filter((episode) => episode.title_id === titleId);
}

export async function getGraph(params: {
  title_id: UUID;
  episode_id: UUID;
  current_time_ms: number;
}): Promise<GraphResponse> {
  await sleep();
  const allowedEdges = relationEdges.filter(
    (edge) => edge.valid_from_time_ms <= params.current_time_ms
  );
  const allowedCharacterIds = new Set(
    allowedEdges.flatMap((edge) => [edge.from_character_id, edge.to_character_id])
  );

  return {
    meta: {
      ...params,
      spoiler_guard_applied: true,
    },
    nodes: characters
      .filter((character) => allowedCharacterIds.has(character.id))
      .map((character) => ({
        id: character.id,
        label: character.canonical_name,
        description: character.description,
        aliases: character.aliases,
      })),
    edges: allowedEdges,
    warnings: [],
  };
}

export async function createRecap(params: RecapRequest): Promise<RecapResponse> {
  await sleep(320);
  const graph = await getGraph({
    title_id: params.title_id,
    episode_id: params.episode_id,
    current_time_ms: params.current_time_ms,
  });
  const evidences = graph.edges.flatMap((edge) => edge.evidences).slice(0, 2);

  const textByPreset = {
    TWENTY_SEC:
      "A는 B의 진술 모순을 포착했고, C는 감정보다 증거를 보자며 중재 중이야.",
    ONE_MIN:
      "현재까지 핵심은 A의 의심이 단순 감정이 아니라 B의 진술 불일치에서 시작됐다는 점이야. C는 둘 사이를 중재하며 사건을 감정전이 아닌 증거 중심으로 끌고 가려 해. 그래서 지금 장면은 '누가 맞는가'보다 '누가 증거를 먼저 제시하느냐'의 싸움으로 넘어가고 있어.",
    THREE_MIN:
      "초반에는 A와 B의 대화가 단순 신경전처럼 보였지만, 10분대 이후 B의 알리바이가 반복해서 흔들리며 긴장이 올라가. A는 이를 배신 신호로 해석하고, C는 단정하지 말고 확인 가능한 사실부터 쌓자고 제동을 걸어. 이 구간의 포인트는 불신이 사실인지, 혹은 B가 다른 이유로 침묵하는지의 갈림길이 만들어졌다는 점이야.",
  };

  const bullets = [
    "A가 B의 알리바이에 공개적으로 의문 제기",
    "C가 감정 대립을 멈추고 증거 검증 제안",
    "관계도가 '동맹/불신' 축으로 재편되기 시작",
  ];

  return {
    meta: {
      ...params,
      spoiler_guard_applied: true,
      model: "mock-gpt-netplus",
    },
    recap: {
      text: textByPreset[params.preset],
      bullets: params.preset === "TWENTY_SEC" ? bullets.slice(0, 2) : bullets,
    },
    watch_points: [
      "B가 숨기는 정보의 정체",
      "C가 어느 시점에 누구 편으로 기울지",
      "A의 의심이 증거로 확정되는지 여부",
    ],
    evidences,
    warnings:
      evidences.length === 0
        ? [
            {
              code: "EVIDENCE_INSUFFICIENT",
              message: "현재 시점 근거가 부족해 요약 정확도가 낮을 수 있어요.",
            },
          ]
        : [],
  };
}

export async function askQuestion(params: QARequest): Promise<QAResponse> {
  await sleep(340);
  const graph = await getGraph({
    title_id: params.title_id,
    episode_id: params.episode_id,
    current_time_ms: params.current_time_ms,
  });
  const target = graph.edges.find((edge) => edge.relation_type === "MISTRUST");

  if (!target) {
    return {
      meta: {
        title_id: params.title_id,
        episode_id: params.episode_id,
        current_time_ms: params.current_time_ms,
        spoiler_guard_applied: true,
        model: "mock-gpt-netplus",
      },
      answer: {
        conclusion: "현재 시점 기준으로는 확실한 근거가 부족해서 단정하기 어려워.",
        context: ["관계 단서를 찾았지만 직접적인 동기 설명은 아직 부족해."],
        interpretations: [
          {
            label: "A",
            text: "감정적 반응으로 의심이 확대되었을 가능성",
            confidence: 0.33,
          },
          {
            label: "B",
            text: "배경 사건이 아직 공개되지 않았을 가능성",
            confidence: 0.27,
          },
        ],
        overall_confidence: 0.3,
      },
      evidences: [],
      related_graph_focus: null,
      warnings: [
        {
          code: "EVIDENCE_INSUFFICIENT",
          message: "현재 시점까지의 자막에서 직접 근거를 찾지 못했어요.",
        },
      ],
    };
  }

  const mentionsMistrust =
    params.question.includes("의심") ||
    params.question.includes("왜") ||
    params.question.toLowerCase().includes("why");

  const conclusion = mentionsMistrust
    ? "A는 B의 진술이 앞뒤가 맞지 않는다고 느껴 의심하고 있어."
    : "현재 장면의 핵심은 인물 간 신뢰가 깨지는 흐름이야.";

  return {
    meta: {
      title_id: params.title_id,
      episode_id: params.episode_id,
      current_time_ms: params.current_time_ms,
      spoiler_guard_applied: true,
      model: "mock-gpt-netplus",
    },
    answer: {
      conclusion,
      context: [
        "직전에 B가 자신의 위치를 설명했지만 이전 발언과 충돌하는 부분이 있었어.",
        "A는 그 모순을 근거로 감정이 아니라 사실 검증 문제로 밀어붙이는 중이야.",
      ],
      interpretations: [
        {
          label: "A",
          text: "B가 실제로 일부 사실을 숨기고 있어 의심이 타당할 가능성",
          confidence: 0.68,
        },
        {
          label: "B",
          text: "B에게 공개하지 못할 사정이 있어 오해가 커졌을 가능성",
          confidence: 0.42,
        },
      ],
      overall_confidence: 0.62,
    },
    evidences: target.evidences,
    related_graph_focus: {
      relation_id: target.id,
      highlight: {
        type: "RELATION",
        ids: [target.id],
      },
    },
    warnings: [],
  };
}

export async function getCharacterCard(params: {
  character_id: UUID;
  episode_id: UUID;
  current_time_ms: number;
}): Promise<CharacterCardResponse> {
  await sleep();
  const character = characters.find((item) => item.id === params.character_id);
  if (!character) {
    throw new Error("Character not found");
  }

  const evidences = relationEdges
    .filter(
      (edge) =>
        edge.valid_from_time_ms <= params.current_time_ms &&
        (edge.from_character_id === params.character_id ||
          edge.to_character_id === params.character_id)
    )
    .flatMap((edge) => edge.evidences)
    .slice(0, 2);

  const relatedEdge = relationEdges.find(
    (edge) =>
      edge.valid_from_time_ms <= params.current_time_ms &&
      (edge.from_character_id === params.character_id ||
        edge.to_character_id === params.character_id)
  );

  return {
    meta: {
      character_id: params.character_id,
      episode_id: params.episode_id,
      current_time_ms: params.current_time_ms,
      spoiler_guard_applied: true,
    },
    character,
    summary: {
      text: `${character.canonical_name}는 현재까지 ${character.description ?? "핵심 인물"} 역할로 전개를 이끌고 있어.`,
      key_events: relatedEdge
        ? [
            `${relationLabel[relatedEdge.relation_type]} 관계 축에서 중심 역할`,
            "최근 장면에서 갈등 전환점에 관여",
          ]
        : ["주요 인물로 등장"],
    },
    evidences,
    warnings: [],
  };
}

