#!/usr/bin/env node
/**
 * Re-apply demoState patches to pr-live slide sources (fixes broken prior patches).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { patchGenericDemoSource } from '../src/lib/patchGenericDemo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PR_LIVE_DIR = path.resolve(__dirname, '../src/remotion/pr-live')

function stripMarker(source) {
  return source.replace(/^\/\* __PR_GENERIC_DEMO__ \*\/\n?/, '')
}

function repairFile(filePath) {
  const base = path.basename(filePath).replace(/\.[^.]+$/, '')
  if (base === 'entry') return false

  const raw = fs.readFileSync(filePath, 'utf8')
  const source = stripMarker(raw)
  const repaired = patchGenericDemoSource(source, base)
  if (repaired === source && !raw.includes('__PR_GENERIC_DEMO__')) return false
  if (repaired === raw) return false

  fs.writeFileSync(filePath, repaired, 'utf8')
  return true
}

function walk(dir) {
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      count += walk(full)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      if (repairFile(full)) {
        console.log('repaired', path.relative(PR_LIVE_DIR, full))
        count += 1
      }
    }
  }
  return count
}

if (!fs.existsSync(PR_LIVE_DIR)) {
  console.log('No pr-live directory — nothing to repair.')
  process.exit(0)
}

const repaired = walk(PR_LIVE_DIR)
console.log(`Done. Repaired ${repaired} file(s).`)
