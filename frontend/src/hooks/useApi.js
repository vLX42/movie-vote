import useSWR from 'swr';

const fetcher = async (url) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    const error = new Error(err.error || 'Request failed');
    error.status = res.status;
    error.info = err;
    throw error;
  }
  return res.json();
};

export function useSession(slug) {
  return useSWR(slug ? `/api/session/${slug}` : null, fetcher, {
    refreshInterval: 15000, // poll every 15 seconds
    revalidateOnFocus: true
  });
}

export function useVoterMe() {
  return useSWR('/api/voter/me', fetcher);
}

export async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    error.info = data;
    throw error;
  }
  return data;
}

export async function apiDelete(url, body) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    error.info = data;
    throw error;
  }
  return data;
}

export async function apiPatch(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    error.info = data;
    throw error;
  }
  return data;
}

export function adminFetcher(adminSecret) {
  return async (url) => {
    const res = await fetch(url, {
      headers: { 'X-Admin-Secret': adminSecret },
      credentials: 'include'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      const error = new Error(err.error || 'Request failed');
      error.status = res.status;
      throw error;
    }
    return res.json();
  };
}

export async function adminPost(url, body, adminSecret) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': adminSecret
    },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function adminPatch(url, body, adminSecret) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': adminSecret
    },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function adminDelete(url, adminSecret) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'X-Admin-Secret': adminSecret },
    credentials: 'include'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return data;
}
