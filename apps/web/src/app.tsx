import './styles.css';

export function App() {
  return (
    <main className="ledger-shell">
      <section className="ledger-intro" aria-labelledby="product-title">
        <p className="context-line">Cuenta corriente para comercios de barrio</p>
        <h1 id="product-title">CrediCuenta</h1>
        <p className="product-purpose">
          Control de creditos comerciales, desde la compra hasta el pago.
        </p>
        <dl className="ledger-facts">
          <div>
            <dt>Operacion</dt>
            <dd>Multi-tienda</dd>
          </div>
          <div>
            <dt>Calendario</dt>
            <dd>30 / 360</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>Preparando acceso</dd>
          </div>
        </dl>
      </section>
      <aside className="balance-sheet" aria-label="Resumen de demostracion">
        <span>Saldo de demostracion</span>
        <strong>S/ 0.00</strong>
        <p>Los importes oficiales siempre provienen del motor financiero.</p>
      </aside>
    </main>
  );
}

