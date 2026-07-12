import { describe, it, expect } from 'vitest';

describe('map-query', () => {
  it('should export map query handler', () => {
    // @ts-ignore - allow mocking
    const mapQuery = require('./map-query');
    expect(mapQuery).toBeDefined();
    expect(typeof mapQuery).toBe('object');
    expect(mapQuery).not.toBeNull();
  });
});