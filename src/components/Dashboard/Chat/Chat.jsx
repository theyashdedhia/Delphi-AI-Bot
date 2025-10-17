import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDarkMode } from '../../../contexts/DarkModeContext.jsx';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import './Chat.css';

const Chat = () => {
  const { isDarkMode } = useDarkMode();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  const canSend = useMemo(() => !isLoading && inputValue.trim().length > 0, [isLoading, inputValue]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const simulateAssistantResponse = (conversation) => {
    const lastUser = [...conversation].reverse().find((m) => m.role === 'user');
    const summary = lastUser ? `Summary: ${lastUser.content.slice(0, 100)}...` : 'Summary unavailable.';
    const content = 'This is a placeholder response. Integrate with your backend to fetch real, sourced insights.';
    const citations = [
      { title: 'Lifeblood Source A', url: 'https://example.com/source-a' },
      { title: 'Lifeblood Source B', url: 'https://example.com/source-b' }
    ];
    return { summary, content, citations };
  };

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: `a_welcome_${Date.now()}`,
          role: 'assistant',
          summary: 'Welcome to Delphi. Ask a question to get a concise summary with source links.',
            content: 'I specialize in surfacing research insights from Lifeblood material. Ask about trends, findings, or comparisons. I will not include PII/PHI and can handle sensitive topics.',
          citations: [],
          liked: null
        }
      ]);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSend) return;

    setErrorMessage('');
    const userMessage = { id: `m_${Date.now()}`, role: 'user', content: inputValue.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputValue('');
    setIsLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const data = simulateAssistantResponse(nextMessages.map(({ role, content }) => ({ role, content })));
      const assistantMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: data.content || '',
        summary: data.summary || '',
        citations: Array.isArray(data.citations) ? data.citations : [],
        liked: null
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setErrorMessage('There was an issue getting a response. Please try again.');
    } finally { setIsLoading(false); }
  };

  const handleFeedback = async (messageId, liked) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, liked } : m)));
    try { await new Promise((r) => setTimeout(r, 200)); console.log('Feedback submitted (placeholder):', { messageId, liked }); } catch {}
  };

  const handleStop = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; setIsLoading(false); }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chat</h2>
        <p>Ask questions to retrieve insights from Lifeblood material.</p>
      </div>
      <div className="chat-body">
        <div className="chat-content" role="log" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-placeholder">
              <div className="placeholder-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3>Welcome to Delphi Chat</h3>
              <p>Ask natural language questions. Responses include summaries and sources.</p>
              <p>We avoid PII/PHI exposure and can handle sensitive topics.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`message-row ${m.role}`}>
              <div className="avatar" aria-hidden="true">{m.role === 'assistant' ? '∆' : 'You'}</div>
              <div className="bubble">
                {m.role === 'assistant' && m.summary ? <div className="assistant-summary">{m.summary}</div> : null}
                <div className="message-content">{m.content}</div>
                {m.role === 'assistant' && Array.isArray(m.citations) && m.citations.length > 0 && (
                  <div className="citations">
                    <span className="citations-label">Sources:</span>
                    <ul>
                      {m.citations.map((c, idx) => (
                        <li key={idx}><a href={c.url} target="_blank" rel="noreferrer noopener">{c.title || c.url}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.role === 'assistant' && (
                  <div className="feedback-row" role="group" aria-label="Feedback">
                    <button type="button" className={`icon-button ${m.liked === true ? 'active' : ''}`} onClick={() => handleFeedback(m.id, true)} aria-pressed={m.liked === true} title="Like"><ThumbUpAltOutlinedIcon fontSize="small" /></button>
                    <button type="button" className={`icon-button ${m.liked === false ? 'active' : ''}`} onClick={() => handleFeedback(m.id, false)} aria-pressed={m.liked === false} title="Dislike"><ThumbDownAltOutlinedIcon fontSize="small" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message-row assistant">
              <div className="avatar" aria-hidden="true">∆</div>
              <div className="bubble">
                <div className="typing"><span></span><span></span><span></span></div>
                <div className="hint">Generating answer with summaries and sources…</div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <form className="chat-input" onSubmit={handleSubmit} role="search">
        <input type="text" placeholder="Ask a question about Lifeblood material…" value={inputValue} onChange={(e) => setInputValue(e.target.value)} aria-label="Message" disabled={isLoading} />
        {!isLoading ? (
          <button type="submit" className="send-button" disabled={!canSend}>Send</button>
        ) : (
          <button type="button" className="stop-button" onClick={handleStop}>Stop</button>
        )}
      </form>
      {errorMessage && (<div className="error-banner" role="alert">{errorMessage}</div>)}
    </div>
  );
};

export default Chat;
