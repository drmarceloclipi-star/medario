import { describe, it, expect } from 'vitest';

describe('firebase/index', () => {
  it('should export Firebase client', async () => {
    const firebase = await import('./index');
    expect(firebase).toBeDefined();
    expect(typeof firebase).toBe('object');
    expect(firebase).not.toBeNull();
  });

  it('should have re-exports from individual modules', async () => {
    const firebase = await import('./index');
    expect(firebase).not.toBeNull();
    expect(Object.keys(firebase || {}).length).toBeGreaterThan(0);
  });
});
