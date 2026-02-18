import { useState } from "react";
import type { UUID } from "../../../shared/types/netplus";
import { CompanionChatPanel } from "../../../features/companion-chat/ui/CompanionChatPanel";
import { RelationshipGraphPanel } from "../../../features/relationship-graph/ui/RelationshipGraphPanel";
import { RecapPanel } from "../../../features/recap/ui/RecapPanel";
import { msToClock } from "../../../shared/lib/utils";

interface NetPlusSidebarProps {
  titleId: UUID;
  episodeId: UUID;
  currentTimeMs: number;
  episodeName?: string;
  isOpen: boolean;
  onToggle: () => void;
}

type TabType = "chat" | "graph" | "recap";

export function NetPlusSidebar({
  titleId,
  episodeId,
  currentTimeMs,
  episodeName,
  isOpen,
  onToggle,
}: NetPlusSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("chat");

  if (!isOpen) {
    return (
      <button className="netplus-toggle-btn" onClick={onToggle} aria-label="NetPlus 열기">
        <span className="netplus-icon">NP</span>
      </button>
    );
  }

  return (
    <div className={`netplus-sidebar ${isOpen ? "open" : ""}`} data-open={isOpen}>
      <div className="netplus-header">
        <div className="netplus-logo">
          <span className="netplus-logo-text">NetPlus</span>
          {episodeName && (
            <span className="netplus-episode-info">
              {episodeName} · {msToClock(currentTimeMs)}
            </span>
          )}
        </div>
        <button className="netplus-close-btn" onClick={onToggle} aria-label="NetPlus 닫기">
          ×
        </button>
      </div>

      <div className="netplus-tabs">
        <button
          className={`netplus-tab ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          함께 보는 친구
        </button>
        <button
          className={`netplus-tab ${activeTab === "graph" ? "active" : ""}`}
          onClick={() => setActiveTab("graph")}
        >
          관계도
        </button>
        <button
          className={`netplus-tab ${activeTab === "recap" ? "active" : ""}`}
          onClick={() => setActiveTab("recap")}
        >
          리캡
        </button>
      </div>

      <div className="netplus-content">
        {activeTab === "chat" && (
          <CompanionChatPanel
            titleId={titleId}
            episodeId={episodeId}
            currentTimeMs={currentTimeMs}
          />
        )}
        {activeTab === "graph" && (
          <RelationshipGraphPanel
            titleId={titleId}
            episodeId={episodeId}
            currentTimeMs={currentTimeMs}
          />
        )}
        {activeTab === "recap" && (
          <RecapPanel
            titleId={titleId}
            episodeId={episodeId}
            currentTimeMs={currentTimeMs}
          />
        )}
      </div>
    </div>
  );
}

