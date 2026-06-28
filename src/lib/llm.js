export async function callLLM({ system, user, maxTokens = 1000 }) {
  const key = import.meta.env.VITE_ANTHROPIC_KEY
  if (!key) throw new Error('Missing VITE_ANTHROPIC_KEY — get a key at console.anthropic.com')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Anthropic API error: ${res.status} ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return data.content[0].text.trim()
}
