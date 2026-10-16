#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename, extname, dirname } from 'node:path';
import { parseDiagram } from './parser.js';
import { layoutAll } from './layout.js';
import { renderHtml } from './html.js';
import { renderPerspectivePng } from './png.js';

const program = new Command();

program
  .name('archgraph')
  .description('Render Ilograph-style YAML to a single self-contained HTML file.')
  .version('0.0.1');

program
  .command('render')
  .description('Render a diagram YAML into HTML (and optionally PNG).')
  .argument('<input>', 'path to .ilograph or .yaml file')
  .option('-o, --output <path>', 'output HTML path (default: <input>.html)')
  .option('--png', 'also write a .png next to the HTML')
  .option('--png-scale <n>', 'PNG zoom factor (default: 2)', '2')
  .action(async (input: string, opts: { output?: string; png?: boolean; pngScale?: string }) => {
    const inputPath = resolve(input);
    const source = readFileSync(inputPath, 'utf8');

    process.stderr.write(`archgraph: parsing ${inputPath}\n`);
    const diagram = parseDiagram(source);
    process.stderr.write(
      `archgraph: ${countResources(diagram.resources)} resources, ${diagram.perspectives.length} perspectives\n`,
    );

    process.stderr.write(`archgraph: laying out…\n`);
    const positioned = await layoutAll(diagram);
    for (const p of positioned) {
      process.stderr.write(
        `archgraph:   "${p.name}": ${p.width.toFixed(0)}×${p.height.toFixed(0)} (${p.edges.length} edges)\n`,
      );
    }

    process.stderr.write(`archgraph: rendering HTML…\n`);
    const html = renderHtml(diagram, positioned);

    const inputBase = basename(inputPath).replace(/\.(yaml|yml|ilograph)$/i, '');
    const outDir = opts.output ? dirname(resolve(opts.output)) : dirname(inputPath);
    const outPath = opts.output
      ? resolve(opts.output)
      : resolve(outDir, inputBase + '.html');
    writeFileSync(outPath, html, 'utf8');
    process.stderr.write(`archgraph: wrote ${outPath} (${(html.length / 1024).toFixed(1)} kB)\n`);

    if (opts.png) {
      process.stderr.write(`archgraph: rendering PNG…\n`);
      const scale = Number(opts.pngScale ?? 2);
      const pngBase = outPath.replace(/\.html$/i, '');
      for (const p of positioned) {
        const buf = renderPerspectivePng(p, scale);
        const slug = p.name.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '');
        const pngPath =
          positioned.length === 1
            ? `${pngBase}.png`
            : `${pngBase}.${slug}.png`;
        writeFileSync(pngPath, buf);
        process.stderr.write(
          `archgraph: wrote ${pngPath} (${(buf.length / 1024).toFixed(1)} kB)\n`,
        );
      }
    }
  });

function countResources(resources: { children: { children: unknown[] }[] }[]): number {
  let n = 0;
  function walk(rs: any[]): void {
    for (const r of rs) {
      n++;
      walk(r.children ?? []);
    }
  }
  walk(resources);
  return n;
}

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`archgraph: ERROR — ${err.message}\n`);
  if (process.env.ARCHGRAPH_DEBUG) {
    process.stderr.write(String(err.stack) + '\n');
  }
  process.exit(1);
});
