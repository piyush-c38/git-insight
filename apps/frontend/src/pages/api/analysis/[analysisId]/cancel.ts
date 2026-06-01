import type { NextApiRequest, NextApiResponse } from 'next';
import { getBackendUrl } from '@/lib/backend-url';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { analysisId } = req.query;

  if (!analysisId) {
    return res.status(400).json({ message: 'Analysis ID is required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const backendUrl = getBackendUrl();
    const backendResponse = await fetch(`${backendUrl}/api/repo/${analysisId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      return res.status(backendResponse.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}