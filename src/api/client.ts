/* The HTTP layer every api/* module goes through.

   The session is an HTTP-only cookie the browser sends automatically, so nothing here
   holds a token. Mutating requests echo the readable CSRF cookie back as a header,
   which is what proves the call came from this app rather than another site.

   Server errors arrive as { error, message, fields? } and are thrown as ApiError; each
   module converts that into the error class its screen already catches. */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string = 'error',
    readonly fields?: Record<string, string>,
    readonly status = 0,
  ) {
    super(message);
  }
}

const readCookie = (name: string): string => {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
};

export type Query = Record<string, string | number | boolean | string[] | undefined | null>;

/** Drops empty values so the server sees only the filters that are actually set. */
export function qs(query: Query = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(','));
    } else {
      p.set(k, String(v));
    }
  }
  const s = p.toString();
  return s ? '?' + s : '';
};

interface ReqInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
}

export async function req<T>(path: string, init: ReqInit = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['x-csrf-token'] = readCookie('aj_csrf');

  let res: Response;
  try {
    res = await fetch(BASE + path + qs(init.query), {
      method,
      headers,
      credentials: 'include',
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 'network');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; message?: string; fields?: Record<string, string> };
    throw new ApiError(
      body.message ?? 'Something went wrong',
      body.error ?? 'error',
      body.fields,
      res.status,
    );
  }
  return data as T;
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** Downloads a CSV export through the same session. */
export async function download(path: string, query: Query, filename: string): Promise<void> {
  const res = await fetch(BASE + path + qs(query), { credentials: 'include' });
  if (!res.ok) throw new ApiError('Could not build that export', 'error', undefined, res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
