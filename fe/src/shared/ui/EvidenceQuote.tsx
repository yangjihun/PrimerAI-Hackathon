import type { Evidence } from "../types/netplus";
import { msToClock } from "../lib/utils";

interface EvidenceQuoteProps {
  evidence: Evidence;
  className?: string;
}

export function EvidenceQuote({ evidence, className }: EvidenceQuoteProps) {
  return (
    <div className={`evidence-quote ${className || ""}`}>
      {evidence.summary && (
        <div className="evidence-summary">{evidence.summary}</div>
      )}
      <div className="evidence-lines">
        {evidence.lines.map((line) => (
          <div key={line.subtitle_line_id} className="evidence-line">
            <div className="evidence-meta">
              <span className="evidence-time">{msToClock(line.start_ms)}</span>
              {line.speaker_text && (
                <span className="evidence-speaker">{line.speaker_text}</span>
              )}
            </div>
            <blockquote className="evidence-text">{line.text}</blockquote>
          </div>
        ))}
      </div>
    </div>
  );
}

