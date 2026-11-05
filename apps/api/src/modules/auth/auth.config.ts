const DEVELOPMENT_ACCESS_TOKEN_SECRET =
  'local-development-secret-change-before-deploying';

export function resolveAccessTokenSecret(
  environment: Record<string, string | undefined> = process.env,
): string {
  const secret = environment.JWT_ACCESS_SECRET;
  if (environment.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_ACCESS_SECRET must be explicitly configured with at least 32 characters in production.',
      );
    }
    return secret;
  }
  return secret ?? DEVELOPMENT_ACCESS_TOKEN_SECRET;
}
