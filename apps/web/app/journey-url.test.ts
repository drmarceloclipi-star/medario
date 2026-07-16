import { describe, expect, it } from 'vitest';

import { journeyUrl, readJourneyUrl } from './journey-url';

describe('journey URL contract', () => {
  it('accepts only recognized objective filters and technical entry', () => {
    expect(readJourneyUrl('/?city=Joinville&specialty=Psiquiatria&entry=directory-joinville')).toEqual({
      filters: { city: 'joinville', specialty: 'psiquiatria' },
      entry: 'directory-joinville',
    });
  });

  it('drops free text, identity, location and unknown parameters', () => {
    expect(readJourneyUrl('/?city=joinville&q=ansiedade&symptom=panic&lat=-26&email=a%40b.com&unknown=yes')).toEqual({
      filters: { city: 'joinville' },
      entry: undefined,
    });
  });

  it('serializes a canonical URL without entry or invalid values', () => {
    expect(journeyUrl({ city: 'joinville', specialty: 'psiquiatria', insurance: 'not-real' })).toBe('/?specialty=psiquiatria&city=joinville');
  });
});
