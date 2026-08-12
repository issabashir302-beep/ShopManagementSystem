import { QueryClient } from '@tanstack/react-query'
export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: (count, error) => count < 1 && error.status >= 500, refetchOnWindowFocus: false }, mutations: { retry: false } } })
