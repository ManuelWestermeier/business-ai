const BASE_URL = 'https://corsproxy.io/?url=https://integrate.api.nvidia.com/v1'
const MODEL = 'deepseek-ai/deepseek-v4-pro'

/**
 * Stream a chat completion from NVIDIA DeepSeek API.
 * @param {Object} opts
 * @param {string} opts.apiKey
 * @param {Array}  opts.messages  - [{role, content}]
 * @param {Function} opts.onChunk - called with each text chunk
 * @param {Function} opts.onDone  - called when stream ends
 * @param {Function} opts.onError - called with error string
 * @param {number}  [opts.maxTokens=4096]
 * @param {number}  [opts.temperature=0.7]
 */
export async function streamCompletion({
  apiKey,
  messages,
  onChunk,
  onDone,
  onError,
  maxTokens = 4096,
  temperature = 0.7,
}) {
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        top_p: 0.95,
        max_tokens: maxTokens,
        stream: true,
        chat_template_kwargs: { thinking: false },
      }),
    })

    if (!response.ok) {
      let msg = `HTTP ${response.status}`
      try {
        const err = await response.json()
        msg = err?.error?.message || msg
      } catch { /* ignore */ }
      onError(msg)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6).trim()
        if (payload === '[DONE]') {
          onDone()
          return
        }
        try {
          const json = JSON.parse(payload)
          const content = json?.choices?.[0]?.delta?.content
          if (content) onChunk(content)
        } catch { /* skip malformed chunks */ }
      }
    }

    onDone()
  } catch (err) {
    onError(err?.message || 'Network error')
  }
}

/**
 * Simple one-shot completion (non-streaming) for validation.
 */
export async function complete({ apiKey, messages, maxTokens = 256 }) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      stream: false,
      chat_template_kwargs: { thinking: false },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${response.status}`)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}

/**
 * Parse JSON safely, stripping markdown fences.
 */
export function safeParseJSON(text) {
  try {
    // strip ```json fences
    const cleaned = text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}
