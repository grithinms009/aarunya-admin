/* The store's fixed vocabularies, fetched once and shared by every screen.

   Reference data changes only when the API changes, so it is cached indefinitely and
   never refetched on focus. Screens read it instead of hard-coding reason lists, flow
   labels, link targets or default artwork. */
import { useQuery } from '@tanstack/react-query';
import { EMPTY_REFERENCE, meta, type Reference } from '@/api';

export function useReference(): Reference {
  const { data } = useQuery({
    queryKey: ['reference'],
    queryFn: meta.reference,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? EMPTY_REFERENCE;
}
