// Chat API abstraction
// Relies on central apiClient. Handles chat requests to the /chat endpoint.

import { apiClient } from './client';

const CHAT_PATH = '/chat';

export async function sendChatMessage(messages, options = {}) {
  const requestBody = {
    messages: messages.map(({ role, content }) => ({ role, content })),
    ...options
  };

  try {
    const data = await apiClient.request('POST', CHAT_PATH, { body: requestBody });
    return {
      content: data.content || '',
      summary: data.summary || '',
      citations: Array.isArray(data.citations) ? data.citations : [],   
      ...data
    };
  } catch (error) {
    console.error('Chat API error:', error);
    throw new Error(error.message || 'Failed to get chat response');
  }
}

export async function sendChatMessageWithStream(messages, onChunk, options = {}) {
  const requestBody = {
    messages: messages.map(({ role, content }) => ({ role, content })),
    stream: true,
    ...options
  };

  try {
    const url = apiClient.buildUrl(CHAT_PATH);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onChunk(data);
          } catch (e) {
            // Skip invalid JSON if it happens
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming chat API error:', error);
    throw new Error(error.message || 'Failed to get streaming chat response');
  }
}
