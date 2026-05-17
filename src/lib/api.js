const BASE_URL = '/api/run'
const MODEL = 'deepseek-ai/deepseek-v4-pro'

export async function streamCompletion({
  messages,
  onChunk,
  onDone,
  onError,
  maxTokens = 4096,
  temperature = 0.7,
}) {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        msg = err?.error || msg
      } catch { }
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
        } catch { }
      }
    }

    onDone()
  } catch (err) {
    onError(err?.message || 'Network error')
  }
}

export async function complete({ messages, maxTokens = 256 }) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
    throw new Error(err?.error || `HTTP ${response.status}`)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}

export function safeParseJSON(text) {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}