import type { NextApiRequest, NextApiResponse } from 'next';
import { getBackendUrl } from '@/lib/backend-url';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { analysisId } = req.query;

  if (!analysisId || typeof analysisId !== 'string') {
    return res.status(400).json({ message: 'Analysis ID is required' });
  }

  try {
    const backendUrl = getBackendUrl();
    const backendResponse = await fetch(`${backendUrl}/api/repo/${analysisId}/status`);

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return res.status(backendResponse.status).json(errorData);
    }

    const data = await backendResponse.json();
    res.status(200).json(data);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
