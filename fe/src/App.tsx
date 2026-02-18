import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  askQuestion,
  createRecap,
  getCharacterCard,
  getGraph,
  listEpisodes,
  listTitles,
  type Episode,
  type GraphEdge,
  type Title,
  type UUID,
} from "./mockApi";

type RecapPreset = "TWENTY_SEC" | "ONE_MIN" | "THREE_MIN";

function toClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const min = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const sec = (totalSeconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function confidenceTag(confidence: number) {
  if (confidence >= 0.7) {
    return "높음";
  }
  if (confidence >= 0.45) {
    return "중간";
  }
  return "낮음";
}

function App() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<UUID>("");
  const [selectedEpisode, setSelectedEpisode] = useState<UUID>("");
  const [currentTimeMs, setCurrentTimeMs] = useState(615000);

  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [graphNodeMap, setGraphNodeMap] = useState<Record<string, string>>({});
  const [activeEdgeId, setActiveEdgeId] = useState<UUID | null>(null);
  const [activeCharacterId, setActiveCharacterId] = useState<UUID | null>(null);
  const [characterSummary, setCharacterSummary] = useState<string>("");

  const [recapPreset, setRecapPreset] = useState<RecapPreset>("ONE_MIN");
  const [recapData, setRecapData] = useState<Awaited<ReturnType<typeof createRecap>> | null>(null);
  const [question, setQuestion] = useState("A가 왜 B를 의심해?");
  const [qaData, setQaData] = useState<Awaited<ReturnType<typeof askQuestion>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function boot() {
      const titleRows = await listTitles();
      setTitles(titleRows);
      if (titleRows[0]) {
        setSelectedTitle(titleRows[0].id);
      }
    }
    void boot();
  }, []);

  useEffect(() => {
    async function loadEpisodes() {
      if (!selectedTitle) {
        return;
      }
      const episodeRows = await listEpisodes(selectedTitle);
      setEpisodes(episodeRows);
      if (episodeRows[0]) {
        setSelectedEpisode(episodeRows[0].id);
      }
    }
    void loadEpisodes();
  }, [selectedTitle]);

  useEffect(() => {
    async function loadGraph() {
      if (!selectedTitle || !selectedEpisode) {
        return;
      }
      const response = await getGraph({
        title_id: selectedTitle,
        episode_id: selectedEpisode,
        current_time_ms: currentTimeMs,
      });
      setGraphEdges(response.edges);
      setGraphNodeMap(
        response.nodes.reduce<Record<string, string>>((acc, node) => {
          acc[node.id] = node.label;
          return acc;
        }, {})
      );
      if (response.edges.length > 0) {
        setActiveEdgeId(response.edges[0].id);
      } else {
        setActiveEdgeId(null);
      }
    }
    void loadGraph();
  }, [selectedTitle, selectedEpisode, currentTimeMs]);

  const selectedEpisodeInfo = useMemo(
    () => episodes.find((episode) => episode.id === selectedEpisode),
    [episodes, selectedEpisode]
  );

  const graphNodes = useMemo(() => {
    const map = new Map<UUID, string>();
    graphEdges.forEach((edge) => {
      map.set(edge.from_character_id, edge.from_character_id);
      map.set(edge.to_character_id, edge.to_character_id);
    });
    return [...map.keys()];
  }, [graphEdges]);

  const activeEdge = graphEdges.find((edge) => edge.id === activeEdgeId) ?? null;

  async function handleRecap() {
    if (!selectedTitle || !selectedEpisode) {
      return;
    }
    setLoading(true);
    const response = await createRecap({
      title_id: selectedTitle,
      episode_id: selectedEpisode,
      current_time_ms: currentTimeMs,
      preset: recapPreset,
      mode: "CONFLICT_FOCUSED",
    });
    setRecapData(response);
    setLoading(false);
  }

  async function handleAsk(event: FormEvent) {
    event.preventDefault();
    if (!selectedTitle || !selectedEpisode || !question.trim()) {
      return;
    }
    setLoading(true);
    const response = await askQuestion({
      title_id: selectedTitle,
      episode_id: selectedEpisode,
      current_time_ms: currentTimeMs,
      question,
    });
    setQaData(response);
    if (response.related_graph_focus?.relation_id) {
      setActiveEdgeId(response.related_graph_focus.relation_id);
    }
    setLoading(false);
  }

  async function handleCharacterSelect(characterId: UUID) {
    if (!selectedEpisode) {
      return;
    }
    setActiveCharacterId(characterId);
    const card = await getCharacterCard({
      character_id: characterId,
      episode_id: selectedEpisode,
      current_time_ms: currentTimeMs,
    });
    setCharacterSummary(card.summary.text);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="logo">NETPLUS</div>
        <div className="topbar-info">
          <span className="pill">MVP</span>
          <span className="guard">Spoiler Guard ON</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="eyebrow">오늘의 이어보기</p>
          <h1>함께 보는 친구로 맥락 복구</h1>
          <p>
            되감기 없이 이전 전개를 복원하고, 관계도와 근거 대사로 지금 장면을 바로 이해합니다.
          </p>
        </div>
      </section>

      <section className="controls">
        <label>
          작품
          <select value={selectedTitle} onChange={(event) => setSelectedTitle(event.target.value)}>
            {titles.map((title) => (
              <option key={title.id} value={title.id}>
                {title.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          회차
          <select value={selectedEpisode} onChange={(event) => setSelectedEpisode(event.target.value)}>
            {episodes.map((episode) => (
              <option key={episode.id} value={episode.id}>
                S{episode.season}E{episode.episode_number} {episode.name}
              </option>
            ))}
          </select>
        </label>
        <label className="timeline">
          현재 시점 {toClock(currentTimeMs)}
          <input
            type="range"
            min={0}
            max={selectedEpisodeInfo?.duration_ms ?? 3_600_000}
            step={5000}
            value={currentTimeMs}
            onChange={(event) => setCurrentTimeMs(Number(event.target.value))}
          />
        </label>
      </section>

      <main className="dashboard">
        <section className="panel companion">
          <h2>Companion Chat</h2>
          <div className="button-row">
            <button
              type="button"
              className={recapPreset === "TWENTY_SEC" ? "active" : ""}
              onClick={() => setRecapPreset("TWENTY_SEC")}
            >
              20초 요약
            </button>
            <button
              type="button"
              className={recapPreset === "ONE_MIN" ? "active" : ""}
              onClick={() => setRecapPreset("ONE_MIN")}
            >
              1분 요약
            </button>
            <button
              type="button"
              className={recapPreset === "THREE_MIN" ? "active" : ""}
              onClick={() => setRecapPreset("THREE_MIN")}
            >
              3분 요약
            </button>
            <button type="button" onClick={handleRecap}>
              리캡 생성
            </button>
          </div>

          {recapData && (
            <article className="card">
              <h3>요약</h3>
              <p>{recapData.recap.text}</p>
              <ul>
                {recapData.recap.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <h4>관전 포인트</h4>
              <ul>
                {recapData.watch_points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          )}

          <form className="qa-form" onSubmit={handleAsk}>
            <h3>질문하기</h3>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button type="submit">질문 전송</button>
          </form>

          {qaData && (
            <article className="card qa">
              <h3>답변</h3>
              <p className="conclusion">{qaData.answer.conclusion}</p>
              <ul>
                {qaData.answer.context.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="interpretations">
                {qaData.answer.interpretations.map((item) => (
                  <div key={item.label}>
                    <strong>{item.label}</strong> {item.text} ({item.confidence.toFixed(2)})
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>

        <section className="panel graph">
          <h2>관계도 Graph</h2>
          <div className="node-row">
            {graphNodes.map((nodeId) => (
              <button
                key={nodeId}
                type="button"
                className={nodeId === activeCharacterId ? "node active" : "node"}
                onClick={() => void handleCharacterSelect(nodeId)}
              >
                {graphNodeMap[nodeId] ?? nodeId.slice(0, 4)}
              </button>
            ))}
          </div>

          {characterSummary && (
            <article className="card">
              <h3>인물 요약</h3>
              <p>{characterSummary}</p>
            </article>
          )}

          <div className="edge-list">
            {graphEdges.map((edge) => (
              <article
                key={edge.id}
                className={edge.id === activeEdgeId ? "edge-card active" : "edge-card"}
                onClick={() => setActiveEdgeId(edge.id)}
              >
                <p>
                  {graphNodeMap[edge.from_character_id] ?? edge.from_character_id.slice(0, 4)} →{" "}
                  {graphNodeMap[edge.to_character_id] ?? edge.to_character_id.slice(0, 4)} /{" "}
                  {edge.relation_type}
                </p>
                <p>
                  신뢰도 {edge.confidence.toFixed(2)} ({confidenceTag(edge.confidence)})
                </p>
                <progress max={1} value={edge.confidence} />
              </article>
            ))}
          </div>

          {activeEdge && (
            <article className="card">
              <h3>근거 Evidence</h3>
              {activeEdge.evidences.map((evidence) => (
                <div key={evidence.evidence_id} className="evidence">
                  <strong>{evidence.summary}</strong>
                  <p>{toClock(evidence.representative_time_ms)}</p>
                  {evidence.lines.map((line) => (
                    <blockquote key={line.subtitle_line_id}>
                      [{toClock(line.start_ms)}] {line.speaker_text}: {line.text}
                    </blockquote>
                  ))}
                </div>
              ))}
            </article>
          )}
        </section>
      </main>

      {loading && <div className="loading">동행 분석 중...</div>}
    </div>
  );
}

export default App;
