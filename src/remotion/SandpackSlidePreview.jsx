import { memo, useEffect } from 'react'
import { SandpackProvider, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react'

function toSandpackFiles(files) {
  const out = {}
  for (const [path, code] of Object.entries(files)) {
    out[path] = typeof code === 'string'
      ? { code, hidden: !path.endsWith('App.tsx') }
      : code
  }
  return out
}

function SandpackErrorOverlay() {
  const { sandpack } = useSandpack()

  useEffect(() => {
    if (sandpack.error) {
      console.error('[Sandpack] compile error:', sandpack.error)
    }
    console.log('[Sandpack] status:', sandpack.status)
  }, [sandpack.error, sandpack.status])

  if (!sandpack.error) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#1a0000',
        color: '#fca5a5',
        padding: 16,
        fontSize: 11,
        fontFamily: 'monospace',
        overflow: 'auto',
        zIndex: 30,
      }}
    >
      <strong>Sandpack error</strong>
      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{sandpack.error.message}</pre>
    </div>
  )
}

/**
 * Isolated from Remotion frame updates — must stay memoized so Sandpack's iframe
 * isn't destroyed on every useCurrentFrame() tick (30fps).
 */
const SandpackSlidePreview = memo(function SandpackSlidePreview({ sandpack }) {
  const dependencies = {
    ...sandpack.dependencies,
    react: '^18.2.0',
    'react-dom': '^18.2.0',
  }

  return (
    <SandpackProvider
      template={sandpack.template ?? 'react-ts'}
      files={toSandpackFiles(sandpack.files)}
      customSetup={{ dependencies }}
      theme="dark"
      options={{
        externalResources: ['https://cdn.tailwindcss.com'],
        autorun: true,
        recompileMode: 'delayed',
        recompileDelay: 300,
      }}
    >
      <SandpackErrorOverlay />
      <SandpackPreview
        showNavigator={false}
        showOpenInCodeSandbox={false}
        showRefreshButton={false}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 360,
          border: 'none',
          background: '#101010',
        }}
      />
    </SandpackProvider>
  )
})

export default SandpackSlidePreview
