import { useContext } from 'react'

import { LiveContext, LivePreview, LiveProvider } from 'react-live'

import { liveScope } from '../../lib/liveScope.jsx'

import { CodeChangeVisual } from './CodeChangeVisual'



function StyleInjector({ css }) {

  if (!css) return null

  return <style dangerouslySetInnerHTML={{ __html: css }} />

}



function LivePreviewGate({ fallback, size }) {

  const ctx = useContext(LiveContext)



  if (ctx?.error) {

    return fallback

  }



  return (

    <div style={{ width: '100%', maxWidth: size === 'lg' ? 720 : 420 }}>

      <LivePreview />

    </div>

  )

}



export function ComponentPreviewVisual({

  previewCode,

  filename,

  canPreview,

  highlightLines,

  status,

  injectedCss,

  size = 'sm',

}) {

  const tabSize = size === 'lg' ? 16 : 11



  const codeFallback = (

    <CodeChangeVisual

      filename={filename}

      highlightLines={highlightLines ?? []}

      status={status ?? 'modified'}

      size={size}

    />

  )



  if (!canPreview || !previewCode) {

    return codeFallback

  }



  return (

    <div

      style={{

        width: '100%',

        height: '100%',

        background: '#0d0f12',

        borderRadius: size === 'lg' ? 20 : 16,

        border: '1px solid #2e3138',

        overflow: 'hidden',

        display: 'flex',

        flexDirection: 'column',

      }}

    >

      <div

        style={{

          padding: size === 'lg' ? '14px 20px' : '10px 14px',

          background: '#111318',

          borderBottom: '1px solid #2e3138',

          fontSize: tabSize,

          color: '#afa9ec',

          fontFamily: 'ui-monospace, monospace',

        }}

      >

        {filename}

      </div>

      <div

        style={{

          flex: 1,

          minHeight: 0,

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'center',

          padding: size === 'lg' ? 32 : 16,

          background: 'linear-gradient(160deg, #12141c 0%, #0b0c10 100%)',

        }}

      >

        <LiveProvider

          code={previewCode}

          scope={liveScope}

          noInline

          language="tsx"

          enableTypeScript

        >

          <StyleInjector css={injectedCss} />

          <LivePreviewGate fallback={codeFallback} size={size} />

        </LiveProvider>

      </div>

    </div>

  )

}


