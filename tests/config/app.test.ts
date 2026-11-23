import { describe, expect, it } from 'vitest';
import { APP_NAME, SAVE_KEY } from '../../src/config/app';

describe('config/app', () => {
  it('expose le nom et la clé de sauvegarde', () => {
    expect(APP_NAME).toBe('Nocturne 21');
    expect(SAVE_KEY).toBe('nocturne21:v1');
  });
});
