const BUILTIN_NAMES = new Set([
  'React',
  'useState',
  'useEffect',
  'useMemo',
  'useCallback',
  'useRef',
  'useContext',
  'useLayoutEffect',
  'useId',
  'useReducer',
  'useImperativeHandle',
  'useDebugValue',
  'Fragment',
  'Children',
  'forwardRef',
  'memo',
  'createContext',
  'Suspense',
  'StrictMode',
])

export function parseImportBindings(source) {
  const bindings = []
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const regex = /import\s+(?!type\s)([^;\n]+?)\s+from\s+['"]([^'"]+)['"]/g

  let match
  while ((match = regex.exec(withoutBlockComments)) !== null) {
    const clause = match[1].trim()
    const module = match[2]

    if (clause.startsWith('*')) {
      const ns = clause.match(/\*\s+as\s+(\w+)/)
      if (ns) bindings.push({ local: ns[1], kind: 'namespace', module })
      continue
    }

    const segments = clause.split(',')
    for (const segment of segments) {
      const part = segment.trim()
      if (!part) continue

      if (part.startsWith('{')) {
        const inner = part.replace(/^\{/, '').replace(/\}$/, '').trim()
        if (!inner) continue
        for (const item of inner.split(',')) {
          const pieces = item.trim().split(/\s+as\s+/)
          const local = (pieces[1] ?? pieces[0]).trim()
          if (local) bindings.push({ local, kind: 'named', module })
        }
      } else {
        bindings.push({ local: part, kind: 'default', module })
      }
    }
  }

  return bindings
}

function isStyleModule(module) {
  return /\.(css|scss|sass|less)(\?|$)/i.test(module) || module.includes('.module')
}

function stubComponent(name) {
  return `function ${name}({ children, ...props }) {
  return (
    <div
      style={{
        padding: 10,
        border: '1px dashed #3a3f4b',
        borderRadius: 8,
        color: '#9aa0a6',
        fontSize: 12,
        background: 'rgba(255,255,255,0.03)',
      }}
      {...props}
    >
      {children ?? '${name}'}
    </div>
  );
}`
}

function stubNamespace(name) {
  return `const ${name} = new Proxy(
  {},
  {
    get: (_, prop) => {
      const label = String(prop);
      return ({ children, ...props }) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            border: '1px dashed #3a3f4b',
            borderRadius: 6,
            fontSize: 11,
            color: '#9aa0a6',
          }}
          {...props}
        >
          {children ?? label}
        </span>
      );
    },
  }
);`
}

function stubUtility(name) {
  return `const ${name} = (...args) => args.flat().filter(Boolean).join(' ');`
}

function stubStyleModule(name) {
  return `const ${name} = new Proxy({}, { get: (_, key) => 'pv-' + String(key) });`
}

function stubHook(name) {
  return `const ${name} = () => new Proxy({}, { get: () => () => undefined });`
}

function stubGeneric(name) {
  if (/^use[A-Z]/.test(name)) return stubHook(name)
  if (/^[A-Z]/.test(name)) return stubComponent(name)
  return stubUtility(name)
}

export function generateImportStubs(source, componentName) {
  const bindings = parseImportBindings(source)
  const seen = new Set()
  const stubs = []

  for (const { local, kind, module } of bindings) {
    if (!local || local === componentName || BUILTIN_NAMES.has(local) || seen.has(local)) continue
    seen.add(local)

    if (kind === 'namespace') {
      stubs.push(stubNamespace(local))
      continue
    }

    if (isStyleModule(module)) {
      stubs.push(stubStyleModule(local))
      continue
    }

    stubs.push(stubGeneric(local))
  }

  return stubs.join('\n\n')
}
