import { describe, it, expect, vi } from 'vitest';
import { canDeliverNotification } from './notifications';

describe('canDeliverNotification', () => {
  it('should return true for valid channel and event', () => {
    expect(canDeliverNotification({
      isAccount: true,
      enabled: true,
      channel: 'email',
      event: 'appointment_confirmed',
    })).toBe(true);
  });

  it('should return true for whatsapp channel', () => {
    expect(canDeliverNotification({
      isAccount: true,
      enabled: true,
      channel: 'whatsapp',
      event: 'profile_updated',
    })).toBe(true);
  });

  it('should return true for push channel', () => {
    expect(canDeliverNotification({
      isAccount: true,
      enabled: true,
      channel: 'push',
      event: 'saved_search_material',
    })).toBe(true);
  });

  it('should return false when isAccount is false', () => {
    expect(canDeliverNotification({
      isAccount: false,
      enabled: true,
      channel: 'email',
      event: 'appointment_confirmed',
    })).toBe(false);
  });

  it('should return false when enabled is false', () => {
    expect(canDeliverNotification({
      isAccount: true,
      enabled: false,
      channel: 'email',
      event: 'appointment_confirmed',
    })).toBe(false);
  });

  it('should return false for unknown channel', () => {
    expect(canDeliverNotification({
      isAccount: true,
      enabled: true,
      channel: 'sms',
      event: 'appointment_confirmed',
    })).toBe(false);
  });

  it('should return false for unknown event', () => {
    expect(canDeliverNotification({
      isAccount: true,
      enabled: true,
      channel: 'email',
      event: 'unknown_event',
    })).toBe(false);
  });

  it('should return true for all three valid events with valid channel', () => {
    const events = ['appointment_confirmed', 'profile_updated', 'saved_search_material'];
    const channels = ['email', 'whatsapp', 'push'];

    events.forEach((event) => {
      channels.forEach((channel) => {
        expect(canDeliverNotification({
          isAccount: true,
          enabled: true,
          channel,
          event,
        })).toBe(true);
      });
    });
  });

  it('should return false for invalid combination', () => {
    expect(canDeliverNotification({
      isAccount: true,
      enabled: true,
      channel: 'email',
      event: 'invalid_event',
    })).toBe(false);
  });
});