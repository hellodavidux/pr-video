import { memo, useMemo } from 'react'
import * as React from 'react'
import { LiveProvider, LivePreview, LiveError } from 'react-live'
import * as LucideIcons from 'lucide-react'

const LiveSlidePreview = memo(function LiveSlidePreview({ preview }) {
  const scope = useMemo(() => {
    const iconScope = {}
    for (const name of preview.lucideIcons ?? []) {
      if (LucideIcons[name]) iconScope[name] = LucideIcons[name]
    }
    return {
      React,
      useState: React.useState,
      useEffect: React.useEffect,
      useMemo: React.useMemo,
      useCallback: React.useCallback,
      useRef: React.useRef,
      Fragment: React.Fragment,
      ...iconScope,
    }
  }, [preview.lucideIcons])

  return (
    <LiveProvider code={preview.code} scope={scope} noInline language="tsx">
      {preview.styles && <style dangerouslySetInnerHTML={{ __html: preview.styles }} />}
      <div style={{ width: '100%', height: '100%', minHeight: 360, background: '#101010', overflow: 'auto' }}>
        <LivePreview style={{ padding: 0, margin: 0 }} />
        <LiveError
          style={{
            color: '#fca5a5',
            background: '#1a0000',
            padding: 12,
            fontSize: 11,
            fontFamily: 'monospace',
          }}
        />
      </div>
    </LiveProvider>
  )
})

export default LiveSlidePreview
