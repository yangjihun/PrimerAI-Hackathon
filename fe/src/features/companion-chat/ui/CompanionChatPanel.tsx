import { FormEvent, useState } from "react";
import type { UUID, QAResponse, ResponseStyle } from "../../../shared/types/netplus";
import { askQuestion } from "../../../shared/api/netplus";
import { EvidenceQuote } from "../../../shared/ui/EvidenceQuote";
import { Button } from "../../../shared/ui/Button";
import {
  consumeAiUsage,
  getAiUsageStatus,
  type AiUsageStatus,
} from "../../../shared/lib/subscription";

const CHAT_STYLE_STORAGE_KEY = "netplus_chat_response_style";

const STYLE_LABELS: Record<ResponseStyle, string> = {
  FRIEND: "Friend",
  ASSISTANT: "Assistant",
  CRITIC: "Film Critic",
};

interface CompanionChatPanelProps {
  titleId: UUID;
  episodeId: UUID;
  currentTimeMs: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: QAResponse;
}

export function CompanionChatPanel({
  titleId,
  episodeId,
  currentTimeMs,
}: CompanionChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiUsage, setAiUsage] = useState<AiUsageStatus>(() => getAiUsageStatus());
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(() => {
    if (typeof window === "undefined") return "FRIEND";
    const saved = localStorage.getItem(CHAT_STYLE_STORAGE_KEY);
    if (saved === "FRIEND" || saved === "ASSISTANT" || saved === "CRITIC") return saved;
    return "FRIEND";
  });

  const handleStyleChange = (value: string) => {
    if (value !== "FRIEND" && value !== "ASSISTANT" && value !== "CRITIC") return;
    setResponseStyle(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(CHAT_STYLE_STORAGE_KEY, value);
    }
  };

  const askWithUsageGuard = async (question: string) => {
    const usage = consumeAiUsage();
    setAiUsage(usage.status);
    if (!usage.allowed) {
      setError("무료 플랜 AI 체험 3회를 모두 사용했습니다. 무제한 사용을 위해 요금제를 업그레이드하세요.");
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await askQuestion({
        title_id: titleId,
        episode_id: episodeId,
        current_time_ms: currentTimeMs,
        question,
        response_style: responseStyle,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer.conclusion,
        data: response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (requestError) {
      console.error("Failed to ask question:", requestError);
      setError("질문 요청에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setError("");
    await askWithUsageGuard(question);
  };

  const handlePreset = async (preset: "recap" | "scene" | "relation") => {
    if (loading) return;
    setError("");

    const presetQuestions: Record<typeof preset, string> = {
      recap: "지금까지 내용을 1분으로 요약해줘.",
      scene: "방금 장면이 왜 이렇게 전개됐어?",
      relation: "A와 B의 관계가 뭐야?",
    };

    await askWithUsageGuard(presetQuestions[preset]);
  };

  return (
    <div className="companion-chat-panel">
      {!aiUsage.isUnlimited && (
        <div className="ai-trial-note">
          AI 무료 체험 잔여 횟수: {aiUsage.remaining}/{aiUsage.limit}
        </div>
      )}
      {error && <div className="ai-trial-error">{error}</div>}

      <div className="chat-style-picker">
        <label htmlFor="chat-style-select">Style</label>
        <select
          id="chat-style-select"
          value={responseStyle}
          onChange={(e) => handleStyleChange(e.target.value)}
          disabled={loading}
        >
          {(["FRIEND", "ASSISTANT", "CRITIC"] as ResponseStyle[]).map((style) => (
            <option key={style} value={style}>
              {STYLE_LABELS[style]}
            </option>
          ))}
        </select>
      </div>

      <div className="preset-buttons">
        <Button variant="ghost" size="sm" onClick={() => handlePreset("recap")}>
          1분 요약
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handlePreset("scene")}>
          장면 이유
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handlePreset("relation")}>
          인물 관계
        </Button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>질문을 입력하거나 빠른 질문 버튼을 선택해 주세요.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            <div className="chat-content">
              <p>{msg.content}</p>
              {msg.role === "assistant" && msg.data && (
                <div className="chat-details">
                  {msg.data.answer.context.length > 0 && (
                    <div className="chat-context">
                      {msg.data.answer.context.map((line, idx) => (
                        <p key={idx} className="context-line">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                  {msg.data.answer.interpretations.length > 0 && (
                    <div className="chat-interpretations">
                      {msg.data.answer.interpretations.map((interp) => (
                        <div key={interp.label} className="interpretation">
                          <strong>{interp.label}:</strong> {interp.text} (
                          {(interp.confidence * 100).toFixed(0)}%)
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.data.evidences.length > 0 && (
                    <div className="chat-evidences">
                      {msg.data.evidences.map((evidence) => (
                        <EvidenceQuote key={evidence.evidence_id} evidence={evidence} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-content">
              <p>생각 중...</p>
            </div>
          </div>
        )}
      </div>

      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력해 주세요..."
          className="chat-input"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          전송
        </Button>
      </form>
    </div>
  );
}
