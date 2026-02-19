import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { UUID, Title, Episode } from "../../../shared/types/netplus";
import { listTitles, listEpisodes } from "../../../shared/api/netplus";
import { NetPlusSidebar } from "../../../widgets/netplus-sidebar/ui/NetPlusSidebar";
import { msToClock } from "../../../shared/lib/utils";
import {
  getCurrentPlan,
  getFreeSelectedTitleId,
  lockFreeTitleSelection,
} from "../../../shared/lib/subscription";

export function WatchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const titleIdParam = searchParams.get("titleId");
  const episodeIdParam = searchParams.get("episodeId");

  const [titles, setTitles] = useState<Title[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState<UUID>("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<UUID>("");
  const [currentTimeMs, setCurrentTimeMs] = useState(615_000);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [watchLimitMessage, setWatchLimitMessage] = useState("");

  useEffect(() => {
    async function loadTitles() {
      const data = await listTitles();
      setTitles(data);
      if (data.length > 0) {
        const requestedId =
          titleIdParam && data.some((title) => title.id === titleIdParam)
            ? titleIdParam
            : data[0].id;

        if (getCurrentPlan() === "free") {
          const alreadySelected = getFreeSelectedTitleId();
          if (alreadySelected && requestedId !== alreadySelected) {
            const targetId = data.some((title) => title.id === alreadySelected)
              ? alreadySelected
              : data[0].id;
            setWatchLimitMessage("무료 플랜은 선택한 1개 작품만 시청할 수 있어요.");
            setSelectedTitleId(targetId);
            navigate(`/watch?titleId=${targetId}`, { replace: true });
            return;
          }

          const selection = lockFreeTitleSelection(requestedId);
          if (selection.newlySelected) {
            setWatchLimitMessage("무료 플랜 작품이 선택되어 고정되었습니다.");
          } else {
            setWatchLimitMessage("");
          }
        }

        setSelectedTitleId(requestedId);
      }
    }
    loadTitles();
  }, [titleIdParam, navigate]);

  useEffect(() => {
    async function loadEpisodes() {
      if (!selectedTitleId) return;
      const data = await listEpisodes(selectedTitleId);
      setEpisodes(data);
      if (data.length > 0) {
        const targetId = episodeIdParam || data[0].id;
        setSelectedEpisodeId(targetId);
      }
    }
    loadEpisodes();
  }, [selectedTitleId, episodeIdParam]);

  const selectedEpisode = episodes.find((ep) => ep.id === selectedEpisodeId);

  return (
    <div className="watch-page">
      <div className="watch-back-section">
        <button className="watch-back-btn" onClick={() => navigate("/browse")}>
          ← 뒤로 가기
        </button>
      </div>
      <div className={`watch-main ${isSidebarOpen ? "sidebar-open" : ""}`} data-sidebar-open={isSidebarOpen}>
        <div className="watch-player-section">
          {watchLimitMessage && (
            <div className="watch-limit-banner">{watchLimitMessage}</div>
          )}
          <div className="watch-player-container">
            <div className="watch-player-placeholder">
              <div className="player-content">
                <div className="player-title">
                  {selectedEpisode
                    ? `S${selectedEpisode.season}E${selectedEpisode.episode_number} ${selectedEpisode.name}`
                    : "비디오 플레이어"}
                </div>
                <div className="player-time">
                  {msToClock(currentTimeMs)} / {selectedEpisode ? msToClock(selectedEpisode.duration_ms) : "00:00"}
                </div>
                <div className="player-controls">
                  <input
                    type="range"
                    min={0}
                    max={selectedEpisode?.duration_ms || 3_600_000}
                    value={currentTimeMs}
                    onChange={(e) => setCurrentTimeMs(Number(e.target.value))}
                    className="player-seekbar"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="watch-info">
            <div className="watch-selectors">
              <select
                value={selectedTitleId}
                onChange={(e) => {
                  const nextTitleId = e.target.value;
                  if (getCurrentPlan() === "free") {
                    const selection = lockFreeTitleSelection(nextTitleId);
                    if (!selection.allowed) {
                      setWatchLimitMessage("무료 플랜은 선택한 1개 작품만 시청할 수 있어요.");
                      return;
                    }
                    if (selection.newlySelected) {
                      setWatchLimitMessage("무료 플랜 작품이 선택되어 고정되었습니다.");
                    } else {
                      setWatchLimitMessage("");
                    }
                  }
                  setSelectedTitleId(nextTitleId);
                }}
                className="watch-select"
              >
                {titles.map((title) => (
                  <option key={title.id} value={title.id}>
                    {title.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedEpisodeId}
                onChange={(e) => setSelectedEpisodeId(e.target.value)}
                className="watch-select"
              >
                {episodes.map((episode) => (
                  <option key={episode.id} value={episode.id}>
                    S{episode.season}E{episode.episode_number} {episode.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="watch-recommendations">
            <h2 className="watch-section-title">다음에 보기</h2>
            <div className="watch-card-row">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="watch-card-skeleton">
                  <div className="card-placeholder" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedTitleId && selectedEpisodeId && (
          <NetPlusSidebar
            titleId={selectedTitleId}
            episodeId={selectedEpisodeId}
            currentTimeMs={currentTimeMs}
            episodeName={
              selectedEpisode
                ? `S${selectedEpisode.season}E${selectedEpisode.episode_number}`
                : undefined
            }
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        )}
      </div>
    </div>
  );
}

