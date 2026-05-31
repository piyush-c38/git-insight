import type { NextApiRequest, NextApiResponse } from 'next';
import { getBackendUrl } from '@/lib/backend-url';

// This API route proxies requests to the backend to get analysis status/results.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { analysisId } = req.query;

  if (!analysisId) {
    return res.status(400).json({ message: 'Analysis ID is required' });
  }

  try {
    const backendUrl = getBackendUrl();
    const backendResponse = await fetch(`${backendUrl}/api/repo/${analysisId}`);

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
