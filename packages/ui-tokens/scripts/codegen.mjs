import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssPath = path.join(__dirname, '../src/theme.css')
const outPath = path.join(__dirname, '../src/tokens.cjs')

const css = readFileSync(cssPath, 'utf8')

function extractVarsFromBlock(blockContent) {
  const vars = {}
  for (const line of blockContent.split('\n')) {
    const m = line.match(/^\s*--([\w-]+):\s*([^;]+);/)
    if (m) vars[m[1]] = m[2].trim()
  }
  return vars
}

const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
const darkMatch = css.match(/\.dark\s*\{([^}]+)\}/)

const light = rootMatch ? extractVarsFromBlock(rootMatch[1]) : {}
const dark = darkMatch ? extractVarsFromBlock(darkMatch[1]) : {}

const colors = {}
for (const [key, value] of Object.entries(light)) {
  colors[key] = { DEFAULT: value }
  if (dark[key]) colors[key].dark = dark[key]
}

const output = `module.exports = ${JSON.stringify({ colors }, null, 2)};\n`
writeFileSync(outPath, output)
console.log(`tokens.cjs written with ${Object.keys(colors).length} colors`)
