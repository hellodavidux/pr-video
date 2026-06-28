/**
 * Node-compatible Anthropic client for pipeline scripts.
 */
export async function callNodeLLM({ system, user, maxTokens = 4096, apiKey }) {
  const key = apiKey ?? process.env.VITE_ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error('Missing VITE_ANTHROPIC_KEY or ANTHROPIC_API_KEY')
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
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

export function stripCodeFences(text) {
  return String(text ?? '')
    .trim()
    .replace(/^```(?:tsx?|jsx?)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}
