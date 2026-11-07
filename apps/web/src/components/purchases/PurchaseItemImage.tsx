import { useEffect, useState } from 'react';

export function PurchaseItemImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <span className="product-thumbnail-placeholder">Sin imagen</span>;
  return <img className="product-thumbnail" src={src} alt={name} onError={() => setFailed(true)} />;
}
