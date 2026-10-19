import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parseScheme, renderScheme, schemeToHtml } from './scheme.ts';

const PAGES_DIR = new URL('../../docs/game/pages/', import.meta.url);

const sample = `
size 490x200
node panel 10,20 "Солнечная панель" "до 20 rW, потребляет 0, стоит на крыше" out: Power Out
node bat 300,20 w=180 "Батарея" in: Power In, Toggle out: Power Out, Branch
wire panel.Power Out -> bat.Power In "20"
pipe bat.Branch -> bat.Toggle
note 10,170 "строка 1\\nстрока 2"
`;

test('parseScheme reads size, nodes with ports, links and notes', () => {
  const s = parseScheme(sample);
  assert.equal(s.width, 490);
  assert.deepEqual(s.nodes.map(n => n.id), ['panel', 'bat']);
  assert.equal(s.nodes[0].sub, 'до 20 rW, потребляет 0, стоит на крыше');
  assert.equal(s.nodes[1].w, 180);
  assert.ok(s.nodes[0].w > 160, 'узел расширяется под длинную подпись');
  assert.deepEqual(s.nodes[1].ins, ['Power In', 'Toggle']);
  assert.deepEqual(s.nodes[1].outs, ['Power Out', 'Branch']);
  assert.deepEqual(s.links[0], { kind: 'wire', from: 'panel', fromPort: 'Power Out', to: 'bat', toPort: 'Power In', label: '20' });
  assert.equal(s.links[1].label, '');
  assert.deepEqual(s.notes[0].lines, ['строка 1', 'строка 2']);
});

test('parseScheme rejects unknown ports, nodes, lines and out-of-bounds nodes', () => {
  assert.throws(() => parseScheme(sample.replace('-> bat.Power In', '-> bat.Power')), /нет входа «Power»/);
  assert.throws(() => parseScheme(sample.replace('panel.Power Out ->', 'sun.Power Out ->')), /нет узла «sun»/);
  assert.throws(() => parseScheme(sample + 'link a -> b'), /не понял/);
  assert.throws(() => parseScheme(sample.replace('300,20 w=180', '120,40')), /налезают/);
  assert.throws(() => parseScheme('size 10x10'), /нет узлов/);
});

test('renderScheme draws every node, link and escapes text', () => {
  const svg = renderScheme(parseScheme(sample.replace('"Батарея"', '"A<B"')));
  assert.ok(svg.startsWith('<svg'));
  assert.equal(svg.match(/class="sch-node"/g)?.length, 2);
  assert.equal(svg.match(/class="sch-link sch-link--(wire|pipe)" d="M\d/g)?.length, 2);
  assert.ok(svg.includes('A&lt;B'));
  assert.ok(svg.includes('>электричество<') && svg.includes('>вода<'), 'легенда по видам связей');
  assert.match(schemeToHtml('мусор'), /sch-error/);
  const width = Number(svg.match(/width="(\d+(?:\.\d+)?)"/)![1]);
  assert.ok(width > 490, 'холст растёт под обратную связь справа');
});

test('all scheme blocks in documentation pages are valid', () => {
  const errors: string[] = [];
  let count = 0;
  for (const f of readdirSync(PAGES_DIR).filter(f => f.endsWith('.md'))) {
    const md = readFileSync(new URL(f, PAGES_DIR), 'utf8');
    for (const m of md.matchAll(/```scheme\n([\s\S]*?)```/g)) {
      count++;
      try {
        parseScheme(m[1]);
      } catch (e) {
        errors.push(`${f}: ${(e as Error).message}`);
      }
    }
  }
  assert.deepEqual(errors, []);
  assert.ok(count >= 5, `схем найдено: ${count}`);
});
