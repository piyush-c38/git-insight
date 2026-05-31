import type { NextApiRequest, NextApiResponse } from 'next';
import { getBackendUrl } from '@/lib/backend-url';

// This API route proxies requests to the backend to start an analysis.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { repoUrl } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ message: 'Repository URL is required' });
  }

  try {
    const backendUrl = getBackendUrl();
    const backendResponse = await fetch(`${backendUrl}/api/repo/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return res.status(backendResponse.status).json(errorData);
    }

    const data = await backendResponse.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
