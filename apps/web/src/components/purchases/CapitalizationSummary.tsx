import type { InitialCapitalizationView } from '../../api/client';
import { commercialDate, officialMoney } from './purchaseFormat';
import './capitalization-summary.css';

export function CapitalizationSummary({
  summary,
  currency,
}: {
  summary: InitialCapitalizationView | null | undefined;
  currency: string | undefined;
}) {
  if (!summary || !currency) return null;

  return (
    <section className="capitalization-summary" aria-label="Resumen de capitalización inicial">
      <div className="capitalization-summary-intro">
        <span>Periodo inicial capitalizado</span>
        <strong>{summary.days} días</strong>
        <small>{commercialDate(summary.startDate)} al {commercialDate(summary.endDate)}</small>
      </div>
      <div>
        <span>Capital original</span>
        <strong>{officialMoney(currency, summary.originalPrincipal)}</strong>
      </div>
      <div>
        <span>Interés capitalizado</span>
        <strong>{officialMoney(currency, summary.capitalizedInterest)}</strong>
      </div>
      <div>
        <span>Capital para las cuotas</span>
        <strong>{officialMoney(currency, summary.capitalizedPrincipal)}</strong>
      </div>
    </section>
  );
}
