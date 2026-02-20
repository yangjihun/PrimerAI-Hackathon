import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Episode, Title, UUID } from "../../../shared/types/netplus";
import {
  deleteTitleThumbnailUrl,
  ingestEpisode,
  ingestSubtitleLinesBulk,
  ingestTitle,
  deleteEpisodeVideoUrl,
  issueTitleImageUploadSignature,
  issueVideoUploadSignature,
  listEpisodes,
  listTitles,
  updateTitleThumbnailUrl,
  updateEpisodeVideoUrl,
} from "../../../shared/api/netplus";

type ParsedSubtitleLine = {
  start_ms: number;
  end_ms: number;
  speaker_text?: string;
  text: string;
};

type RawSubtitlePoint = {
  start_ms: number;
  speaker_text?: string;
  text: string;
};

function parseTimestampToMs(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return Number.NaN;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const normalized = trimmed.replace(",", ".");
  const [main, fraction = "0"] = normalized.split(".");
  const parts = main.split(":").map((v) => Number(v));
  if (parts.some((v) => Number.isNaN(v))) return Number.NaN;

  let seconds = 0;
  if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
  else if (parts.length === 1) seconds = parts[0];
  else return Number.NaN;

  const ms = Number(fraction.padEnd(3, "0").slice(0, 3));
  if (Number.isNaN(ms)) return Number.NaN;
  return seconds * 1000 + ms;
}

function parseSubtitleLines(input: string): { lines: ParsedSubtitleLine[]; errors: string[] } {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const lines: ParsedSubtitleLine[] = [];
  const timedPoints: RawSubtitlePoint[] = [];
  const errors: string[] = [];

  const timedWithSpeaker = /^\(([\d:.,]+)\)\s*([^:]+?)\s*:\s*(.+)$/;
  const timedTextOnly = /^\(([\d:.,]+)\)\s*(.+)$/;

  rows.forEach((row, idx) => {
    const normalizedRow = row.replace(/\uFF1A/g, ":");
    const parts = normalizedRow.split("|").map((v) => v.trim());
    if (parts.length >= 3) {
      const startMs = parseTimestampToMs(parts[0]);
      const endMs = parseTimestampToMs(parts[1]);
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
        errors.push(`Line ${idx + 1}: invalid time range`);
        return;
      }

      if (parts.length >= 4) {
        const speaker = parts[2];
        const text = parts.slice(3).join("|").trim();
        if (!text) {
          errors.push(`Line ${idx + 1}: missing subtitle text`);
          return;
        }
        lines.push({ start_ms: startMs, end_ms: endMs, speaker_text: speaker || undefined, text });
        return;
      }

      const text = parts.slice(2).join("|").trim();
      if (!text) {
        errors.push(`Line ${idx + 1}: missing subtitle text`);
        return;
      }
      lines.push({ start_ms: startMs, end_ms: endMs, text });
      return;
    }

    const matchSpeaker = normalizedRow.match(timedWithSpeaker);
    if (matchSpeaker) {
      const startMs = parseTimestampToMs(matchSpeaker[1]);
      if (Number.isNaN(startMs)) {
        errors.push(`Line ${idx + 1}: invalid timestamp`);
        return;
      }
      const speaker = matchSpeaker[2].trim();
      const text = matchSpeaker[3].trim();
      if (!text) {
        errors.push(`Line ${idx + 1}: missing subtitle text`);
        return;
      }
      timedPoints.push({ start_ms: startMs, speaker_text: speaker || undefined, text });
      return;
    }

    const matchText = normalizedRow.match(timedTextOnly);
    if (matchText) {
      const startMs = parseTimestampToMs(matchText[1]);
      if (Number.isNaN(startMs)) {
        errors.push(`Line ${idx + 1}: invalid timestamp`);
        return;
      }
      const text = matchText[2].trim();
      if (!text) {
        errors.push(`Line ${idx + 1}: missing subtitle text`);
        return;
      }
      timedPoints.push({ start_ms: startMs, text });
      return;
    }

    if (row.startsWith("<")) return;
    if (timedPoints.length > 0) {
      const last = timedPoints[timedPoints.length - 1];
      last.text = `${last.text} ${row}`.trim();
      return;
    }
    errors.push(`Line ${idx + 1}: unsupported format`);
  });

  if (timedPoints.length > 0) {
    timedPoints.sort((a, b) => a.start_ms - b.start_ms);
    for (let i = 0; i < timedPoints.length; i += 1) {
      const current = timedPoints[i];
      const next = timedPoints[i + 1];
      const fallbackEnd = current.start_ms + 2500;
      const nextBound = next ? Math.max(current.start_ms + 300, next.start_ms - 1) : fallbackEnd;
      lines.push({
        start_ms: current.start_ms,
        end_ms: nextBound,
        speaker_text: current.speaker_text,
        text: current.text,
      });
    }
  }

  return { lines, errors };
}

export function AdminPage() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState<UUID>("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<UUID>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [titleName, setTitleName] = useState("");
  const [titleDescription, setTitleDescription] = useState("");
  const [titleThumbnailUrl, setTitleThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const [episodeSeason, setEpisodeSeason] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeName, setEpisodeName] = useState("");
  const [episodeDurationMs, setEpisodeDurationMs] = useState(3_600_000);
  const [episodeVideoUrl, setEpisodeVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);

  const [subtitleInput, setSubtitleInput] = useState("");

  const selectedTitle = useMemo(
    () => titles.find((title) => title.id === selectedTitleId) ?? null,
    [titles, selectedTitleId],
  );

  useEffect(() => {
    async function boot() {
      const fetchedTitles = await listTitles();
      setTitles(fetchedTitles);
      if (fetchedTitles.length > 0) setSelectedTitleId(fetchedTitles[0].id);
    }
    void boot();
  }, []);

  useEffect(() => {
    async function loadEpisodeList() {
      if (!selectedTitleId) {
        setEpisodes([]);
        setSelectedEpisodeId("");
        return;
      }
      const fetchedEpisodes = await listEpisodes(selectedTitleId);
      setEpisodes(fetchedEpisodes);
      setSelectedEpisodeId(fetchedEpisodes[0]?.id ?? "");
    }
    void loadEpisodeList();
  }, [selectedTitleId]);

  const resetNotice = () => {
    setMessage("");
    setError("");
  };

  const handleCreateTitle = async (e: FormEvent) => {
    e.preventDefault();
    if (!titleName.trim()) return;

    resetNotice();
    setLoading(true);
    try {
      const created = await ingestTitle({
        name: titleName.trim(),
        description: titleDescription.trim() || undefined,
        thumbnail_url: titleThumbnailUrl.trim() || undefined,
      });
      setTitles((prev) => [created, ...prev]);
      setSelectedTitleId(created.id);
      setTitleName("");
      setTitleDescription("");
      setTitleThumbnailUrl("");
      setMessage(`Title created: ${created.name}`);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to create title.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEpisode = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTitleId) {
      setError("Select a title first.");
      return;
    }

    resetNotice();
    setLoading(true);
    try {
      const created = await ingestEpisode({
        title_id: selectedTitleId,
        season: episodeSeason,
        episode_number: episodeNumber,
        name: episodeName.trim() || undefined,
        duration_ms: episodeDurationMs,
        video_url: episodeVideoUrl.trim() || undefined,
      });
      setEpisodes((prev) => [created, ...prev]);
      setSelectedEpisodeId(created.id);
      setEpisodeName("");
      setEpisodeVideoUrl("");
      setMessage(`Episode created: S${created.season}E${created.episode_number}`);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to create episode.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadVideo = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEpisodeId) {
      setError("Select an episode first.");
      return;
    }
    if (!videoFile) {
      setError("Select a video file first.");
      return;
    }

    resetNotice();
    setLoading(true);
    setVideoUploadProgress(0);
    try {
      const signed = await issueVideoUploadSignature({
        episode_id: selectedEpisodeId,
        filename: videoFile.name,
      });

      const chunkSize = 20 * 1024 * 1024; // 20MB
      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const totalBytes = videoFile.size;
      let start = 0;
      let secureUrl = "";

      while (start < totalBytes) {
        const endExclusive = Math.min(start + chunkSize, totalBytes);
        const endInclusive = endExclusive - 1;
        const chunk = videoFile.slice(start, endExclusive);

        const formData = new FormData();
        formData.append("file", chunk, videoFile.name);
        formData.append("api_key", signed.api_key);
        formData.append("timestamp", signed.timestamp);
        formData.append("folder", signed.folder);
        formData.append("public_id", signed.public_id);
        formData.append("signature", signed.signature);

        const uploadResponse = await fetch(signed.upload_url, {
          method: "POST",
          headers: {
            "X-Unique-Upload-Id": uploadId,
            "Content-Range": `bytes ${start}-${endInclusive}/${totalBytes}`,
          },
          body: formData,
        });
        if (!uploadResponse.ok) {
          let detail = `Cloudinary upload failed: ${uploadResponse.status}`;
          try {
            const errJson = (await uploadResponse.json()) as {
              error?: { message?: string };
            };
            const msg = errJson?.error?.message?.trim();
            if (msg) detail = `Cloudinary upload failed: ${msg}`;
          } catch {
            try {
              const errText = (await uploadResponse.text()).trim();
              if (errText) detail = `Cloudinary upload failed: ${errText}`;
            } catch {
              // no-op
            }
          }
          throw new Error(detail);
        }

        const uploaded = (await uploadResponse.json()) as { secure_url?: string; done?: boolean };
        if (uploaded.secure_url) {
          secureUrl = uploaded.secure_url.trim();
        }

        start = endExclusive;
        setVideoUploadProgress(Math.round((start / totalBytes) * 100));
      }

      if (!secureUrl) {
        throw new Error("Cloudinary secure_url missing");
      }

      await updateEpisodeVideoUrl({
        episode_id: selectedEpisodeId,
        video_url: secureUrl,
      });
      setEpisodes((prev) =>
        prev.map((ep) => (ep.id === selectedEpisodeId ? { ...ep, video_url: secureUrl } : ep)),
      );
      setEpisodeVideoUrl(secureUrl);
      setVideoFile(null);
      setVideoUploadProgress(100);
      setMessage("Video uploaded and linked.");
    } catch (requestError) {
      console.error(requestError);
      setError(
        requestError instanceof Error ? requestError.message : "Failed to upload video.",
      );
      setVideoUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadThumbnail = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTitleId) {
      setError("Select a title first.");
      return;
    }
    if (!thumbnailFile) {
      setError("Select an image file first.");
      return;
    }

    resetNotice();
    setLoading(true);
    try {
      const signed = await issueTitleImageUploadSignature({
        title_id: selectedTitleId,
        filename: thumbnailFile.name,
      });

      const formData = new FormData();
      formData.append("file", thumbnailFile);
      formData.append("api_key", signed.api_key);
      formData.append("timestamp", signed.timestamp);
      formData.append("folder", signed.folder);
      formData.append("public_id", signed.public_id);
      formData.append("signature", signed.signature);

      const uploadResponse = await fetch(signed.upload_url, {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Thumbnail upload failed: ${uploadResponse.status}`);
      }
      const uploaded = (await uploadResponse.json()) as { secure_url?: string };
      const secureUrl = (uploaded.secure_url ?? "").trim();
      if (!secureUrl) {
        throw new Error("Thumbnail secure_url missing");
      }

      await updateTitleThumbnailUrl({
        title_id: selectedTitleId,
        thumbnail_url: secureUrl,
      });
      setTitles((prev) =>
        prev.map((title) =>
          title.id === selectedTitleId ? { ...title, thumbnail_url: secureUrl } : title,
        ),
      );
      setTitleThumbnailUrl(secureUrl);
      setThumbnailFile(null);
      setMessage("Thumbnail uploaded and linked.");
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to upload thumbnail.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubtitles = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEpisodeId) {
      setError("Select an episode first.");
      return;
    }

    resetNotice();
    const parsed = parseSubtitleLines(subtitleInput);
    if (parsed.errors.length > 0) {
      setError(parsed.errors.slice(0, 5).join(", "));
      return;
    }
    if (parsed.lines.length === 0) {
      setError("No subtitle lines to upload.");
      return;
    }

    setLoading(true);
    try {
      const response = await ingestSubtitleLinesBulk({
        lines: parsed.lines.map((line) => ({
          episode_id: selectedEpisodeId,
          ...line,
        })),
      });
      setMessage(`Subtitles uploaded: ${response.inserted_count} lines`);
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to upload subtitles.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (episodeId: UUID) => {
    if (loading) return;
    resetNotice();
    setLoading(true);
    try {
      await deleteEpisodeVideoUrl(episodeId);
      setEpisodes((prev) =>
        prev.map((ep) => (ep.id === episodeId ? { ...ep, video_url: null } : ep)),
      );
      if (episodeId === selectedEpisodeId) {
        setEpisodeVideoUrl("");
      }
      setMessage("Video link removed from episode.");
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to delete video link.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteThumbnail = async (titleId: UUID) => {
    if (loading) return;
    resetNotice();
    setLoading(true);
    try {
      await deleteTitleThumbnailUrl(titleId);
      setTitles((prev) =>
        prev.map((title) => (title.id === titleId ? { ...title, thumbnail_url: undefined } : title)),
      );
      if (titleId === selectedTitleId) {
        setTitleThumbnailUrl("");
      }
      setMessage("Thumbnail removed from title.");
    } catch (requestError) {
      console.error(requestError);
      setError("Failed to delete thumbnail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-page">
      <section className="admin-card">
        <h1 className="admin-title">Admin</h1>
        <p className="admin-subtitle">
          Create titles, episodes, videos, and subtitles. Current title:{" "}
          <strong>{selectedTitle?.name ?? "-"}</strong>
        </p>
        {message && <p className="admin-message">{message}</p>}
        {error && <p className="admin-error">{error}</p>}
      </section>

      <section className="admin-card">
        <h2>Create Title</h2>
        <form className="admin-form" onSubmit={handleCreateTitle}>
          <input
            value={titleName}
            onChange={(e) => setTitleName(e.target.value)}
            placeholder="Title name"
            disabled={loading}
          />
          <input
            value={titleDescription}
            onChange={(e) => setTitleDescription(e.target.value)}
            placeholder="Description (optional)"
            disabled={loading}
          />
          <input
            value={titleThumbnailUrl}
            onChange={(e) => setTitleThumbnailUrl(e.target.value)}
            placeholder="Thumbnail URL (optional)"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !titleName.trim()}>
            Add Title
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Upload Thumbnail (Cloudinary)</h2>
        <form className="admin-form" onSubmit={handleUploadThumbnail}>
          <label>
            Title
            <select
              value={selectedTitleId}
              onChange={(e) => setSelectedTitleId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select</option>
              {titles.map((title) => (
                <option key={title.id} value={title.id}>
                  {title.name}
                </option>
              ))}
            </select>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !selectedTitleId || !thumbnailFile}>
            Upload Thumbnail
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Manage Title Thumbnails</h2>
        {titles.length === 0 ? (
          <p className="admin-help">No titles.</p>
        ) : (
          <div className="admin-episode-list">
            {titles.map((title) => (
              <div key={title.id} className="admin-episode-item">
                <div className="admin-episode-copy">
                  <strong>{title.name}</strong>
                  <div className="admin-episode-url">{title.thumbnail_url ?? "No thumbnail linked"}</div>
                </div>
                <button
                  type="button"
                  className="admin-danger-btn"
                  disabled={loading || !title.thumbnail_url}
                  onClick={() => handleDeleteThumbnail(title.id)}
                >
                  Delete Thumbnail
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-card">
        <h2>Create Episode</h2>
        <form className="admin-form" onSubmit={handleCreateEpisode}>
          <label>
            Title
            <select
              value={selectedTitleId}
              onChange={(e) => setSelectedTitleId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select</option>
              {titles.map((title) => (
                <option key={title.id} value={title.id}>
                  {title.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Season
            <input
              type="number"
              min={1}
              value={episodeSeason}
              onChange={(e) => setEpisodeSeason(Number(e.target.value))}
              disabled={loading}
            />
          </label>
          <label>
            Episode Number
            <input
              type="number"
              min={1}
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(Number(e.target.value))}
              disabled={loading}
            />
          </label>
          <input
            value={episodeName}
            onChange={(e) => setEpisodeName(e.target.value)}
            placeholder="Episode name (optional)"
            disabled={loading}
          />
          <label>
            Duration (ms)
            <input
              type="number"
              min={1000}
              step={1000}
              value={episodeDurationMs}
              onChange={(e) => setEpisodeDurationMs(Number(e.target.value))}
              disabled={loading}
            />
          </label>
          <input
            value={episodeVideoUrl}
            onChange={(e) => setEpisodeVideoUrl(e.target.value)}
            placeholder="Video URL (optional)"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !selectedTitleId}>
            Add Episode
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Upload Video (Cloudinary)</h2>
        <form className="admin-form" onSubmit={handleUploadVideo}>
          <label>
            Episode
            <select
              value={selectedEpisodeId}
              onChange={(e) => setSelectedEpisodeId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select</option>
              {episodes.map((episode) => (
                <option key={episode.id} value={episode.id}>
                  S{episode.season}E{episode.episode_number} {episode.name ?? ""}
                </option>
              ))}
            </select>
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            disabled={loading}
          />
          {loading && videoUploadProgress > 0 && (
            <p className="admin-help">Uploading... {videoUploadProgress}%</p>
          )}
          <button type="submit" disabled={loading || !selectedEpisodeId || !videoFile}>
            Upload Video
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Manage Episode Videos</h2>
        {episodes.length === 0 ? (
          <p className="admin-help">No episodes.</p>
        ) : (
          <div className="admin-episode-list">
            {episodes.map((episode) => (
              <div key={episode.id} className="admin-episode-item">
                <div className="admin-episode-copy">
                  <strong>
                    S{episode.season}E{episode.episode_number} {episode.name ?? ""}
                  </strong>
                  <div className="admin-episode-url">{episode.video_url ?? "No video linked"}</div>
                </div>
                <button
                  type="button"
                  className="admin-danger-btn"
                  disabled={loading || !episode.video_url}
                  onClick={() => handleDeleteVideo(episode.id)}
                >
                  Delete Video
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-card">
        <h2>Upload Subtitles</h2>
        <p className="admin-help">
          Format A: <code>start|end|speaker|text</code> or <code>start|end|text</code>
          <br />
          Format B: <code>(time) speaker: text</code> or <code>(time) text</code>
          <br />
          Time supports <code>mm:ss</code>, <code>hh:mm:ss</code>, <code>hh:mm:ss,ms</code>, or raw
          milliseconds.
        </p>
        <form className="admin-form" onSubmit={handleUploadSubtitles}>
          <label>
            Episode
            <select
              value={selectedEpisodeId}
              onChange={(e) => setSelectedEpisodeId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select</option>
              {episodes.map((episode) => (
                <option key={episode.id} value={episode.id}>
                  S{episode.season}E{episode.episode_number} {episode.name ?? ""}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={subtitleInput}
            onChange={(e) => setSubtitleInput(e.target.value)}
            placeholder="(0:02) Narration: A rumor spreads..."
            rows={10}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !selectedEpisodeId}>
            Upload Subtitles
          </button>
        </form>
      </section>
    </main>
  );
}
