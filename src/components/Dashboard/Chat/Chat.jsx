

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import "./Chat.css";

//  Configuration – easy to change later or load from backend/config file
const DEFAULT_WELCOME = {
  summary: "Welcome to Delphi. Ask a question to get a concise summary with source links.",
  content:
    "I specialize in surfacing research insights from Lifeblood material. Ask about trends, findings, or comparisons. I will not include PII/PHI and can handle sensitive topics.",
};

const DEFAULT_HINT = "Generating answer with summaries and sources…";
const BACKEND_API_URL = import.meta.env.VITE_API_URL || ""; // optional backend URL

const Chat = ({ activeChatId, messages = [], onMessagesChange }) => {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  const canSend = useMemo(
    () => !isLoading && inputValue.trim().length > 0,
    [isLoading, inputValue]
  );

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current)
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  //  Reset chat whenever activeChatId changes
  useEffect(() => {
    if (!messages || messages.length === 0) {
      onMessagesChange([
        {
          id: `a_welcome_${Date.now()}`,
          role: "assistant",
          summary: DEFAULT_WELCOME.summary,
          content: DEFAULT_WELCOME.content,
          citations: [],
          liked: null,
        },
      ]);
    }
    setInputValue("");
    setErrorMessage("");
    setIsLoading(false);
    if (abortRef.current) abortRef.current.abort();
  }, [activeChatId]);

  //  Fetch or simulate assistant response
  const getAssistantResponse = async (conversation) => {
    try {
      if (BACKEND_API_URL) {
        const res = await fetch(`${BACKEND_API_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation }),
        });
        if (!res.ok) throw new Error("Backend error");
        const data = await res.json();
        return {
          summary: data.summary || "",
          content: data.content || "",
          citations: Array.isArray(data.citations) ? data.citations : [],
        };
      } else {
        // fallback when backend is not available
        const lastUser = [...conversation].reverse().find((m) => m.role === "user");
        return {
          summary: `Summary: ${lastUser?.content?.slice(0, 80) || "No question"}...`,
          content:
            "Backend not connected. This is a local simulation of Delphi’s response.",
          citations: [],
        };
      }
    } catch (err) {
      console.error("Response error:", err);
      const lastUser = [...conversation].reverse().find((m) => m.role === "user");
      return {
        summary: `Summary: ${lastUser?.content?.slice(0, 80) || "No question"}...`,
        content: "There was an error contacting the backend. Please try again.",
        citations: [],
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSend) return;

    setErrorMessage("");
    const userMessage = {
      id: `m_${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
    };
    const nextMessages = [...messages, userMessage];
    onMessagesChange(nextMessages);
    setInputValue("");
    setIsLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await getAssistantResponse(
        nextMessages.map(({ role, content }) => ({ role, content }))
      );
      const assistantMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        summary: data.summary,
        content: data.content,
        citations: data.citations,
        liked: null,
      };
      onMessagesChange([...nextMessages, assistantMessage]);
    } catch (err) {
      console.error(err);
      setErrorMessage("There was an issue getting a response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (messageId, liked) => {
    const updated = messages.map((m) =>
      m.id === messageId ? { ...m, liked } : m
    );
    onMessagesChange(updated);
    try {
      await new Promise((r) => setTimeout(r, 200));
      console.log("Feedback submitted:", { messageId, liked });
    } catch {}
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chat</h2>
        <p>Ask questions to retrieve insights from Lifeblood material.</p>
      </div>

      <div className="chat-body">
        <div className="chat-content" role="log" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`message-row ${m.role}`}>
              <div className="avatar" aria-hidden="true">
                {m.role === "assistant" ? "∆" : "You"}
              </div>
              <div className="bubble">
                {m.role === "assistant" && m.summary && (
                  <div className="assistant-summary">{m.summary}</div>
                )}
                <div className="message-content">{m.content}</div>

                {m.role === "assistant" &&
                  Array.isArray(m.citations) &&
                  m.citations.length > 0 && (
                    <div className="citations">
                      <span className="citations-label">Sources:</span>
                      <ul>
                        {m.citations.map((c, idx) => (
                          <li key={idx}>
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              {c.title || c.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {m.role === "assistant" && (
                  <div
                    className="feedback-row"
                    role="group"
                    aria-label="Feedback"
                  >
                    <button
                      type="button"
                      className={`icon-button ${
                        m.liked === true ? "active" : ""
                      }`}
                      onClick={() => handleFeedback(m.id, true)}
                      aria-pressed={m.liked === true}
                      title="Like"
                    >
                      <ThumbUpAltOutlinedIcon fontSize="small" />
                    </button>
                    <button
                      type="button"
                      className={`icon-button ${
                        m.liked === false ? "active" : ""
                      }`}
                      onClick={() => handleFeedback(m.id, false)}
                      aria-pressed={m.liked === false}
                      title="Dislike"
                    >
                      <ThumbDownAltOutlinedIcon fontSize="small" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-row assistant">
              <div className="avatar" aria-hidden="true">
                ∆
              </div>
              <div className="bubble">
                <div className="typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="hint">{DEFAULT_HINT}</div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <form className="chat-input" onSubmit={handleSubmit} role="search">
        <input
          type="text"
          placeholder="Ask a question about Lifeblood material…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          aria-label="Message"
          disabled={isLoading}
        />
        {!isLoading ? (
          <button type="submit" className="send-button" disabled={!canSend}>
            Send
          </button>
        ) : (
          <button type="button" className="stop-button" onClick={handleStop}>
            Stop
          </button>
        )}
      </form>

      {errorMessage && (
        <div className="error-banner" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default Chat;
