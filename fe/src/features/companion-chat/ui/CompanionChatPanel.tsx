import { FormEvent, useState } from "react";
import type { UUID, QAResponse, ResponseStyle } from "../../../shared/types/netplus";
import { askQuestion } from "../../../shared/api/netplus";
import { EvidenceQuote } from "../../../shared/ui/EvidenceQuote";
import { Button } from "../../../shared/ui/Button";

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

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await askQuestion({
        title_id: titleId,
        episode_id: episodeId,
        current_time_ms: currentTimeMs,
        question: input,
        response_style: responseStyle,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer.conclusion,
        data: response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to ask question:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = async (preset: string) => {
    const presetQuestions: Record<string, string> = {
      recap: "지난 내용 1분 요약해줘",
      scene: "방금 장면 왜 그래?",
      relation: "A랑 B 관계 뭐야?",
    };

    const question = presetQuestions[preset];
    if (!question) return;

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
    } catch (error) {
      console.error("Failed to ask question:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="companion-chat-panel">
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreset("recap")}
        >
          지난 내용 1분 요약
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreset("scene")}
        >
          방금 장면 왜 그래?
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreset("relation")}
        >
          A랑 B 관계 뭐야?
        </Button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>질문을 입력하거나 빠른 프리셋을 선택하세요.</p>
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
          placeholder="질문을 입력하세요..."
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

