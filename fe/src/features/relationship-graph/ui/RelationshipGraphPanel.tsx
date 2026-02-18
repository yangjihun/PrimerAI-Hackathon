import { useEffect, useState } from "react";
import type { UUID, GraphResponse, GraphNode, GraphEdge } from "../../../shared/types/netplus";
import { getGraph, getCharacterCard } from "../../../shared/api/netplus";
import { EvidenceQuote } from "../../../shared/ui/EvidenceQuote";
import { Card } from "../../../shared/ui/Card";
import { relationTypeLabel, confidenceLabel } from "../../../shared/lib/utils";

interface RelationshipGraphPanelProps {
  titleId: UUID;
  episodeId: UUID;
  currentTimeMs: number;
}

export function RelationshipGraphPanel({
  titleId,
  episodeId,
  currentTimeMs,
}: RelationshipGraphPanelProps) {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [characterSummary, setCharacterSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadGraph() {
      setLoading(true);
      try {
        const data = await getGraph({
          title_id: titleId,
          episode_id: episodeId,
          current_time_ms: currentTimeMs,
        });
        setGraph(data);
      } catch (error) {
        console.error("Failed to load graph:", error);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, [titleId, episodeId, currentTimeMs]);

  const handleNodeClick = async (node: GraphNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    try {
      const card = await getCharacterCard({
        character_id: node.id,
        episode_id: episodeId,
        current_time_ms: currentTimeMs,
      });
      setCharacterSummary(card.summary.text);
    } catch (error) {
      console.error("Failed to load character card:", error);
    }
  };

  const handleEdgeClick = (edge: GraphEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  if (loading) {
    return <div className="graph-loading">관계도 로딩 중...</div>;
  }

  if (!graph) {
    return <div className="graph-empty">관계도 데이터가 없습니다.</div>;
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="relationship-graph-panel">
      <div className="graph-nodes">
        {graph.nodes.map((node) => (
          <button
            key={node.id}
            className={`graph-node ${selectedNode?.id === node.id ? "active" : ""}`}
            onClick={() => handleNodeClick(node)}
          >
            {node.label}
          </button>
        ))}
      </div>

      {selectedNode && (
        <Card className="character-card">
          <h3>{selectedNode.label}</h3>
          {selectedNode.description && <p>{selectedNode.description}</p>}
          {characterSummary && <p className="character-summary">{characterSummary}</p>}
        </Card>
      )}

      <div className="graph-edges">
        <h3>관계 목록</h3>
        {graph.edges.map((edge) => {
          const fromNode = nodeMap.get(edge.from_character_id);
          const toNode = nodeMap.get(edge.to_character_id);
          return (
            <Card
              key={edge.id}
              className={`edge-card ${selectedEdge?.id === edge.id ? "active" : ""}`}
            >
              <div
                className="edge-header"
                onClick={() => handleEdgeClick(edge)}
                style={{ cursor: "pointer" }}
              >
                <div className="edge-relation">
                  <span className="edge-from">{fromNode?.label || "?"}</span>
                  <span className="edge-arrow">→</span>
                  <span className="edge-to">{toNode?.label || "?"}</span>
                </div>
                <div className="edge-meta">
                  <span className="edge-type">{relationTypeLabel(edge.relation_type)}</span>
                  {edge.is_hypothesis && <span className="edge-hypothesis">(추정)</span>}
                  <span className="edge-confidence">
                    신뢰도: {confidenceLabel(edge.confidence)} ({(edge.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
              {selectedEdge?.id === edge.id && (
                <div className="edge-details">
                  {edge.evidences.map((evidence) => (
                    <EvidenceQuote key={evidence.evidence_id} evidence={evidence} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

