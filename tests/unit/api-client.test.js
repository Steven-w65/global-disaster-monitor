import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from '../../src/services/api-client.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchJson', () => {
  it('returns parsed JSON and passes request options with a composed signal', async () => {
    const payload = { events: [{ id: 'event-1' }] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });

    await expect(fetchJson({
      url: 'https://example.gov/feed',
      options: { headers: { Accept: 'application/json' } }
    }, { fetchImpl, timeoutMs: 50 })).resolves.toBe(payload);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ headers: { Accept: 'application/json' } });
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects a non-success response with a safe classified error', async () => {
    const json = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json });
    const request = fetchJson({ url: 'https://example.gov/feed?token=secret', options: {} }, {
      fetchImpl,
      timeoutMs: 50
    });

    await expect(request).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 503 });
    await expect(request).rejects.not.toMatchObject({ message: expect.stringContaining('secret') });
    expect(json).not.toHaveBeenCalled();
  });

  it('classifies invalid JSON without exposing request details', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token at https://example.gov/?token=secret'))
    });
    const request = fetchJson({ url: 'https://example.gov/feed?token=secret', options: {} }, {
      fetchImpl,
      timeoutMs: 50
    });

    await expect(request).rejects.toMatchObject({ code: 'INVALID_JSON' });
    await expect(request).rejects.not.toMatchObject({ message: expect.stringContaining('secret') });
  });

  it.each([
    ['transport', () => Promise.reject(Object.assign(
      new Error('https://example.gov/feed?token=secret'),
      { code: 'ECONNRESET' }
    )), 'NETWORK_ERROR', 'The request could not be completed.'],
    ['parser', () => Promise.resolve({
      ok: true,
      json: () => Promise.reject(Object.assign(
        new Error('https://example.gov/feed?token=secret'),
        { code: 'ECONNRESET' }
      ))
    }), 'INVALID_JSON', 'The service returned invalid JSON.']
  ])('normalizes an arbitrary coded %s error without leaking its message', async (
    _boundary,
    fetchImpl,
    code,
    message
  ) => {
    const request = fetchJson({ url: 'https://example.gov/feed?token=secret', options: {} }, {
      fetchImpl,
      timeoutMs: 50
    });

    await expect(request).rejects.toMatchObject({ code, message });
    await expect(request).rejects.not.toMatchObject({ message: expect.stringMatching(/https:|secret|token/i) });
  });

  it('propagates a parent cancellation as a classified abort', async () => {
    const parent = new AbortController();
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const request = fetchJson({ url: 'https://example.gov/feed', options: {} }, {
      signal: parent.signal,
      fetchImpl,
      timeoutMs: 50
    });

    parent.abort();

    await expect(request).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('times out a never-settling request', async () => {
    vi.useFakeTimers();
    const result = fetchJson({ url: 'https://example.gov/feed', options: {} }, {
      fetchImpl: () => new Promise(() => {}),
      timeoutMs: 20
    });
    const rejection = expect(result).rejects.toMatchObject({ code: 'TIMEOUT' });

    await vi.advanceTimersByTimeAsync(21);
    await rejection;
  });
});
