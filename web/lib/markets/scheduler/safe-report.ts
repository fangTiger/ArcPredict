const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bmissing env:\s*[A-Z0-9_]*(?:PRIVATE_KEY|API_KEY|SECRET|TOKEN|AUTHORIZATION|RPC_URL)\b/giu, 'missing required configuration'],
  [/\b[A-Z0-9_]*(?:PRIVATE_KEY|API_KEY|SECRET|TOKEN|AUTHORIZATION|RPC_URL)\b\s*(?:=|:)\s*[^\s,;]+/gu, '[redacted-secret]'],
  [/\bBearer\s+[^\s,;]+/giu, 'Bearer [redacted]'],
  [/\bsk-[A-Za-z0-9_-]+\b/gu, '[redacted-api-key]'],
  [/\b0x[a-fA-F0-9]{64}\b/gu, '[redacted-hex-secret]'],
  [/([?&](?:api[_-]?key|key|token|secret|signature)=)[^&\s]+/giu, '$1[redacted]'],
];

const FUNDING_ERROR_PATTERN =
  /insufficient|needs funding|exceeds balance|transfer amount exceeds balance|funds/i;

export function redactSecretValue(input: string): string {
  return SECRET_PATTERNS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    input,
  );
}

export function safeErrorMessage(error: unknown, fallback = 'unexpected error'): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = redactSecretValue(raw).replace(/\s+/gu, ' ').trim();
  return trimmed || fallback;
}

export function isFundingError(error: unknown): boolean {
  return FUNDING_ERROR_PATTERN.test(error instanceof Error ? error.message : String(error ?? ''));
}
