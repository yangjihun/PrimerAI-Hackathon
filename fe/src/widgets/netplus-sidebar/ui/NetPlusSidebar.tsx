import { useState } from "react";
import type { UUID } from "../../../shared/types/netplus";
import { CompanionChatPanel } from "../../../features/companion-chat/ui/CompanionChatPanel";
import { RecapPanel } from "../../../features/recap/ui/RecapPanel";
import { msToClock } from "../../../shared/lib/utils";

interface NetPlusSidebarProps {
  titleId: UUID;
  episodeId: UUID;
  currentTimeMs: number;
  episodeName?: string;
  isOpen: boolean;
  onToggle: () => void;
  variant?: "overlay" | "inline";
}

type TabType = "chat" | "recap";

export function NetPlusSidebar({
  titleId,
  episodeId,
  currentTimeMs,
  episodeName,
  isOpen,
  onToggle,
  variant = "overlay",
}: NetPlusSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const effectiveOpen = variant === "inline" ? true : isOpen;

  if (!effectiveOpen && variant === "overlay") {
    return (
      <button className="netplus-toggle-btn" onClick={onToggle} aria-label="NetPlus 열기">
        <span className="netplus-icon">NP</span>
      </button>
    );
  }

  return (
    <div
      className={`netplus-sidebar ${effectiveOpen ? "open" : ""} ${variant}`}
      data-open={effectiveOpen}
    >
      <div className="netplus-header">
        <div className="netplus-logo">
          <span className="netplus-logo-text">NetPlus</span>
          {episodeName && (
            <span className="netplus-episode-info">
              {episodeName} · {msToClock(currentTimeMs)}
            </span>
          )}
        </div>
        {variant === "overlay" && (
          <button className="netplus-close-btn" onClick={onToggle} aria-label="NetPlus 닫기">
            ×
          </button>
        )}
      </div>

      <div className="netplus-tabs">
        <button
          className={`netplus-tab ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          Net+ 챗봇
        </button>
        <button
          className={`netplus-tab ${activeTab === "recap" ? "active" : ""}`}
          onClick={() => setActiveTab("recap")}
        >
          내용 요약
        </button>
      </div>

      <div className="netplus-content">
        {activeTab === "chat" && (
          <CompanionChatPanel titleId={titleId} episodeId={episodeId} currentTimeMs={currentTimeMs} />
        )}
        {activeTab === "recap" && (
          <RecapPanel titleId={titleId} episodeId={episodeId} currentTimeMs={currentTimeMs} />
        )}
      </div>
    </div>
  );
}
