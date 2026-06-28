function stripFences(text) {
  return String(text ?? '')
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}

function extractObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return text
  return text.slice(start, end + 1)
}

function removeTrailingCommas(json) {
  return json.replace(/,\s*([}\]])/g, '$1')
}

function repairSmartQuotes(json) {
  return json.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'")
}

/**
 * Fix LLM output where string values contain unescaped double quotes,
 * e.g. "description": "Click "+ New" on AvailabilityPage"
 */
function repairUnescapedQuotesInStrings(json) {
  let out = ''
  let i = 0

  while (i < json.length) {
    if (json[i] !== '"') {
      out += json[i]
      i += 1
      continue
    }

    out += '"'
    i += 1
    let content = ''

    while (i < json.length) {
      if (json[i] === '\\') {
        content += json.slice(i, i + 2)
        i += 2
        continue
      }

      if (json[i] === '"') {
        const next = json.slice(i + 1).match(/^\s*(.)/)?.[1]
        if (!next || next === ',' || next === '}' || next === ']' || next === ':') {
          out += content
          out += '"'
          i += 1
          break
        }
        content += "'"
        i += 1
        continue
      }

      content += json[i]
      i += 1
    }
  }

  return out
}

/**
 * LLM responses often hit max_tokens and cut off mid-string.
 * Trim the dangling fragment and close open brackets.
 */
function salvageTruncatedJson(json) {
  let s = json.trim()

  s = s.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/s, '')
  s = s.replace(/,\s*\{[^}]*$/s, '')
  s = s.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/s, '')

  if ((s.match(/"/g) ?? []).length % 2 === 1) {
    s += '"'
  }

  const stack = []
  let inString = false
  let escaped = false

  for (const c of s) {
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (c === '\\') {
        escaped = true
        continue
      }
      if (c === '"') inString = false
      continue
    }

    if (c === '"') {
      inString = true
      continue
    }
    if (c === '{' || c === '[') stack.push(c)
    if (c === '}' && stack[stack.length - 1] === '{') stack.pop()
    if (c === ']' && stack[stack.length - 1] === '[') stack.pop()
  }

  while (stack.length) {
    const open = stack.pop()
    s += open === '{' ? '}' : ']'
  }

  return s
}

function errorContext(json, err) {
  const pos = Number(err.message.match(/position (\d+)/)?.[1])
  if (!Number.isFinite(pos)) return ''
  const start = Math.max(0, pos - 60)
  const end = Math.min(json.length, pos + 60)
  return `\nNear position ${pos}:\n${json.slice(start, end)}`
}

/**
 * Parse JSON from an LLM text response with fence stripping and common repairs.
 */
export function parseLLMJson(text, context = 'LLM response') {
  const raw = removeTrailingCommas(repairSmartQuotes(extractObject(stripFences(text))))

  const candidates = [
    raw,
    repairUnescapedQuotesInStrings(raw),
    salvageTruncatedJson(raw),
    salvageTruncatedJson(repairUnescapedQuotesInStrings(raw)),
  ]

  let lastErr = null
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch (err) {
      lastErr = err
    }
  }

  throw new Error(`${context}: ${lastErr?.message ?? 'invalid JSON'}${errorContext(raw, lastErr ?? {})}`)
}
