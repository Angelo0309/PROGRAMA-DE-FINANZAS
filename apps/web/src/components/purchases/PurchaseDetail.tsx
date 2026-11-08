import type { PurchaseView, ScheduleItemView } from '../../api/client';
import { PurchaseItemImage } from './PurchaseItemImage';
import {
  commercialDate,
  displayQuantity,
  displayUnitPrice,
  limaDate,
  obligationStatus,
  officialMoney,
  plural,
  purchaseCode,
} from './purchaseFormat';

export function PurchaseDetail({ purchase, obligations }: { purchase: PurchaseView; obligations: ScheduleItemView[] }) {
  const paidCount = obligations.filter((item) => item.status === 'PAID').length;
  const nextPending = obligations.find((item) => item.status === 'PENDING' || item.status === 'OVERDUE');

  return (
    <article className="purchase-detail" aria-labelledby="purchase-detail-title">
      <div className="purchase-detail-heading">
        <div>
          <p className="folio">DETALLE DE COMPRA</p>
          <h3 id="purchase-detail-title">Compra {purchaseCode(purchase.id)}</h3>
          <p>Registrada el {commercialDate(limaDate(purchase.purchasedAt))}</p>
        </div>
        <strong aria-label="Total de la compra">{officialMoney(purchase.currency, purchase.total)}</strong>
      </div>

      <div className="table-wrapper">
        <table aria-label="Productos de la compra">
          <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th></tr></thead>
          <tbody>
            {purchase.items.map((item) => (
              <tr key={`${purchase.id}-${item.productId}`}>
                <td><div className="purchase-product"><PurchaseItemImage src={item.imageUrl} name={item.description} /><span>{item.description}</span></div></td>
                <td>{displayQuantity(item.quantity)}</td>
                <td>{officialMoney(purchase.currency, displayUnitPrice(item.unitPrice))}</td>
                <td className="money-cell">{officialMoney(purchase.currency, item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>Plan de pago asociado</h4>
      {obligations.length === 0 ? <p className="empty-state">Esta compra no tiene obligaciones registradas.</p> : (
        <>
          <p className="purchase-plan-summary">
            {plural(obligations.length, 'obligación', 'obligaciones')} · {plural(paidCount, 'pagada', 'pagadas')} · Próximo vencimiento: {nextPending ? commercialDate(nextPending.dueDate) : 'Sin pendientes'}
          </p>
          <div className="table-wrapper">
            <table aria-label="Cuotas de la compra">
              <thead><tr><th>Cuota</th><th>Vencimiento</th><th>Importe</th><th>Pagado</th><th>Estado</th></tr></thead>
              <tbody>
                {obligations.map((item) => {
                  const status = obligationStatus(item.status);
                  return (
                    <tr key={item.id}>
                      <td>{item.installmentNumber}</td>
                      <td>{commercialDate(item.dueDate)}</td>
                      <td className="money-cell">{officialMoney(item.currency, item.amountDue)}</td>
                      <td>{officialMoney(item.currency, item.paidAmount)}</td>
                      <td><span className={`status-pill ${status.tone}`}>{status.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </article>
  );
}
