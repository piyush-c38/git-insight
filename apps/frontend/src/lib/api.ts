import useSWR from 'swr';

export const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useAnalysis(analysisId: string | string[] | undefined) {
  const { data, error } = useSWR(
    analysisId ? `/api/analysis/${analysisId}` : null,
    fetcher,
    {
      refreshInterval: (latestData) =>
        latestData?.status === 'completed' || latestData?.status === 'failed' || latestData?.status === 'cancelled'
          ? 0
          : 2000,
    }
  );

  return {
    analysis: data,
    isLoading: !error && !data,
    isError: error,
  };
}
