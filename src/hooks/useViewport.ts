import { useEffect, useState } from 'react';

/** Window width, for the layout values the prototype computes inline from L.* */
export function useViewport() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return { w, desk: w >= 1024, mob: w < 1024 };
}
