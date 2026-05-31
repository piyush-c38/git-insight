export function getBackendUrl() {
  const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL;

  if (backendUrl) {
    return backendUrl.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3001';
  }

  throw new Error('BACKEND_API_URL is not configured');
}