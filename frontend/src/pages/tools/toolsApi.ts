const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

// Public, anonymous tools endpoint — no auth header (IP rate-limited server-side).
export async function callTool(tool: string, payload: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_URL}/api/tools/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ tool, ...payload }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.message || data.error || 'Something went wrong — please try again.');
  }
  return data;
}
