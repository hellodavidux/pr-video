import { useEffect, useMemo, useState } from 'react'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { LiveProvider, LivePreview, LiveError } from 'react-live'
import * as LucideIcons from 'lucide-react'
import { fetchPRFiles, fetchSourceBundle } from './lib/fetchSource.js'
import { discoverComponents } from './lib/buildSandbox.js'
import { bundleForLive, collectClosure } from './lib/bundleForLive.js'

async function main() {
  const changed = await fetchPRFiles('hellodavidux', 'cal-simple', 1, '9c554990f85ce9a88ccefe33c65bcce95c642ae3')
  const bundle = await fetchSourceBundle('hellodavidux', 'cal-simple', '9c554990f85ce9a88ccefe33c65bcce95c642ae3', changed)
  const components = discoverComponents(bundle.files)
  const component = components.find((c) => c.name === 'TeamAvailabilityTable') ?? components[0]
  const closure = collectClosure(bundle.files, component.path)
  const live = bundleForLive(closure, component)

  function Test() {
    const scope = useMemo(() => {
      const iconScope = {}
      for (const name of live.lucideIcons) {
        if (LucideIcons[name]) iconScope[name] = LucideIcons[name]
      }
      return { React, useState: React.useState, useEffect: React.useEffect, ...iconScope }
    }, [])

    return (
      <LiveProvider code={live.code} scope={scope} noInline language="tsx">
        <style>{`.bg-cal-bg{background:#101010}.text-cal-muted{color:#a1a1aa}.border-cal-border{border-color:#2a2a2a}.text-white{color:#fff}body{color:#fafafa}`}</style>
        <LivePreview />
        <LiveError style={{ color: 'red', padding: 16 }} />
      </LiveProvider>
    )
  }

  createRoot(document.getElementById('root')).render(<Test />)
}

main().catch(console.error)
