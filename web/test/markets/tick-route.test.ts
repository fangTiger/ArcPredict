import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/markets/bootstrap', () => ({
  bootstrapSources: vi.fn(),
}));

describe('cron tick route fatal error redaction', () => {
  const previousEnv = {
    CRON_SECRET: process.env.CRON_SECRET,
    AUTOMATION_PRIVATE_KEY: process.env.AUTOMATION_PRIVATE_KEY,
    AUTOMATION_RPC_URL: process.env.AUTOMATION_RPC_URL,
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = 'cron-secret';
  });

  afterEach(() => {
    process.env.CRON_SECRET = previousEnv.CRON_SECRET;
    process.env.AUTOMATION_PRIVATE_KEY = previousEnv.AUTOMATION_PRIVATE_KEY;
    process.env.AUTOMATION_RPC_URL = previousEnv.AUTOMATION_RPC_URL;
    vi.clearAllMocks();
  });

  it('does not leak automation secrets in the route-level catch response', async () => {
    const { bootstrapSources } = await import('../../lib/markets/bootstrap');
    vi.mocked(bootstrapSources).mockImplementationOnce(() => {
      throw new Error(
        'AUTOMATION_PRIVATE_KEY=0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd ' +
        'Bearer super-secret-token ' +
        'sk-live-secret ' +
        'https://rpc.example.com?token=rpc-secret',
      );
    });

    const route = await import('../../app/api/cron/markets/tick/route');
    const response = await route.GET(new Request('http://localhost/api/cron/markets/tick', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    }));

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: false });
    expect(payload.error).not.toContain('AUTOMATION_PRIVATE_KEY');
    expect(payload.error).not.toContain('super-secret-token');
    expect(payload.error).not.toContain('sk-live-secret');
    expect(payload.error).not.toContain('token=rpc-secret');
  });

  it('does not leak the automation private key env name when configuration is missing', async () => {
    const { bootstrapSources } = await import('../../lib/markets/bootstrap');
    vi.mocked(bootstrapSources).mockImplementationOnce(() => {});
    delete process.env.AUTOMATION_PRIVATE_KEY;
    process.env.AUTOMATION_RPC_URL = 'https://rpc.example.com';

    const route = await import('../../app/api/cron/markets/tick/route');
    const response = await route.GET(new Request('http://localhost/api/cron/markets/tick', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    }));

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: false });
    expect(payload.error).toContain('missing required configuration');
    expect(payload.error).not.toContain('AUTOMATION_PRIVATE_KEY');
  });

  it('does not leak the automation rpc url env name when configuration is missing', async () => {
    const { bootstrapSources } = await import('../../lib/markets/bootstrap');
    vi.mocked(bootstrapSources).mockImplementationOnce(() => {});
    process.env.AUTOMATION_PRIVATE_KEY = `0x${'11'.repeat(32)}`;
    delete process.env.AUTOMATION_RPC_URL;

    const route = await import('../../app/api/cron/markets/tick/route');
    const response = await route.GET(new Request('http://localhost/api/cron/markets/tick', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    }));

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: false });
    expect(payload.error).toContain('missing required configuration');
    expect(payload.error).not.toContain('AUTOMATION_RPC_URL');
  });
});
