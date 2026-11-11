import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gst } from '@/api';
import s from './gst.module.css';

/** Read-only warning for a product without a verified HSN / GST rate. Renders nothing while
 *  loading, on error, or when the product is classified. */
export function HsnBadge({ productId }: { productId: string }) {
  const { data } = useQuery({
    queryKey: ['gst-products'],
    queryFn: gst.products,
    retry: false,
    staleTime: 30_000,
  });
  const p = data?.items.find((i) => i.id === productId);
  if (!p || !p.issue) return null;
  return (
    <Link to="/gst/products" className={s.warnBadge} title={p.issue}>
      No verified HSN
    </Link>
  );
}
