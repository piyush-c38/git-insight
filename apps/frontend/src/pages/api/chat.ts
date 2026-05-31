import type { NextApiRequest, NextApiResponse } from 'next';
import { getBackendUrl } from '@/lib/backend-url';

// This API route proxies chat requests to the backend.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { analysisId, query } = req.body;
  if (!analysisId || !query) {
    return res.status(400).json({ message: 'analysisId and query are required' });
  }

  try {
    const backendUrl = getBackendUrl();
    const backendResponse = await fetch(`${backendUrl}/api/repo/${analysisId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query }),
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
