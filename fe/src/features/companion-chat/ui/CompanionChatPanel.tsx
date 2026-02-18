import { FormEvent, useState } from "react";
import type { UUID, QAResponse } from "../../../shared/types/netplus";
import { askQuestion } from "../../../shared/api/netplus";
import { EvidenceQuote } from "../../../shared/ui/EvidenceQuote";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";

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

