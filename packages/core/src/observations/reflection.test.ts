import { describe, expect, it } from 'vitest';
import {
  legacyReflectionLineIndexes,
  parseReflectionMarker,
  reflectionId,
  renderReflectionMarker,
} from './reflection.ts';
import { sha256 } from '../store/ids.ts';

const payload =
  '- 2037-04-11 — The recorded service checks have explicit completion status. [[topics/service]]';
const evidence = ['1111', '2222', '3333'].map((id) => ({
  observationId: `obs_invented_${id}`,
  markerHash: 'a'.repeat(64),
  payloadHash: 'b'.repeat(64),
}));
const marker = {
  id: reflectionId(evidence, payload),
  payloadHash: sha256(payload),
  scopeAssessment: 'c'.repeat(64),
  evidence,
};
const envelope =
  '---\ntitle: Principles\nderived: true\n---\n\n# Principles\n\nPatterns Akno inferred from pages listed as evidence. Not authored claims.\n\n';

describe('reflection lineage grammar and legacy ownership', () => {
  it('keeps exact independent observation bindings and rejects ambiguous locator grammar', () => {
    const text = renderReflectionMarker(marker);
    expect(parseReflectionMarker(text)).toEqual(marker);
    for (const changed of [
      text.replace('v=1', 'v=99'),
      text.replace('level=3', 'level=2'),
      text.replace(' evidence=', ' extra=1 evidence='),
      text.replace(' -->', '@ -->'),
      text.replace('obs_invented_3333', 'obs_invented_1111'),
    ])
      expect(parseReflectionMarker(changed)).toBeNull();
    expect(() => renderReflectionMarker({ ...marker, evidence: evidence.slice(0, 2) })).toThrow();
  });
  it('recognizes generated dated conclusions but leaves fenced and source examples alone', () => {
    const lines =
      `${envelope}${payload}\n\n\`\`\`md\n${payload}\n\`\`\`\n\n<!-- source -->\n${payload}\n`.split('\n');
    const indexes = legacyReflectionLineIndexes(lines);
    expect([...indexes]).toEqual([envelope.split('\n').length - 1]);
  });
  it.each(['derived: false', 'title: Service notes', 'A different authored introduction.'])(
    'does not guess legacy ownership from a dated line alone (%s)',
    (replacement) => {
      const text = replacement.startsWith('derived:')
        ? envelope.replace('derived: true', replacement)
        : replacement.startsWith('title:')
          ? envelope.replace('title: Principles', replacement)
          : envelope.replace(
              'Patterns Akno inferred from pages listed as evidence. Not authored claims.',
              replacement,
            );
      expect(legacyReflectionLineIndexes(`${text}${payload}\n`.split('\n')).size).toBe(0);
    },
  );
});
