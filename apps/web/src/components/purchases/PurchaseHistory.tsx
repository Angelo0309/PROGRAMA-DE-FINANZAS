import { useMemo, useState } from 'react';

import type { PurchaseView, ScheduleItemView } from '../../api/client';
import { PurchaseDetail } from './PurchaseDetail';
import {
  commercialDate,
  limaDate,
  monthLabel,
  normalizeText,
  officialMoney,
  plural,
  purchaseCode,
  purchaseMonth,
} from './purchaseFormat';
import './purchases.css';

const ALL_MONTHS = 'all';

export function PurchaseHistory({ purchases, schedule }: { purchases: PurchaseView[]; schedule: ScheduleItemView[] }) {
  const [month, setMonth] = useState(ALL_MONTHS);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const months = useMemo(
    () => [...new Set(purchases.map((purchase) => purchaseMonth(purchase.purchasedAt)))].sort((first, second) => second.localeCompare(first)),
    [purchases],
  );

  const term = normalizeText(search);
  const visiblePurchases = purchases.filter((purchase) =>
    (month === ALL_MONTHS || purchaseMonth(purchase.purchasedAt) === month)
    && (term === '' || purchase.items.some((item) => normalizeText(item.description).includes(term))));
  const selectedPurchase = visiblePurchases.find((purchase) => purchase.id === selectedId) ?? visiblePurchases[0];
  const selectedObligations = selectedPurchase
    ? schedule.filter((item) => item.purchaseId === selectedPurchase.id)
    : [];

  return (
    <section className="paper-section client-ledger purchase-history">
      <p className="folio">MIS COMPRAS</p>
      <h2>Historial de compras</h2>
      {purchases.length === 0 ? <p className="empty-state">No hay compras recientes.</p> : (
        <>
          <div className="purchase-filters">
            <div>
              <label htmlFor="purchase-month">Mes de compra</label>
              <select id="purchase-month" value={month} onChange={(event) => setMonth(event.target.value)}>
                <option value={ALL_MONTHS}>Todos los meses</option>
                {months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="purchase-search">Buscar producto</label>
              <input id="purchase-search" type="search" value={search} placeholder="Nombre del producto" onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
          <p className="purchase-count">{visiblePurchases.length} de {plural(purchases.length, 'compra', 'compras')}</p>

          {!selectedPurchase ? <p className="empty-state">No hay compras que coincidan con los filtros.</p> : (
            <div className="purchase-layout">
              <ul className="purchase-list" aria-label="Lista de compras">
                {visiblePurchases.map((purchase) => (
                  <li key={purchase.id}>
                    <button type="button" className="purchase-list-item" aria-pressed={purchase.id === selectedPurchase.id} onClick={() => setSelectedId(purchase.id)}>
                      <span>{commercialDate(limaDate(purchase.purchasedAt))}</span>
                      <strong>{officialMoney(purchase.currency, purchase.total)}</strong>
                      <small>{purchaseCode(purchase.id)} · {plural(purchase.items.length, 'producto', 'productos')}</small>
                    </button>
                  </li>
                ))}
              </ul>
              <PurchaseDetail purchase={selectedPurchase} obligations={selectedObligations} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
