/* Import a delivered harness capture bundle into the checked-in Tests corpus.

   Usage:
     node scripts/importHarnessStreamTests.mjs /path/to/capture-folder

   The delivery README remains the source of the exact prompts. Raw reasoning
   token chunks are deliberately excluded: they are developer-only chain of
   thought, are ignored by the semantic adapter, and can dominate capture
   size without affecting tools, timestamps, visible copy, or final output. */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error('Provide the delivered capture folder.');
  process.exit(1);
}

const sourceDir = resolve(sourceArg);
const targetDir = resolve('scripts/fixtures/harness-stream/tests');
const readme = readFileSync(join(sourceDir, 'README.txt'), 'utf8');

function promptsFromReadme(text) {
  const prompts = {};
  const headings = [...text.matchAll(/^Q([0-9]{2})  \([^\n]+\)$/gm)];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const id = `q${heading[1]}`;
    const sectionEnd = headings[index + 1]?.index ?? text.length;
    const section = text.slice(heading.index, sectionEnd);
    const query = section.match(/\nquery:\n([\s\S]*?)\n\nfile\s+:/)?.[1];
    if (!query) throw new Error(`Could not read the query for ${id} from README.txt`);
    prompts[id] = query
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ');
  }

  return prompts;
}

const manifest = promptsFromReadme(readme);
const files = readdirSync(sourceDir).filter((file) => /^q[0-9]{2}_events\.json$/.test(file)).sort();

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const id = basename(file, '_events.json');
  if (!manifest[id]) throw new Error(`No README prompt found for ${id}`);
  const events = JSON.parse(readFileSync(join(sourceDir, file), 'utf8'));
  const consumerRelevantEvents = events.filter((event) => event?.type !== 'reasoning');
  writeFileSync(join(targetDir, file), `${JSON.stringify(consumerRelevantEvents, null, 2)}\n`, 'utf8');
  console.log(`${id}: ${events.length} raw -> ${consumerRelevantEvents.length} checked-in events`);
}

if (files.length !== Object.keys(manifest).length) {
  throw new Error(`README contains ${Object.keys(manifest).length} prompts but ${files.length} event files were found`);
}

writeFileSync(join(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
writeFileSync(
  join(targetDir, 'README.md'),
  [
    '# Harness stream tests',
    '',
    'Twenty real `/internal/v1/turns` captures delivered on 2026-08-24.',
    'Prompts are copied verbatim from the delivery README.',
    '',
    'Only raw `reasoning` token chunks are omitted. Tool events, insights,',
    'timestamps, interim/final text, errors, and turn completion are preserved.',
    'The application never consumes or renders raw chain-of-thought content.',
    '',
  ].join('\n'),
  'utf8'
);

console.log(`Imported ${files.length} test captures into ${targetDir}`);
