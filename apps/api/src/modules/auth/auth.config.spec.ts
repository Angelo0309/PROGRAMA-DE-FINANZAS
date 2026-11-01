import { describe, expect, it } from 'vitest';

import { resolveAccessTokenSecret } from './auth.config.js';

describe('resolveAccessTokenSecret', () => {
  it('requires an explicit strong secret in production', () => {
    expect(() => resolveAccessTokenSecret({ NODE_ENV: 'production' })).toThrow(
      'JWT_ACCESS_SECRET',
    );
    expect(() =>
      resolveAccessTokenSecret({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('allows the development fallback only outside production', () => {
    expect(resolveAccessTokenSecret({ NODE_ENV: 'test' })).toContain('local-development');
    expect(
      resolveAccessTokenSecret({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'an-explicit-secret-with-more-than-32-chars',
      }),
    ).toBe('an-explicit-secret-with-more-than-32-chars');
  });
});
