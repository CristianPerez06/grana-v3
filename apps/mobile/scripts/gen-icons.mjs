#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const assets = resolve(here, '..', 'assets')

const isotype = await readFile(resolve(assets, 'grana-isotype.svg'))
const wordmark = await readFile(resolve(assets, 'grana-wordmark.svg'))

const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

const targets = [
  { name: 'icon.png', svg: isotype, size: 1024, flatten: '#10B981' },
  { name: 'adaptive-icon.png', svg: isotype, size: 1024, scale: 0.7 },
  { name: 'splash-icon.png', svg: wordmark, size: 1024, scale: 0.75 },
  { name: 'favicon.png', svg: isotype, size: 64 },
]

for (const t of targets) {
  const out = resolve(assets, t.name)
  const inner = Math.round(t.size * (t.scale ?? 1))
  const pad = Math.round((t.size - inner) / 2)
  let pipeline = sharp(t.svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: transparent })
  if (pad > 0) {
    pipeline = pipeline.extend({ top: pad, bottom: pad, left: pad, right: pad, background: transparent })
  }
  if (t.flatten) pipeline = pipeline.flatten({ background: t.flatten })
  await pipeline.png().toFile(out)
  console.log(`wrote ${t.name} (${t.size}×${t.size})`)
}
