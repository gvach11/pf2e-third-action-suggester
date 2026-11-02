import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(new URL('../module.json', import.meta.url), 'utf8'));

describe('module.json', () => {
  it("downloads the zip attached to this version's release", () => {
    expect(manifest.download).toBe(`https://github.com/gvach11/pf2e-third-action-suggester/releases/download/v${manifest.version}/${manifest.id}.zip`);
  });

  it('recommends Recall Knowledge Assistant with an install link and the first version that integrates', () => {
    const rka = manifest.relationships.recommends.find(r => r.id === 'pf2e-recall-knowledge-assistant');
    expect(rka.manifest).toBe('https://raw.githubusercontent.com/gvach11/pf2e-recall-knowledge-assistant/master/module.json');
    expect(rka.compatibility).toEqual({ minimum: '1.0.0' });
  });
});
