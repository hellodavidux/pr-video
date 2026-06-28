import { transform } from '@babel/standalone'
import { generateImportStubs } from './importStubs'

function extractComponentName(source) {
  const patterns = [
    /export\s+default\s+function\s+(\w+)/,
    /export\s+default\s+class\s+(\w+)/,
    /export\s+default\s+(\w+)/,
    /export\s+function\s+(\w+)/,
    /function\s+(\w+)\s*\(/,
    /const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/,
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match?.[1] && match[1] !== 'default') return match[1]
  }

  return 'Component'
}

function stripForPreview(source) {
  return source
    .replace(/^import\s+type\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^import\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^export\s+default\s+/, '')
    .replace(/^export\s+(?=function|const|class)/gm, '')
    .replace(/^'use client';?\s*$/gm, '')
    .replace(/^"use client";?\s*$/gm, '')
    .trim()
}

export function prepareComponentPreview(source, filename) {
  if (!source) {
    return { previewCode: null, componentName: null, canPreview: false, error: 'Source not loaded' }
  }

  const componentName = extractComponentName(source)
  const stubs = generateImportStubs(source, componentName)
  const stripped = stripForPreview(source)
  const previewSource = [stubs, stripped].filter(Boolean).join('\n\n')

  try {
    const transformed = transform(previewSource, {
      presets: ['react', 'typescript'],
      filename,
    }).code

    const previewCode = `${transformed}
const __previewProps = {};
render(<${componentName} {...__previewProps} />);`

    return { previewCode, componentName, canPreview: true, error: null }
  } catch (err) {
    return {
      previewCode: null,
      componentName,
      canPreview: false,
      error: err.message,
    }
  }
}
