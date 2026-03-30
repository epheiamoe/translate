export interface LLMResponse {
  content: string;
  thinking?: string;
  error?: string;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onThinking?: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export async function streamTranslate(
  apiBaseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  supportsThinking: boolean,
  callbacks: StreamCallbacks
): Promise<void> {
  const url = `${apiBaseUrl}/chat/completions`;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    stream: true
  };

  if (supportsThinking) {
    requestBody.extra_body = {
      thinking: {
        type: 'enabled',
        budget_tokens: 1000
      }
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let thinkingBuffer = '';
    let inThinkingBlock = false;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        continue;
      }
      
      if (trimmedLine === 'data: [DONE]') {
        callbacks.onDone();
        return;
      }

      if (!trimmedLine.startsWith('data: ')) {
        continue;
      }

      const jsonStr = trimmedLine.slice(6);

      try {
        const data = JSON.parse(jsonStr);
        
        if (supportsThinking && data.choices?.[0]?.delta?.thinking) {
          inThinkingBlock = true;
          thinkingBuffer += data.choices[0].delta.thinking;
          callbacks.onThinking?.(thinkingBuffer);
        } else if (data.choices?.[0]?.delta?.content) {
          if (inThinkingBlock && callbacks.onThinking) {
            callbacks.onThinking(thinkingBuffer);
            inThinkingBlock = false;
            thinkingBuffer = '';
          }
          callbacks.onChunk(data.choices[0].delta.content);
        }
      } catch {
        // Skip malformed JSON
      }
    }
    }

    callbacks.onDone();
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function detectLanguage(
  apiBaseUrl: string,
  apiKey: string,
  prompt: string
): Promise<string> {
  const url = `${apiBaseUrl}/chat/completions`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Detection API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (typeof content === 'string') {
    const match = content.match(/^[a-z]{2}(-[A-Z]{2})?/);
    if (match) {
      return match[0].toLowerCase();
    }
  }
  
  return 'en';
}