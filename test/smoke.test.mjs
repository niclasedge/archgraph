import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDiagram } from '../dist/parser.js';
import { layoutAll } from '../dist/layout.js';
import { renderHtml } from '../dist/html.js';

const example = readFileSync(new URL('../examples/ai-assistant.yaml', import.meta.url), 'utf8');

test('example parses into several perspectives', () => {
  const d = parseDiagram(example);
  assert.ok(d.perspectives.length >= 2);
  assert.ok(d.resources.length > 0);
});

test('relation to an unknown resource is rejected', () => {
  const bad = 'resources:\n  - name: A\nperspectives:\n  - name: P\n    relations:\n      - from: A\n        to: Nowhere\n';
  assert.throws(() => parseDiagram(bad), /unknown 'to' resource "Nowhere"/);
});

test('a perspective only lays out the resources it uses', async () => {
  const d = parseDiagram(example);
  const [request, knowledge] = await layoutAll(d);
  const names = (rs) => rs.flatMap((r) => [r.name, ...names(r.children)]);
  assert.ok(names(request.resources).includes('Retriever'));
  assert.ok(!names(knowledge.resources).includes('Retriever'));
});

test('HTML output is a single file with one tab per perspective', async () => {
  const d = parseDiagram(example);
  const html = renderHtml(d, await layoutAll(d));
  assert.equal((html.match(/class="ag-tab/g) ?? []).length, d.perspectives.length);
});
