import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(new URL('../module.json', import.meta.url), 'utf8'));

describe('module.json', () => {
  it("downloads the zip attached to this version's release", () => {
    expect(manifest.download).toBe(`https://github.com/gvach11/pf2e-third-action-suggester/releases/download/v${manifest.version}/${manifest.id}.zip`);
  });

  // RKA needs Foundry v14 but TAS supports v13: listing it would make Foundry's
  // install dialog offer v13 users a module they can't install.
  it('does not list Recall Knowledge Assistant as a relationship', () => {
    expect(JSON.stringify(manifest.relationships ?? {})).not.toContain('pf2e-recall-knowledge-assistant');
  });
});
