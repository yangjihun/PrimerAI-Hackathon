import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listEpisodeSubtitles, listEpisodes, listTitles, warmupEpisodeCache } from "../../../shared/api/netplus";
import {
  getCurrentPlan,
  getFreeSelectedTitleId,
  lockFreeTitleSelection,
} from "../../../shared/lib/subscription";
import { msToClock } from "../../../shared/lib/utils";
import type { Episode, SubtitleLine, Title, UUID } from "../../../shared/types/netplus";
import { NetPlusSidebar } from "../../../widgets/netplus-sidebar/ui/NetPlusSidebar";

export function WatchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const titleIdParam = searchParams.get("titleId");
  const episodeIdParam = searchParams.get("episodeId");

  const [titles, setTitles] = useState<Title[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState<UUID>("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<UUID>("");
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [subtitleLines, setSubtitleLines] = useState<SubtitleLine[]>([]);
  const [subtitleError, setSubtitleError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [watchLimitMessage, setWatchLimitMessage] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    async function loadTitles() {
      const data = await listTitles();
      setTitles(data);
      if (data.length === 0) return;

      const requestedId =
        titleIdParam && data.some((title) => title.id === titleIdParam) ? titleIdParam : data[0].id;

      if (getCurrentPlan() === "free") {
        const alreadySelected = getFreeSelectedTitleId();
        if (alreadySelected && requestedId !== alreadySelected) {
          const targetId = data.some((title) => title.id === alreadySelected)
            ? alreadySelected
            : data[0].id;
          setWatchLimitMessage("Free plan can watch only one selected title.");
          setSelectedTitleId(targetId);
          navigate(`/watch?titleId=${targetId}`, { replace: true });
          return;
        }

        const selection = lockFreeTitleSelection(requestedId);
        setWatchLimitMessage(selection.newlySelected ? "Free-plan title has been locked." : "");
      }

      setSelectedTitleId(requestedId);
    }
    void loadTitles();
  }, [titleIdParam, navigate]);

  useEffect(() => {
    async function loadEpisodes() {
      if (!selectedTitleId) return;
      const data = await listEpisodes(selectedTitleId);
      setEpisodes(data);
      if (data.length === 0) {
        setSelectedEpisodeId("");
        return;
      }

      const targetId =
        episodeIdParam && data.some((episode) => episode.id === episodeIdParam)
          ? episodeIdParam
          : data[0].id;
      setSelectedEpisodeId(targetId);
    }
    void loadEpisodes();
  }, [selectedTitleId, episodeIdParam]);

  useEffect(() => {
    setCurrentTimeMs(0);
    setVideoDurationMs(0);
    setIsVideoPlaying(false);
  }, [selectedEpisodeId]);

  useEffect(() => {
    async function loadSubtitles() {
      if (!selectedEpisodeId) {
        setSubtitleLines([]);
        setSubtitleError("");
        return;
      }
      try {
        await warmupEpisodeCache(selectedEpisodeId);
      } catch (error) {
        console.warn("Episode cache warmup failed:", error);
      }
      try {
        const lines = await listEpisodeSubtitles(selectedEpisodeId);
        setSubtitleLines(lines);
        setSubtitleError("");
      } catch (error) {
        console.error("Failed to load subtitles:", error);
        setSubtitleLines([]);
        setSubtitleError("Failed to load subtitles. Check backend route/env.");
      }
    }
    void loadSubtitles();
  }, [selectedEpisodeId]);

  const selectedEpisode = episodes.find((ep) => ep.id === selectedEpisodeId);
  const currentSubtitle = subtitleLines.find(
    (line) => line.start_ms <= currentTimeMs && currentTimeMs <= line.end_ms,
  );
  const hasVideoSource = Boolean(selectedEpisode?.video_url);
  const effectiveDurationMs =
    (hasVideoSource ? videoDurationMs : 0) || selectedEpisode?.duration_ms || 3_600_000;

  const handleSeek = (nextMs: number) => {
    const safeMs = Math.max(0, Math.min(nextMs, effectiveDurationMs));
    setCurrentTimeMs(safeMs);
    if (hasVideoSource && videoRef.current) {
      videoRef.current.currentTime = safeMs / 1000;
    }
  };

  useEffect(() => {
    if (!hasVideoSource || !isVideoPlaying) return;
    const intervalId = window.setInterval(() => {
      const node = videoRef.current;
      if (!node) return;
      const nextMs = Math.round(node.currentTime * 1000);
      setCurrentTimeMs((prev) => (Math.abs(prev - nextMs) >= 100 ? nextMs : prev));
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [hasVideoSource, isVideoPlaying]);

  return (
    <div className="watch-page">
      <div className="watch-back-section">
        <button className="watch-back-btn" onClick={() => navigate("/browse")}>
          Back to Browse
        </button>
      </div>

      <div
        className={`watch-main ${isSidebarOpen ? "sidebar-open" : ""}`}
        data-sidebar-open={isSidebarOpen}
      >
        <div className="watch-player-section">
          {watchLimitMessage && <div className="watch-limit-banner">{watchLimitMessage}</div>}

          <div className="watch-player-container">
            {hasVideoSource ? (
              <div className="watch-video-shell">
                <div className="player-title">
                  {selectedEpisode
                    ? `S${selectedEpisode.season}E${selectedEpisode.episode_number} ${selectedEpisode.name}`
                    : "Video Player"}
                </div>
                <div className="watch-video-frame">
                  <video
                    ref={videoRef}
                    key={selectedEpisodeId}
                    src={selectedEpisode?.video_url ?? undefined}
                    controls
                    className="watch-video-element"
                  onLoadedMetadata={(e) => {
                    const duration = Number(e.currentTarget.duration);
                    if (Number.isFinite(duration) && !Number.isNaN(duration)) {
                      setVideoDurationMs(Math.round(duration * 1000));
                    }
                  }}
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  onEnded={() => setIsVideoPlaying(false)}
                  onSeeked={(e) => {
                    setCurrentTimeMs(Math.round(e.currentTarget.currentTime * 1000));
                  }}
                  onTimeUpdate={(e) => {
                    setCurrentTimeMs(Math.round(e.currentTarget.currentTime * 1000));
                  }}
                />
                  {currentSubtitle && (
                    <div className="watch-video-subtitle-overlay">
                      <div className="watch-video-subtitle-text">
                        {currentSubtitle.speaker_text ? `${currentSubtitle.speaker_text}: ` : ""}
                        {currentSubtitle.text}
                      </div>
                    </div>
                  )}
                </div>
                <div className="player-content">
                  <div className="player-time">
                    {msToClock(currentTimeMs)} / {msToClock(effectiveDurationMs)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="watch-player-placeholder">
                <div className="player-content">
                  <div className="player-title">
                    {selectedEpisode
                      ? `S${selectedEpisode.season}E${selectedEpisode.episode_number} ${selectedEpisode.name}`
                      : "Video Player"}
                  </div>
                  <div className="player-time">
                    {msToClock(currentTimeMs)} / {msToClock(effectiveDurationMs)}
                  </div>
                  {currentSubtitle && (
                    <div className="player-current-subtitle">
                      {currentSubtitle.speaker_text ? `${currentSubtitle.speaker_text}: ` : ""}
                      {currentSubtitle.text}
                    </div>
                  )}
                  <div className="player-controls">
                    <input
                      type="range"
                      min={0}
                      max={effectiveDurationMs}
                      value={Math.min(currentTimeMs, effectiveDurationMs)}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="player-seekbar"
                    />
                  </div>
                </div>
              </div>
            )}
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
                      setWatchLimitMessage("Free plan can watch only one selected title.");
                      return;
                    }
                    setWatchLimitMessage(selection.newlySelected ? "Free-plan title has been locked." : "");
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

          <div className="watch-subtitles-panel">
            <h2 className="watch-section-title">Subtitles</h2>
            {subtitleLines.length === 0 ? (
              <p className="watch-subtitle-empty">
                {subtitleError || "No subtitles for this episode."}
              </p>
            ) : (
              <div className="watch-subtitle-list">
                {subtitleLines.map((line) => {
                  const isActive = line.id === currentSubtitle?.id;
                  return (
                    <button
                      key={line.id}
                      type="button"
                      className={`watch-subtitle-line ${isActive ? "active" : ""}`}
                      onClick={() => handleSeek(line.start_ms)}
                    >
                      <span className="watch-subtitle-time">{msToClock(line.start_ms)}</span>
                      <span className="watch-subtitle-text">
                        {line.speaker_text ? `${line.speaker_text}: ` : ""}
                        {line.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="watch-recommendations">
            <h2 className="watch-section-title">Up Next</h2>
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
