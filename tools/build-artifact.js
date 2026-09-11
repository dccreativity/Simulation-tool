#!/usr/bin/env node
/* Derive the Artifact page from index.html.
 *
 * index.html is a complete standalone document so the tool works from a plain
 * file:// open or any static host. The Artifact platform supplies its own
 * <head>/<body> wrapper, so the published page is the same file with that
 * wrapper stripped and the <title> and font <link> hoisted to the top.
 *
 *   node tools/build-artifact.js [outfile]
 */

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const out = process.argv[2] || path.join(__dirname, '..', 'dist', 'artifact-page.html');

const pick = (re) => { const m = src.match(re); return m ? m[0] : ''; };
const title = pick(/<title>[\s\S]*?<\/title>/i);
const fontLinks = (src.match(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>/gi) || []).join('\n');
const cssLink = pick(/<link[^>]*href="styles\.css"[^>]*>/i);
const body = pick(/<body[^>]*>[\s\S]*<\/body>/i)
  .replace(/^<body[^>]*>\s*/i, '')
  .replace(/\s*<\/body>$/i, '');

if (!title || !body) {
  console.error('build-artifact: could not find <title> or <body> in index.html');
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, [title, fontLinks, cssLink, '', body, ''].join('\n'));
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} kB)`);
