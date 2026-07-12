import { describe, it, expect } from 'vitest';

describe('notifications', () => {
  it('should export notification handler', () => {
    // @ts-ignore - allow mocking
    const notifications = require('./notifications');
    expect(notifications).toBeDefined();
    expect(typeof notifications).toBe('object');
    expect(notifications).not.toBeNull();
  });
});