import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { Alert, CircularProgress } from '@mui/material';
import { z } from 'zod';

import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  createApiClient,
  type AccountView,
  type ApiClient,
  type ProductView,
  type Profile,
  type StoreAccess,
} from './api/client';
import './styles.css';

const defaultApi = createApiClient();
const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Ingrese su correo o usuario.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});
const productFormSchema = z.object({
  sku: z.string().trim().min(1, 'Ingrese el código del producto.'),
  name: z.string().trim().min(2, 'Ingrese un nombre de al menos 2 caracteres.'),
  description: z.string().trim().max(10_000),
  unitPrice: z.string().regex(/^\d+(?:\.\d{1,4})?$/, 'Ingrese un precio válido.'),
  imageUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^https?:\/\/[^\s]+$/i.test(value),
      'La imagen debe usar una dirección HTTP o HTTPS.',
    ),
});

const money = (currency: string, amount: string) =>
  `${currency === 'PEN' ? 'S/' : currency} ${Number(amount).toFixed(2)}`;

const platformNavigation = [
  'Dashboard',
  'Gestión de tiendas',
  'Gestión de usuarios',
  'Solicitudes',
  'Reportes',
  'Configuración',
  'Auditoría',
];
const businessNavigation = [
  'Panel del negocio',
  'Productos y servicios',
  'Clientes',
  'Registrar compra',
  'Cuentas corrientes',
  'Planes de pago',
  'Registrar pago',
  'Reporte de corte',
  'Ayuda',
];
const clientNavigation = [
  'Mi resumen',
  'Mis compras',
  'Estado de cuenta',
  'Plan de pagos',
  'Historial de pagos',
  'Ayuda',
];

function LoginPanel({
  api,
  onAuthenticated,
}: {
  api: ApiClient;
  onAuthenticated: (profile: Profile) => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise los datos ingresados.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const tokens = await api.login(parsed.data);
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      onAuthenticated(await api.getProfile());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="product-title">
        <div className="login-brand">
          <span className="brand-symbol" aria-hidden="true">CC</span>
          <h1 id="product-title">CrediCuenta</h1>
        </div>
        <p className="login-subtitle">Administración de cuentas corrientes y créditos</p>
        <div className="login-divider" />
        <h2 id="login-title">Inicia sesión</h2>
        <p className="muted">Ingresa tus credenciales para acceder al sistema.</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="identifier">Correo o usuario</label>
          <input
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Verificando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="help-copy">
          El acceso y las funciones disponibles dependen del rol asignado.
        </p>
      </section>
      <p className="login-footer">© 2026 CrediCuenta · Sistema de administración de créditos</p>
    </main>
  );
}

function WorkspaceShell({
  profile,
  title,
  kicker,
  navigation,
  activeNavigation,
  availableNavigation,
  onNavigate,
  onLogout,
  children,
}: {
  profile: Profile;
  title: string;
  kicker: string;
  navigation: string[];
  activeNavigation?: string;
  availableNavigation?: string[];
  onNavigate?: (item: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-context">{kicker}</span>
        <div className="profile-chip">
          <a href="#ayuda">Ayuda</a>
          <span>{profile.displayName}</span>
          <span className="avatar" aria-hidden="true">{profile.displayName.slice(0, 1)}</span>
        </div>
      </header>
      <aside className="side-rail" aria-label="Secciones">
        <a className="wordmark" href="#inicio" aria-label="CrediCuenta inicio">
          <span className="brand-symbol" aria-hidden="true">CC</span>
          <span className="wordmark-copy"><strong>CrediCuenta</strong><small>Control simple, cuentas claras</small></span>
        </a>
        <div className="sidebar-profile">
          <strong>{profile.displayName}</strong>
          <span>{kicker}</span>
        </div>
        <nav className="sidebar-navigation" aria-label="Secciones">
          {navigation.map((item, index) => {
            const active = activeNavigation ? activeNavigation === item : index === 0;
            const available = onNavigate && (availableNavigation?.includes(item) ?? true);
            if (onNavigate) {
              return (
                <button
                  className={active ? 'active' : ''}
                  disabled={!available}
                  key={item}
                  type="button"
                  onClick={() => onNavigate(item)}
                >
                  <span className="nav-indicator" aria-hidden="true" />
                  {item}
                </button>
              );
            }
            return (
              <a className={active ? 'active' : ''} href={index === 0 ? '#inicio' : '#actividad'} key={item}>
                <span className="nav-indicator" aria-hidden="true" />
                {item}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>{profile.displayName}</span>
          <button type="button" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="workspace" id="inicio">
        <header className="workspace-heading">
          <p className="eyebrow">{kicker}</p>
          <h1>{title}</h1>
        </header>
        {children}
      </main>
    </div>
  );
}

function PlatformWorkspace({ api, profile }: { api: ApiClient; profile: Profile }) {
  const [stores, setStores] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const [events, setEvents] = useState<Array<{ id: string; event: string; createdAt: string }>>([]);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStoreId, setInviteStoreId] = useState('');
  const [oneTimeToken, setOneTimeToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([api.listStores(), api.listAudit()]).then(([nextStores, nextEvents]) => {
      setStores(nextStores);
      setEvents(nextEvents);
    });
  }, [api]);

  async function createStore(event: FormEvent) {
    event.preventDefault();
    if (taxId.length < 8 || storeName.trim().length < 2) {
      setError('Ingrese un documento y una razón social válidos.');
      return;
    }
    try {
      const store = await api.createStore({
        taxId,
        name: storeName.trim(),
        currency: 'PEN',
        timeZone: 'America/Lima',
      });
      setStores((current) => [...current, { ...store, active: store.active ?? true }]);
      setShowStoreForm(false);
      setTaxId('');
      setStoreName('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear la tienda.');
    }
  }

  async function inviteAdministrator(event: FormEvent) {
    event.preventDefault();
    if (!inviteEmail.includes('@') || !inviteStoreId) {
      setError('Seleccione una tienda e ingrese un correo válido.');
      return;
    }
    try {
      const invitation = await api.createInvitation({
        email: inviteEmail,
        platformRole: 'USER',
        storeId: inviteStoreId,
        storeRole: 'STORE_ADMIN',
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });
      setOneTimeToken(invitation.token);
      setInviteEmail('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear la invitación.');
    }
  }

  return (
    <>
      <section className="metric-strip" aria-label="Indicadores de plataforma">
        <article><span>Tiendas registradas</span><strong>{stores.length}</strong></article>
        <article><span>Eventos visibles</span><strong>{events.length}</strong></article>
        <article><span>Estado</span><strong className="status-word">Operativa</strong></article>
      </section>
      <section className="paper-section" id="actividad">
        <div className="section-title">
          <div><p className="folio">PLATAFORMA · TIENDAS</p><h2>Directorio comercial</h2></div>
          <button className="secondary-button" type="button" onClick={() => setShowStoreForm((value) => !value)}>Nueva tienda</button>
        </div>
        {showStoreForm && (
          <form className="inline-form" onSubmit={createStore}>
            <label htmlFor="store-tax-id">RUC o documento</label>
            <input id="store-tax-id" value={taxId} onChange={(event) => setTaxId(event.target.value)} />
            <label htmlFor="store-name">Razón social</label>
            <input id="store-name" value={storeName} onChange={(event) => setStoreName(event.target.value)} />
            <button className="primary-button" type="submit">Guardar tienda</button>
          </form>
        )}
        {stores.length === 0 ? (
          <p className="empty-state">Aún no hay tiendas para mostrar.</p>
        ) : (
          <table><thead><tr><th>Tienda</th><th>Estado</th></tr></thead><tbody>
            {stores.map((store) => <tr key={store.id}><td>{store.name}</td><td>{store.active ? 'Activa' : 'Inactiva'}</td></tr>)}
          </tbody></table>
        )}
      </section>
      <section className="paper-section invitation-section">
        <div><p className="folio">ACCESOS · INVITACIÓN</p><h2>Administrador del negocio</h2></div>
        <form className="inline-form" onSubmit={inviteAdministrator}>
          <label htmlFor="invite-store">Tienda asignada</label>
          <select id="invite-store" value={inviteStoreId} onChange={(event) => setInviteStoreId(event.target.value)}>
            <option value="">Seleccione una tienda</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <label htmlFor="invite-email">Correo del administrador</label>
          <input id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
          <button className="primary-button" type="submit">Crear invitación</button>
        </form>
        {oneTimeToken && <Alert severity="success">Token de un solo uso: {oneTimeToken}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </section>
      <p className="audit-note">Sesión de plataforma: {profile.displayName}. Las altas e invitaciones quedan en auditoría.</p>
    </>
  );
}

function ProductImage({
  src,
  name,
  preview = false,
}: {
  src: string | null;
  name: string;
  preview?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span className={preview ? 'product-preview-placeholder' : 'product-thumbnail-placeholder'}>
        Sin imagen
      </span>
    );
  }

  return (
    <img
      className={preview ? 'product-preview-image' : 'product-thumbnail'}
      src={src}
      alt={preview ? `Vista previa de ${name || 'producto'}` : name}
      onError={() => setFailed(true)}
    />
  );
}

function ProductCatalog({
  api,
  access,
  products,
  setProducts,
}: {
  api: ApiClient;
  access: StoreAccess;
  products: ProductView[];
  setProducts: Dispatch<SetStateAction<ProductView[]>>;
}) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const canManageProducts = access.role === 'STORE_ADMIN';
  const previewUrl = /^https?:\/\/[^\s]+$/i.test(imageUrl.trim())
    ? imageUrl.trim()
    : null;
  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLocaleLowerCase('es-PE');
    if (!term) return true;
    return [product.sku, product.name, product.description ?? '']
      .some((value) => value.toLocaleLowerCase('es-PE').includes(term));
  });

  function resetForm() {
    setSku('');
    setName('');
    setDescription('');
    setUnitPrice('');
    setImageUrl('');
    setError('');
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const parsed = productFormSchema.safeParse({
      sku,
      name,
      description,
      unitPrice,
      imageUrl,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise los datos ingresados.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const product = await api.createProduct(access.storeId, {
        sku: parsed.data.sku,
        name: parsed.data.name,
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
        unitPrice: parsed.data.unitPrice,
        currency: access.currency,
        ...(parsed.data.imageUrl ? { imageUrl: parsed.data.imageUrl } : {}),
      });
      setProducts((current) => [...current, product].sort((left, right) => left.name.localeCompare(right.name, 'es')));
      setNotice('Producto guardado correctamente.');
      resetForm();
      setShowForm(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible guardar el producto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="product-page">
      <div className="page-lead">
        <div>
          <p>Administra los artículos y servicios ofrecidos por {access.storeName}.</p>
        </div>
        {canManageProducts && (
          <button className="primary-button compact-button" type="button" onClick={() => setShowForm(true)}>
            + Nuevo producto o servicio
          </button>
        )}
      </div>

      {notice && <Alert severity="success">{notice}</Alert>}
      <div className="catalog-toolbar">
        <label className="search-field" htmlFor="product-search">
          <span>Buscar en el catálogo</span>
          <input
            id="product-search"
            type="search"
            placeholder="Nombre, código o descripción"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="catalog-count">{filteredProducts.length} de {products.length} registros</span>
      </div>

      <section className="metric-strip product-metrics" aria-label="Indicadores del catálogo">
        <article><span>Productos y servicios</span><strong>{products.length}</strong></article>
        <article><span>Con imagen</span><strong>{products.filter((product) => product.imageUrl).length}</strong></article>
        <article><span>Sin imagen</span><strong>{products.filter((product) => !product.imageUrl).length}</strong></article>
      </section>

      <div className={showForm ? 'catalog-layout form-open' : 'catalog-layout'}>
        <section className="catalog-panel" aria-labelledby="catalog-title">
          <div className="catalog-panel-heading">
            <h2 id="catalog-title">Catálogo del establecimiento</h2>
            <span>Precios oficiales de la API</span>
          </div>
          {filteredProducts.length === 0 ? (
            <p className="empty-state catalog-empty">No se encontraron productos con ese criterio.</p>
          ) : (
            <div className="table-wrapper">
              <table className="product-table">
                <thead><tr><th>Producto o servicio</th><th>Código</th><th>Precio</th><th>Imagen</th></tr></thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          <ProductImage src={product.imageUrl} name={product.name} />
                          <div><strong>{product.name}</strong><span>{product.description || 'Sin descripción'}</span></div>
                        </div>
                      </td>
                      <td>{product.sku}</td>
                      <td className="money-cell">{money(product.currency, product.unitPrice)}</td>
                      <td><span className={product.imageUrl ? 'status-pill ready' : 'status-pill pending'}>{product.imageUrl ? 'Disponible' : 'Pendiente'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showForm && canManageProducts && (
          <aside className="product-drawer" aria-label="Nuevo producto o servicio">
            <div className="drawer-heading">
              <div><p className="folio">CATÁLOGO</p><h2>Nuevo producto o servicio</h2></div>
              <button className="icon-button" type="button" aria-label="Cerrar formulario" onClick={() => { resetForm(); setShowForm(false); }}>×</button>
            </div>
            <form className="product-form" onSubmit={saveProduct} noValidate>
              <label htmlFor="new-product-sku">Código</label>
              <input id="new-product-sku" value={sku} onChange={(event) => setSku(event.target.value)} />
              <label htmlFor="new-product-name">Nombre</label>
              <input id="new-product-name" value={name} onChange={(event) => setName(event.target.value)} />
              <label htmlFor="new-product-description">Descripción</label>
              <textarea id="new-product-description" value={description} onChange={(event) => setDescription(event.target.value)} />
              <label htmlFor="new-product-price">Precio</label>
              <div className="money-input"><span>{access.currency === 'PEN' ? 'S/' : access.currency}</span><input id="new-product-price" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></div>
              <label htmlFor="new-product-image">URL de la imagen</label>
              <input id="new-product-image" type="url" placeholder="https://..." value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
              <p className="field-help">Use una imagen pública HTTP o HTTPS. No se cargan archivos al servidor.</p>
              <ProductImage src={previewUrl} name={name} preview />
              {error && <Alert severity="error">{error}</Alert>}
              <div className="drawer-actions">
                <button className="secondary-button" type="button" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</button>
                <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar producto'}</button>
              </div>
            </form>
          </aside>
        )}
      </div>
    </section>
  );
}

function BusinessWorkspace({
  api,
  profile,
  access,
  activeSection,
}: {
  api: ApiClient;
  profile: Profile;
  access: StoreAccess;
  activeSection: string;
}) {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [accountId, setAccountId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const purchaseKey = useRef<string | null>(null);
  const purchaseInFlight = useRef(false);

  useEffect(() => {
    void Promise.all([
      api.listAccounts(access.storeId),
      api.listProducts(access.storeId),
      api.listClients(access.storeId),
    ]).then(([nextAccounts, nextProducts]) => {
      setAccounts(nextAccounts);
      setProducts(nextProducts);
    });
  }, [access.storeId, api]);

  const available = useMemo(
    () =>
      accounts.reduce(
        (sum, account) =>
          sum + Number(account.creditLimit) - Number(account.originalOutstanding),
        0,
      ),
    [accounts],
  );

  async function submitPurchase(event: FormEvent) {
    event.preventDefault();
    if (purchaseInFlight.current) return;
    if (!accountId || !productId || !/^\d+(?:\.\d+)?$/.test(quantity)) {
      setError('Seleccione una cuenta, un producto y una cantidad válida.');
      return;
    }
    setError('');
    setNotice('');
    purchaseInFlight.current = true;
    setSubmitting(true);
    const idempotencyKey = purchaseKey.current ?? crypto.randomUUID();
    purchaseKey.current = idempotencyKey;
    try {
      const purchase = await api.createPurchase(access.storeId, {
        accountId,
        purchasedAt: new Date().toISOString(),
        currency: access.currency,
        mode: 'END_OF_MONTH',
        items: [{ productId, quantity }],
        idempotencyKey,
      });
      setNotice(`Compra registrada por ${money(access.currency, purchase.total)}.`);
      purchaseKey.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible registrar la compra.');
    } finally {
      purchaseInFlight.current = false;
      setSubmitting(false);
    }
  }

  if (activeSection === 'Productos y servicios') {
    return (
      <ProductCatalog
        api={api}
        access={access}
        products={products}
        setProducts={setProducts}
      />
    );
  }

  return (
    <>
      <section className="metric-strip">
        <article><span>Cuentas activas</span><strong>{accounts.length}</strong></article>
        <article><span>Crédito disponible</span><strong>{money(access.currency, String(available))}</strong></article>
        <article><span>Tienda</span><strong className="store-name">{access.storeName}</strong></article>
      </section>
      <div className="two-column-grid">
        <section className="paper-section">
          <p className="folio">OPERACIÓN · NUEVA COMPRA</p>
          <h2>Registrar consumo</h2>
          <form className="purchase-form" onSubmit={submitPurchase}>
            <label htmlFor="account">Cuenta</label>
            <select id="account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Seleccione una cuenta</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.accountNumber} · {account.customerName}</option>)}
            </select>
            <label htmlFor="product">Producto o servicio</label>
            <select id="product" value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Seleccione un concepto</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.currency, product.unitPrice)}</option>)}
            </select>
            <label htmlFor="quantity">Cantidad</label>
            <input id="quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <p className="field-help">El total, la tasa y la fecha de pago serán calculados por la API.</p>
            {error && <Alert severity="error">{error}</Alert>}
            {notice && <Alert severity="success">{notice}</Alert>}
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Registrando compra…' : 'Registrar compra'}
            </button>
          </form>
        </section>
        <section className="paper-section account-list" id="actividad">
          <p className="folio">CARTERA · CUENTAS</p>
          <h2>Saldos de capital</h2>
          {accounts.map((account) => (
            <article key={account.id}>
              <div><strong>{account.customerName}</strong><span>{account.accountNumber}</span></div>
              <strong>{money(account.currency, account.originalOutstanding)}</strong>
            </article>
          ))}
        </section>
      </div>
      <p className="audit-note">Operador: {profile.displayName}. Cada comando crítico utiliza una clave de idempotencia.</p>
    </>
  );
}

function BusinessArea({
  api,
  profile,
  access,
  onLogout,
}: {
  api: ApiClient;
  profile: Profile;
  access: StoreAccess;
  onLogout: () => void;
}) {
  const [activeSection, setActiveSection] = useState('Panel del negocio');
  const availableNavigation = ['Panel del negocio', 'Productos y servicios'];
  const title = activeSection === 'Productos y servicios'
    ? 'Productos y servicios'
    : 'Mesa de crédito';

  return (
    <WorkspaceShell
      profile={profile}
      title={title}
      kicker="Operación del negocio"
      navigation={businessNavigation}
      activeNavigation={activeSection}
      availableNavigation={availableNavigation}
      onNavigate={setActiveSection}
      onLogout={onLogout}
    >
      <BusinessWorkspace
        api={api}
        profile={profile}
        access={access}
        activeSection={activeSection}
      />
    </WorkspaceShell>
  );
}

function ClientWorkspace({ api }: { api: ApiClient }) {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [statements, setStatements] = useState<Array<{ id: string; dueDate: string; totalDue: string; currency: string }>>([]);
  const [purchases, setPurchases] = useState<Array<{ id: string; purchasedAt: string; total: string; currency: string }>>([]);

  useEffect(() => {
    void Promise.all([
      api.getMyAccounts(),
      api.getMyStatements(),
      api.getMyPurchases(),
    ]).then(([nextAccounts, nextStatements, nextPurchases]) => {
      setAccounts(nextAccounts);
      setStatements(nextStatements);
      setPurchases(nextPurchases);
    });
  }, [api]);

  return (
    <>
      <section className="client-balance-grid">
        {accounts.map((account) => (
          <article className="balance-ticket" key={account.id}>
            <span>{account.storeName}</span>
            <p>Capital pendiente</p>
            <strong>{money(account.currency, account.originalOutstanding)}</strong>
            <div><span>Cuenta {account.accountNumber}</span><span>Límite {money(account.currency, account.creditLimit)}</span></div>
          </article>
        ))}
      </section>
      <div className="two-column-grid" id="actividad">
        <section className="paper-section"><p className="folio">ESTADOS DE CUENTA</p><h2>Próximos vencimientos</h2>
          {statements.length === 0 ? <p className="empty-state">No hay estados de cuenta emitidos.</p> : statements.map((item) => <p key={item.id}>{item.dueDate} · {money(item.currency, item.totalDue)}</p>)}
        </section>
        <section className="paper-section"><p className="folio">HISTORIAL</p><h2>Compras recientes</h2>
          {purchases.length === 0 ? <p className="empty-state">No hay compras recientes.</p> : purchases.map((item) => <p key={item.id}>{item.purchasedAt.slice(0, 10)} · {money(item.currency, item.total)}</p>)}
        </section>
      </div>
    </>
  );
}

export function App({ api = defaultApi }: { api?: ApiClient }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [restoring, setRestoring] = useState(Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)));

  useEffect(() => {
    if (!restoring) return;
    void api
      .getProfile()
      .then(setProfile)
      .catch(() => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      })
      .finally(() => setRestoring(false));
  }, [api, restoring]);

  function logout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setProfile(null);
  }

  if (restoring) {
    return <main className="loading-screen"><CircularProgress /><p>Abriendo el libro de cuentas…</p></main>;
  }
  if (!profile) return <LoginPanel api={api} onAuthenticated={setProfile} />;

  if (profile.platformRole === 'PLATFORM_ADMIN') {
    return (
      <WorkspaceShell profile={profile} title="Control de plataforma" kicker="Gobierno y trazabilidad" navigation={platformNavigation} onLogout={logout}>
        <PlatformWorkspace api={api} profile={profile} />
      </WorkspaceShell>
    );
  }

  const businessAccess = profile.storeAccesses.find((access) =>
    ['STORE_ADMIN', 'OPERATOR'].includes(access.role),
  );
  if (businessAccess) {
    return <BusinessArea api={api} profile={profile} access={businessAccess} onLogout={logout} />;
  }

  return (
    <WorkspaceShell profile={profile} title="Mi CrediCuenta" kicker="Estado personal" navigation={clientNavigation} onLogout={logout}>
      <ClientWorkspace api={api} />
    </WorkspaceShell>
  );
}
