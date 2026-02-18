import { useState } from "react";
import type { UUID, RecapPreset, RecapMode, RecapResponse } from "../../../shared/types/netplus";
import { createRecap } from "../../../shared/api/netplus";
import { EvidenceQuote } from "../../../shared/ui/EvidenceQuote";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";

interface RecapPanelProps {
  titleId: UUID;
  episodeId: UUID;
  currentTimeMs: number;
}

export function RecapPanel({
  titleId,
  episodeId,
  currentTimeMs,
}: RecapPanelProps) {
  const [preset, setPreset] = useState<RecapPreset>("ONE_MIN");
  const [mode, setMode] = useState<RecapMode | undefined>("CONFLICT_FOCUSED");
  const [recap, setRecap] = useState<RecapResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await createRecap({
        title_id: titleId,
        episode_id: episodeId,
        current_time_ms: currentTimeMs,
        preset,
        mode,
      });
      setRecap(response);
    } catch (error) {
      console.error("Failed to generate recap:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recap-panel">
      <div className="recap-controls">
        <div className="preset-buttons">
          <Button
            variant={preset === "TWENTY_SEC" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setPreset("TWENTY_SEC")}
          >
            20초
          </Button>
          <Button
            variant={preset === "ONE_MIN" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setPreset("ONE_MIN")}
          >
            1분
          </Button>
          <Button
            variant={preset === "THREE_MIN" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setPreset("THREE_MIN")}
          >
            3분
          </Button>
        </div>
        <div className="mode-buttons">
          <Button
            variant={mode === "CHARACTER_FOCUSED" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setMode("CHARACTER_FOCUSED")}
          >
            인물 중심
          </Button>
          <Button
            variant={mode === "CONFLICT_FOCUSED" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setMode("CONFLICT_FOCUSED")}
          >
            갈등 중심
          </Button>
        </div>
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? "생성 중..." : "리캡 생성"}
        </Button>
      </div>

      {recap && (
        <div className="recap-content">
          <Card>
            <h3>요약</h3>
            <p className="recap-text">{recap.recap.text}</p>
            {recap.recap.bullets.length > 0 && (
              <ul className="recap-bullets">
                {recap.recap.bullets.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            )}
          </Card>

          {recap.watch_points.length > 0 && (
            <Card>
              <h3>관전 포인트</h3>
              <ul className="watch-points">
                {recap.watch_points.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </Card>
          )}

          {recap.evidences.length > 0 && (
            <Card>
              <h3>근거</h3>
              {recap.evidences.map((evidence) => (
                <EvidenceQuote key={evidence.evidence_id} evidence={evidence} />
              ))}
            </Card>
          )}

          {recap.warnings.length > 0 && (
            <div className="recap-warnings">
              {recap.warnings.map((warning, idx) => (
                <div key={idx} className="warning">
                  {warning.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

