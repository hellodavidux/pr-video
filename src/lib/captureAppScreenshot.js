function normalizeAppUrl(url) {
  const trimmed = url.trim()
  if (!trimmed) throw new Error('App URL is required')
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(withProtocol)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('App URL must be http or https')
  }
  return parsed.href.replace(/\/$/, '')
}

function thumIoScreenshotUrl(appUrl) {
  return `https://image.thum.io/get/width/1280/crop/720/noanimate/${appUrl}`
}

async function microlinkScreenshot(appUrl) {
  const res = await fetch(
    `https://api.microlink.io/?url=${encodeURIComponent(appUrl)}&screenshot=true&meta=false`
  )
  if (!res.ok) return null
  const json = await res.json()
  return json.data?.screenshot?.url ?? null
}

export async function captureAppScreenshots(appUrlInput) {
  const appUrl = normalizeAppUrl(appUrlInput)
  const screenshots = []

  const microlinkUrl = await microlinkScreenshot(appUrl).catch(() => null)
  if (microlinkUrl) {
    screenshots.push({ url: microlinkUrl, label: 'App home', source: appUrl })
  } else {
    screenshots.push({
      url: thumIoScreenshotUrl(appUrl),
      label: 'App home',
      source: appUrl,
    })
  }

  return { appUrl, screenshots }
}
