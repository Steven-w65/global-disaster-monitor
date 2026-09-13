function classifiedError(code, message, fields = {}) {
  return Object.assign(new Error(message), { code, ...fields });
}

export async function fetchJson(request, {
  signal,
  timeoutMs = 15_000,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw classifiedError('NETWORK_ERROR', 'The request could not be started.');
  }
  if (signal?.aborted) {
    throw classifiedError('ABORTED', 'The request was cancelled.');
  }

  const controller = new AbortController();
  let timedOut = false;
  let timeoutId;
  let rejectDeadline;

  const deadline = new Promise((resolve, reject) => {
    rejectDeadline = reject;
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(classifiedError('TIMEOUT', 'The request timed out.'));
      reject(classifiedError('TIMEOUT', 'The request timed out.'));
    }, Math.max(0, Number(timeoutMs) || 0));
  });

  const abortFromParent = () => {
    controller.abort(signal.reason);
    rejectDeadline(classifiedError('ABORTED', 'The request was cancelled.'));
  };
  signal?.addEventListener('abort', abortFromParent, { once: true });

  try {
    let response;
    try {
      const fetchPromise = Promise.resolve().then(() => fetchImpl(request.url, {
        ...(request.options || {}),
        signal: controller.signal
      }));
      response = await Promise.race([fetchPromise, deadline]);
    } catch (error) {
      if (timedOut) throw classifiedError('TIMEOUT', 'The request timed out.');
      if (signal?.aborted || controller.signal.aborted) {
        throw classifiedError('ABORTED', 'The request was cancelled.');
      }
      if (error?.code) throw error;
      throw classifiedError('NETWORK_ERROR', 'The request could not be completed.');
    }

    if (!response?.ok) {
      const status = Number.isFinite(response?.status) ? response.status : undefined;
      throw classifiedError('HTTP_ERROR', 'The service returned an unsuccessful response.',
        status === undefined ? {} : { status });
    }

    try {
      return await Promise.race([response.json(), deadline]);
    } catch (error) {
      if (timedOut) throw classifiedError('TIMEOUT', 'The request timed out.');
      if (signal?.aborted || controller.signal.aborted) {
        throw classifiedError('ABORTED', 'The request was cancelled.');
      }
      if (error?.code) throw error;
      throw classifiedError('INVALID_JSON', 'The service returned invalid JSON.');
    }
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromParent);
  }
}
