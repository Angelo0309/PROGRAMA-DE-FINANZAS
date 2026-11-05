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
  type ClientView,
  type ClientPaymentView,
  type CreditConditionView,
  type PaymentQuoteView,
  type PaymentReceiptView,
  type ProductView,
  type Profile,
  type ScheduleItemView,
  type StatementView,
  type StoreAccess,
} from './api/client';
import './styles.css';

const defaultApi = createApiClient();
const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Ingrese su correo o usuario.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});
const activationSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Ingrese su nombre completo.')
      .max(160, 'El nombre no puede superar 160 caracteres.'),
    username: z.string().trim().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.').max(80),
    password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres.').max(128),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: 'Las contraseñas no coinciden.',
    path: ['passwordConfirmation'],
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
const clientFormSchema = z.object({
  documentType: z.string().trim().min(1, 'Seleccione el tipo de documento.'),
  documentNumber: z.string().trim().min(6, 'Ingrese un número de documento válido.').max(24),
  fullName: z.string().trim().min(2, 'Ingrese el nombre completo.'),
  phone: z.string().trim().max(32),
  address: z.string().trim().max(255),
});
const accountFormSchema = z.object({
  customerId: z.string().min(1, 'Seleccione un cliente.'),
  accountNumber: z.string().trim().min(1, 'Ingrese el número de cuenta.').max(40),
  creditLimit: z.string().regex(/^\d+(?:\.\d+)?$/, 'Ingrese un límite válido.').refine((value) => Number(value) > 0, 'El límite debe ser mayor que cero.'),
  compensatoryRate: z.string().regex(/^\d+(?:\.\d+)?$/, 'Ingrese una tasa compensatoria válida.'),
  lateRate: z.string().regex(/^\d+(?:\.\d+)?$/, 'Ingrese una tasa moratoria válida.'),
  billingDay: z.coerce.number().int().min(1).max(30),
  dueDay: z.coerce.number().int().min(1).max(30),
  maxInstallments: z.coerce.number().int().min(1).max(120),
  graceMonths: z.coerce.number().int().min(0).max(24),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese la fecha de vigencia.'),
});

const money = (currency: string, amount: string) =>
  `${currency === 'PEN' ? 'S/' : currency} ${Number(amount).toFixed(2)}`;
const officialMoney = (currency: string, amount: string) =>
  `${currency === 'PEN' ? 'S/' : currency} ${amount}`;

const commercialDate = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

export function localDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

const commercialInstantInLima = (instant: string) =>
  commercialDate(localDateInTimeZone(new Date(instant), 'America/Lima'));

const rateAsPercentage = (rate: string) => `${(Number(rate) * 100).toFixed(2)} %`;
const rateKindLabel = (kind: CreditConditionView['compensatoryRateKind']) => kind === 'NOMINAL_ANNUAL' ? 'Nominal anual' : 'Efectiva anual';

const obligationStatus = (status: string) => ({
  PAID: { label: 'Pagada', tone: 'ready' },
  OVERDUE: { label: 'Vencida', tone: 'overdue' },
  VOIDED: { label: 'Anulada', tone: 'voided' },
  PENDING: { label: 'Pendiente', tone: 'pending' },
}[status] ?? { label: status, tone: 'pending' });

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

function ActivationPanel({
  api,
  token,
  onAuthenticated,
}: {
  api: ApiClient;
  token: string | null;
  onAuthenticated: (profile: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || inFlight.current) return;
    const parsed = activationSchema.safeParse({
      displayName,
      username,
      password,
      passwordConfirmation,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise los datos ingresados.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError('');
    let activationCompleted = false;
    try {
      const tokens = await api.activate({
        token,
        username: parsed.data.username,
        displayName: parsed.data.displayName,
        password: parsed.data.password,
      });
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      activationCompleted = true;
      window.history.replaceState({}, '', '/');
      onAuthenticated(await api.getProfile());
    } catch (reason) {
      if (!activationCompleted) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
      setPassword('');
      setPasswordConfirmation('');
      setError(
        activationCompleted
          ? 'Tu acceso se activó, pero no pudimos abrir la sesión. Recarga la página para continuar.'
          : reason instanceof Error
            ? reason.message
            : 'No fue posible activar la invitación.',
      );
    } finally {
      inFlight.current = false;
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
        <h2>Activa tu acceso</h2>
        <p className="muted">Define tus datos para ingresar con el rol asignado.</p>
        {!token && (
          <Alert severity="warning">
            Este enlace no contiene un token válido. Solicita una invitación nueva.
          </Alert>
        )}
        <form onSubmit={submit} noValidate>
          <label htmlFor="activation-display-name">Nombre completo</label>
          <input
            id="activation-display-name"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <label htmlFor="activation-username">Nombre de usuario</label>
          <input
            id="activation-username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="activation-password">Contraseña</label>
          <input
            id="activation-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label htmlFor="activation-password-confirmation">Confirma tu contraseña</label>
          <input
            id="activation-password-confirmation"
            type="password"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <button className="primary-button" disabled={!token || submitting} type="submit">
            {submitting ? 'Activando…' : 'Activar acceso'}
          </button>
        </form>
        <p className="help-copy">La invitación es personal y solo puede utilizarse una vez.</p>
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

function PlatformWorkspace({ api, profile, activeSection }: { api: ApiClient; profile: Profile; activeSection: string }) {
  const [stores, setStores] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const [events, setEvents] = useState<Array<{ id: string; event: string; createdAt: string }>>([]);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStoreId, setInviteStoreId] = useState('');
  const [activationLink, setActivationLink] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
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
      setActivationLink(
        `${window.location.origin}/activar?token=${encodeURIComponent(invitation.token)}`,
      );
      setCopyNotice('');
      setInviteEmail('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear la invitación.');
    }
  }

  async function copyActivationLink() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(activationLink);
      setCopyNotice('Enlace copiado.');
    } catch {
      setCopyNotice('');
    }
  }

  async function deactivateStore(storeId: string) {
    try {
      await api.deactivateStore(storeId);
      setStores((current) => current.map((store) => store.id === storeId ? { ...store, active: false } : store));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible desactivar la tienda.');
    }
  }

  const showStores = activeSection === 'Dashboard' || activeSection === 'Gestión de tiendas';
  const showUsers = activeSection === 'Dashboard' || activeSection === 'Gestión de usuarios';

  return (
    <>
      <section className="metric-strip" aria-label="Indicadores de plataforma">
        <article><span>Tiendas registradas</span><strong>{stores.length}</strong></article>
        <article><span>Eventos visibles</span><strong>{events.length}</strong></article>
        <article><span>Estado</span><strong className="status-word">Operativa</strong></article>
      </section>
      {showStores && <section className="paper-section" id="actividad">
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
          <table><thead><tr><th>Tienda</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
            {stores.map((store) => <tr key={store.id}><td>{store.name}</td><td>{store.active ? 'Activa' : 'Inactiva'}</td><td>{store.active ? <button className="table-action" type="button" aria-label={`Desactivar ${store.name}`} onClick={() => void deactivateStore(store.id)}>Desactivar</button> : '—'}</td></tr>)}
          </tbody></table>
        )}
      </section>}
      {showStores && error && <Alert severity="error">{error}</Alert>}
      {showUsers && <section className="paper-section invitation-section">
        <div><p className="folio">ACCESOS · INVITACIÓN</p><h2>Administrador del negocio</h2></div>
        <form className="inline-form" onSubmit={inviteAdministrator}>
          <label htmlFor="invite-store">Tienda asignada</label>
          <select id="invite-store" value={inviteStoreId} onChange={(event) => setInviteStoreId(event.target.value)}>
            <option value="">Seleccione una tienda</option>
            {stores.filter((store) => store.active).map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <label htmlFor="invite-email">Correo del administrador</label>
          <input id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
          <button className="primary-button" type="submit">Crear invitación</button>
        </form>
        {activationLink && (
          <div className="invitation-link">
            <label htmlFor="activation-link">Enlace de activación</label>
            <div>
              <input id="activation-link" readOnly value={activationLink} />
              <button className="secondary-button" type="button" onClick={() => void copyActivationLink()}>
                Copiar enlace
              </button>
            </div>
            <p className="field-help">
              Este enlace se muestra una sola vez. Entrégalo únicamente a la persona invitada.
              {copyNotice && <> {copyNotice}</>}
            </p>
          </div>
        )}
        {!showStores && error && <Alert severity="error">{error}</Alert>}
      </section>}
      {activeSection === 'Auditoría' && <section className="paper-section"><p className="folio">TRAZABILIDAD</p><h2>Eventos de auditoría</h2>{events.length === 0 ? <p className="empty-state">No hay eventos registrados.</p> : <div className="table-wrapper"><table aria-label="Eventos de auditoría"><thead><tr><th>Evento</th><th>Fecha</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.event}</td><td>{commercialInstantInLima(event.createdAt)}</td></tr>)}</tbody></table></div>}</section>}
      {!['Dashboard', 'Gestión de tiendas', 'Gestión de usuarios', 'Auditoría'].includes(activeSection) && <section className="paper-section"><h2>{activeSection}</h2><p className="empty-state">Esta sección queda reservada para una ampliación posterior; no forma parte del alcance académico actual.</p></section>}
      <p className="audit-note">Sesión de plataforma: {profile.displayName}. Las altas e invitaciones quedan en auditoría.</p>
    </>
  );
}

function PlatformArea({ api, profile, onLogout }: { api: ApiClient; profile: Profile; onLogout: () => void }) {
  const [activeSection, setActiveSection] = useState('Dashboard');
  return <WorkspaceShell profile={profile} title={activeSection === 'Dashboard' ? 'Control de plataforma' : activeSection} kicker="Gobierno y trazabilidad" navigation={platformNavigation} activeNavigation={activeSection} onNavigate={setActiveSection} onLogout={onLogout}><PlatformWorkspace api={api} profile={profile} activeSection={activeSection} /></WorkspaceShell>;
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

function ClientManagement({
  api,
  access,
  clients,
  setClients,
  accounts,
}: {
  api: ApiClient;
  access: StoreAccess;
  clients: ClientView[];
  setClients: Dispatch<SetStateAction<ClientView[]>>;
  accounts: AccountView[];
}) {
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [documentType, setDocumentType] = useState('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const canManageClients = access.role === 'STORE_ADMIN';
  const filteredClients = clients.filter((client) => {
    const term = search.trim().toLocaleLowerCase('es-PE');
    if (!term) return true;
    return [client.fullName, client.documentNumber, client.phone ?? '']
      .some((value) => value.toLocaleLowerCase('es-PE').includes(term));
  });
  const selectedClient = clients.find((client) => client.id === selectedClientId)
    ?? filteredClients[0]
    ?? null;
  const accountsFor = (client: ClientView) => accounts.filter(
    (account) => account.customerId === client.id
      || (!account.customerId && account.customerName === client.fullName),
  );
  const rows = filteredClients.flatMap<{ client: ClientView; account: AccountView | null }>((client) => {
    const clientAccounts = accountsFor(client);
    return clientAccounts.length > 0
      ? clientAccounts.map((account) => ({ client, account }))
      : [{ client, account: null }];
  });
  const totalAvailable = accounts.reduce(
    (sum, account) => sum + Number(account.creditLimit) - Number(account.originalOutstanding),
    0,
  );

  function resetForm() {
    setDocumentType('DNI');
    setDocumentNumber('');
    setFullName('');
    setPhone('');
    setAddress('');
    setError('');
  }

  async function saveClient(event: FormEvent) {
    event.preventDefault();
    const parsed = clientFormSchema.safeParse({
      documentType,
      documentNumber,
      fullName,
      phone,
      address,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise los datos ingresados.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const client = await api.createClient(access.storeId, {
        documentType: parsed.data.documentType,
        documentNumber: parsed.data.documentNumber,
        fullName: parsed.data.fullName,
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.address ? { address: parsed.data.address } : {}),
      });
      setClients((current) => [...current, client].sort((left, right) => left.fullName.localeCompare(right.fullName, 'es')));
      setSelectedClientId(client.id);
      setNotice('Cliente guardado correctamente.');
      resetForm();
      setShowForm(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible guardar el cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="client-page">
      <div className="page-lead">
        <p>Consulta la identidad del cliente y los saldos oficiales de sus cuentas.</p>
        {canManageClients && (
          <button className="primary-button compact-button" type="button" onClick={() => setShowForm(true)}>
            + Nuevo cliente
          </button>
        )}
      </div>

      {notice && <Alert severity="success">{notice}</Alert>}
      <div className="catalog-toolbar">
        <label className="search-field" htmlFor="client-search">
          <span>Buscar en el directorio</span>
          <input
            id="client-search"
            type="search"
            placeholder="Nombre, documento o teléfono"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="catalog-count">{filteredClients.length} de {clients.length} clientes</span>
      </div>

      <section className="metric-strip product-metrics" aria-label="Indicadores de clientes">
        <article><span>Clientes activos</span><strong>{clients.length}</strong></article>
        <article><span>Cuentas activas</span><strong>{accounts.length}</strong></article>
        <article><span>Crédito disponible</span><strong>{money(access.currency, String(totalAvailable))}</strong></article>
      </section>

      <div className={showForm ? 'catalog-layout form-open' : 'catalog-layout'}>
        <div className="client-content">
          <section className="catalog-panel">
            <div className="catalog-panel-heading">
              <h2>Directorio de clientes</h2>
              <span>Seleccione un cliente para ver sus cuentas</span>
            </div>
            {rows.length === 0 ? (
              <p className="empty-state catalog-empty">No se encontraron clientes con ese criterio.</p>
            ) : (
              <div className="table-wrapper">
                <table className="client-table" aria-label="Clientes y cuentas">
                  <thead><tr><th>Cliente</th><th>Documento</th><th>Moneda</th><th>Límite</th><th>Utilizado</th><th>Disponible</th></tr></thead>
                  <tbody>
                    {rows.map(({ client, account }) => (
                      <tr className={selectedClient?.id === client.id ? 'selected-row' : ''} key={`${client.id}-${account?.id ?? 'no-account'}`}>
                        <td><button className="table-link" type="button" onClick={() => setSelectedClientId(client.id)}>{client.fullName}</button></td>
                        <td>{client.documentType} {client.documentNumber}</td>
                        <td>{account?.currency ?? '—'}</td>
                        <td>{account ? money(account.currency, account.creditLimit) : 'Sin cuenta'}</td>
                        <td>{account ? money(account.currency, account.originalOutstanding) : '—'}</td>
                        <td>{account ? money(account.currency, String(Number(account.creditLimit) - Number(account.originalOutstanding))) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="client-detail-panel" aria-live="polite">
            {selectedClient ? (
              <>
                <div className="client-identity">
                  <div><span>Cliente seleccionado</span><h2>{selectedClient.fullName}</h2></div>
                  <p>{selectedClient.documentType} {selectedClient.documentNumber}</p>
                </div>
                <div className="client-contact"><span>{selectedClient.phone || 'Sin teléfono'}</span><span>{selectedClient.address || 'Sin dirección'}</span></div>
                <div className="selected-accounts">
                  {accountsFor(selectedClient).length === 0 ? (
                    <p className="empty-state">Este cliente todavía no tiene una cuenta de crédito activa.</p>
                  ) : accountsFor(selectedClient).map((account) => (
                    <article key={account.id}>
                      <div><span>Cuenta</span><strong>{account.accountNumber}</strong></div>
                      <div><span>Límite</span><strong>{money(account.currency, account.creditLimit)}</strong></div>
                      <div><span>Capital utilizado</span><strong>{money(account.currency, account.originalOutstanding)}</strong></div>
                      <div><span>Disponible</span><strong>{money(account.currency, String(Number(account.creditLimit) - Number(account.originalOutstanding)))}</strong></div>
                    </article>
                  ))}
                </div>
              </>
            ) : <p className="empty-state">Registre un cliente para comenzar.</p>}
          </section>
        </div>

        {showForm && canManageClients && (
          <aside className="product-drawer" aria-label="Nuevo cliente">
            <div className="drawer-heading">
              <div><p className="folio">DIRECTORIO</p><h2>Nuevo cliente</h2></div>
              <button className="icon-button" type="button" aria-label="Cerrar formulario" onClick={() => { resetForm(); setShowForm(false); }}>×</button>
            </div>
            <form className="product-form" onSubmit={saveClient} noValidate>
              <label htmlFor="client-document-type">Tipo de documento</label>
              <select id="client-document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                <option value="DNI">DNI</option>
                <option value="CE">Carné de extranjería</option>
                <option value="RUC">RUC</option>
              </select>
              <label htmlFor="client-document-number">Número de documento</label>
              <input id="client-document-number" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} />
              <label htmlFor="client-full-name">Nombre completo</label>
              <input id="client-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              <label htmlFor="client-phone">Teléfono</label>
              <input id="client-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <label htmlFor="client-address">Dirección</label>
              <textarea id="client-address" value={address} onChange={(event) => setAddress(event.target.value)} />
              <p className="field-help">La cuenta de crédito y sus condiciones se registran como una operación separada.</p>
              {error && <Alert severity="error">{error}</Alert>}
              <div className="drawer-actions">
                <button className="secondary-button" type="button" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</button>
                <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cliente'}</button>
              </div>
            </form>
          </aside>
        )}
      </div>
    </section>
  );
}

type PurchaseLine = {
  productId: string;
  quantity: string;
};

function PurchaseRegistration({
  api,
  access,
  accounts,
  products,
  onPurchaseSaved,
}: {
  api: ApiClient;
  access: StoreAccess;
  accounts: AccountView[];
  products: ProductView[];
  onPurchaseSaved: () => Promise<void>;
}) {
  const [accountId, setAccountId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [mode, setMode] = useState<'END_OF_MONTH' | 'INSTALLMENTS'>('END_OF_MONTH');
  const [installmentCount, setInstallmentCount] = useState('2');
  const [items, setItems] = useState<PurchaseLine[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const purchaseKey = useRef<string | null>(null);
  const purchaseInFlight = useRef(false);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const selectedProduct = products.find((product) => product.id === productId);

  function addItem() {
    if (!selectedProduct || !/^\d+(?:\.\d+)?$/.test(quantity) || Number(quantity) <= 0) {
      setError('Seleccione un producto y escriba una cantidad válida.');
      return;
    }
    setItems((current) => {
      const existing = current.some((item) => item.productId === selectedProduct.id);
      if (existing) {
        return current.map((item) => item.productId === selectedProduct.id
          ? { ...item, quantity }
          : item);
      }
      return [...current, { productId: selectedProduct.id, quantity }];
    });
    setProductId('');
    setQuantity('1');
    setError('');
    setNotice('');
  }

  function clearPurchase() {
    setAccountId('');
    setProductId('');
    setQuantity('1');
    setMode('END_OF_MONTH');
    setInstallmentCount('2');
    setItems([]);
    setError('');
    setNotice('');
    purchaseKey.current = null;
  }

  async function submitPurchase(event: FormEvent) {
    event.preventDefault();
    if (purchaseInFlight.current) return;
    if (!accountId || items.length === 0) {
      setError('Seleccione una cuenta y agregue al menos un producto al detalle.');
      return;
    }
    if (mode === 'INSTALLMENTS' && (!/^\d+$/.test(installmentCount) || Number(installmentCount) < 1)) {
      setError('Ingrese un número de cuotas válido.');
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
        mode,
        ...(mode === 'INSTALLMENTS' ? { installmentCount: Number(installmentCount) } : {}),
        items,
        idempotencyKey,
      });
      setNotice(`Compra registrada por ${money(access.currency, purchase.total)}.`);
      setItems([]);
      setProductId('');
      setQuantity('1');
      purchaseKey.current = null;
      await onPurchaseSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible registrar la compra.');
    } finally {
      purchaseInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="purchase-page">
      <div className="page-lead">
        <p>Registra los consumos del cliente. El límite, la condición vigente, los intereses y el importe oficial se validan en el servidor.</p>
      </div>

      <form className="purchase-registration" aria-label="Registro de compra" onSubmit={submitPurchase} noValidate>
        <div className="purchase-main-grid">
          <section className="purchase-panel" aria-labelledby="purchase-data-title">
            <div className="purchase-panel-heading">
              <div><p className="folio">PASO 01</p><h2 id="purchase-data-title">Datos de la operación</h2></div>
              <span>Cuenta y conceptos</span>
            </div>
            <div className="purchase-fields">
              <label htmlFor="purchase-account">Cuenta</label>
              <select id="purchase-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="">Seleccione una cuenta</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.accountNumber} · {account.customerName}</option>)}
              </select>

              {selectedAccount && (
                <div className="selected-account-card">
                  <div><span>Cliente</span><strong>{selectedAccount.customerName}</strong></div>
                  <div><span>Cuenta</span><strong>{selectedAccount.accountNumber}</strong></div>
                  <div><span>Disponible referencial</span><strong>{money(selectedAccount.currency, String(Number(selectedAccount.creditLimit) - Number(selectedAccount.originalOutstanding)))}</strong></div>
                </div>
              )}

              <label htmlFor="purchase-product">Producto o servicio</label>
              <select id="purchase-product" value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">Seleccione un concepto</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.currency, product.unitPrice)}</option>)}
              </select>

              {selectedProduct && (
                <div className="purchase-product-preview">
                  <ProductImage src={selectedProduct.imageUrl} name={selectedProduct.name} />
                  <div><strong>{selectedProduct.name}</strong><span>{selectedProduct.sku} · Precio unitario {money(selectedProduct.currency, selectedProduct.unitPrice)}</span></div>
                </div>
              )}

              <div className="quantity-row">
                <label htmlFor="purchase-quantity">Cantidad
                  <input id="purchase-quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </label>
                <button className="secondary-button" type="button" onClick={addItem}>+ Agregar al detalle</button>
              </div>
            </div>
          </section>

          <section className="purchase-panel" aria-labelledby="payment-data-title">
            <div className="purchase-panel-heading">
              <div><p className="folio">PASO 02</p><h2 id="payment-data-title">Condiciones de pago</h2></div>
              <span>Según contrato vigente</span>
            </div>
            <div className="purchase-fields">
              <label htmlFor="purchase-mode">Modalidad de pago</label>
              <select id="purchase-mode" value={mode} onChange={(event) => setMode(event.target.value as 'END_OF_MONTH' | 'INSTALLMENTS')}>
                <option value="END_OF_MONTH">Pago a fin de mes</option>
                <option value="INSTALLMENTS">Plan de cuotas</option>
              </select>

              {mode === 'INSTALLMENTS' && (
                <>
                  <label htmlFor="installment-count">Número de cuotas</label>
                  <input id="installment-count" type="number" min="1" step="1" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} />
                </>
              )}

              <div className="server-rule-card">
                <span className="status-pill ready">Validación automática</span>
                <h3>El backend conserva el control financiero</h3>
                <p>Al registrar, la API comprobará el límite disponible, la moneda, el máximo de cuotas y las condiciones vigentes. El total oficial aparecerá únicamente después de esa validación.</p>
              </div>
            </div>
          </section>
        </div>

        <section className="purchase-detail-panel" aria-labelledby="purchase-detail-title">
          <div className="catalog-panel-heading">
            <div><p className="folio">PASO 03</p><h2 id="purchase-detail-title">Detalle de la operación</h2></div>
            <span>{items.length} {items.length === 1 ? 'concepto agregado' : 'conceptos agregados'}</span>
          </div>
          {items.length === 0 ? (
            <p className="empty-state purchase-empty">Seleccione un producto y agréguelo para construir el detalle de compra.</p>
          ) : (
            <div className="table-wrapper">
              <table className="purchase-detail-table" aria-label="Detalle de productos de la compra">
                <thead><tr><th>Producto o servicio</th><th>Cantidad</th><th>Precio unitario</th><th>Acción</th></tr></thead>
                <tbody>
                  {items.map((item) => {
                    const product = products.find((candidate) => candidate.id === item.productId);
                    if (!product) return null;
                    return (
                      <tr key={item.productId}>
                        <td><div className="product-cell"><ProductImage src={product.imageUrl} name={product.name} /><div><strong>{product.name}</strong><span>{product.sku}</span></div></div></td>
                        <td>{item.quantity}</td>
                        <td className="money-cell">{money(product.currency, product.unitPrice)}</td>
                        <td><button className="table-action" type="button" onClick={() => setItems((current) => current.filter((line) => line.productId !== item.productId))}>Quitar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        <div className="purchase-actions">
          <p>Los importes se envían y reciben como cadenas decimales, sin cálculos oficiales en el navegador.</p>
          <div>
            <button className="secondary-button" type="button" onClick={clearPurchase} disabled={submitting}>Limpiar</button>
            <button className="primary-button" type="submit" disabled={submitting || items.length === 0}>{submitting ? 'Registrando compra…' : 'Registrar compra'}</button>
          </div>
        </div>
      </form>
    </section>
  );
}

function AccountManagement({
  api,
  access,
  clients,
  accounts,
  setAccounts,
}: {
  api: ApiClient;
  access: StoreAccess;
  clients: ClientView[];
  accounts: AccountView[];
  setAccounts: Dispatch<SetStateAction<AccountView[]>>;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? '');
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [compensatoryRate, setCompensatoryRate] = useState('0.24');
  const [lateRate, setLateRate] = useState('0.36');
  const [billingDay, setBillingDay] = useState('20');
  const [dueDay, setDueDay] = useState('28');
  const [maxInstallments, setMaxInstallments] = useState('6');
  const [graceMonths, setGraceMonths] = useState('0');
  const [validFrom, setValidFrom] = useState(localDateInTimeZone(new Date(), 'America/Lima'));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  const canManageAccounts = access.role === 'STORE_ADMIN';

  useEffect(() => {
    if (!selectedAccountId && accounts[0]) setSelectedAccountId(accounts[0].id);
  }, [accounts, selectedAccountId]);

  function resetForm() {
    setCustomerId('');
    setAccountNumber('');
    setCreditLimit('');
    setCompensatoryRate('0.24');
    setLateRate('0.36');
    setBillingDay('20');
    setDueDay('28');
    setMaxInstallments('6');
    setGraceMonths('0');
    setValidFrom(localDateInTimeZone(new Date(), 'America/Lima'));
    setError('');
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault();
    const parsed = accountFormSchema.safeParse({
      customerId,
      accountNumber,
      creditLimit,
      compensatoryRate,
      lateRate,
      billingDay,
      dueDay,
      maxInstallments,
      graceMonths,
      validFrom,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise los datos de la cuenta.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const account = await api.createAccount(access.storeId, {
        customerId: parsed.data.customerId,
        accountNumber: parsed.data.accountNumber,
        currency: access.currency,
        creditLimit: parsed.data.creditLimit,
        initialCondition: {
          compensatoryRateKind: 'EFFECTIVE_ANNUAL',
          compensatoryRate: parsed.data.compensatoryRate,
          lateRateKind: 'EFFECTIVE_ANNUAL',
          lateRate: parsed.data.lateRate,
          billingDay: parsed.data.billingDay,
          dueDay: parsed.data.dueDay,
          maxInstallments: parsed.data.maxInstallments,
          graceMonths: parsed.data.graceMonths,
          validFrom: `${parsed.data.validFrom}T00:00:00-05:00`,
        },
      });
      const customer = clients.find((client) => client.id === parsed.data.customerId);
      const completeAccount = { ...account, customerName: customer?.fullName };
      setAccounts((current) => [...current, completeAccount].sort((left, right) => left.accountNumber.localeCompare(right.accountNumber)));
      setSelectedAccountId(account.id);
      setNotice('Cuenta y condición crediticia guardadas correctamente.');
      resetForm();
      setShowForm(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible guardar la cuenta.');
    } finally {
      setSaving(false);
    }
  }

  const condition = selectedAccount?.currentCondition;

  return (
    <section className="account-page">
      <div className="page-lead">
        <p>Administra límites, capital original pendiente y condiciones financieras por cliente.</p>
        {canManageAccounts && <button className="primary-button compact-button" type="button" onClick={() => setShowForm(true)}>+ Nueva cuenta</button>}
      </div>
      {notice && <Alert severity="success">{notice}</Alert>}

      <section className="metric-strip product-metrics" aria-label="Indicadores de cuentas">
        <article><span>Cuentas activas</span><strong>{accounts.length}</strong></article>
        <article><span>Con condición vigente</span><strong>{accounts.filter((account) => account.currentCondition).length}</strong></article>
        <article><span>Moneda de la tienda</span><strong className="store-name">{access.currency}</strong></article>
      </section>

      <div className={showForm ? 'account-layout form-open' : 'account-layout'}>
        <div className="account-content">
          <section className="catalog-panel" aria-labelledby="accounts-title">
            <div className="catalog-panel-heading"><h2 id="accounts-title">Cuentas corrientes</h2><span>Límites y saldos oficiales</span></div>
            <div className="table-wrapper">
              <table className="account-table" aria-label="Cuentas corrientes de clientes">
                <thead><tr><th>Cliente</th><th>Cuenta</th><th>Límite</th><th>Capital utilizado</th><th>Disponible</th><th>Condición</th></tr></thead>
                <tbody>{accounts.map((account) => (
                  <tr key={account.id} className={selectedAccount?.id === account.id ? 'selected-row' : ''}>
                    <td><button className="table-link" type="button" onClick={() => setSelectedAccountId(account.id)}>{account.customerName}</button></td>
                    <td>{account.accountNumber}</td>
                    <td className="money-cell">{money(account.currency, account.creditLimit)}</td>
                    <td>{money(account.currency, account.originalOutstanding)}</td>
                    <td>{money(account.currency, String(Number(account.creditLimit) - Number(account.originalOutstanding)))}</td>
                    <td><span className={`status-pill ${account.currentCondition ? 'ready' : 'pending'}`}>{account.currentCondition ? `Versión ${account.currentCondition.version}` : 'Pendiente'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          {selectedAccount && (
            <section className="account-condition-panel" aria-labelledby="condition-title">
              <div className="account-condition-heading">
                <div><span>{selectedAccount.accountNumber} · {selectedAccount.currency}</span><h2 id="condition-title">{selectedAccount.customerName}</h2></div>
                <strong>{money(selectedAccount.currency, String(Number(selectedAccount.creditLimit) - Number(selectedAccount.originalOutstanding)))} disponible</strong>
              </div>
              {condition ? <ConditionDetails condition={condition} /> : <p className="empty-state">Esta cuenta todavía no tiene una condición crediticia vigente.</p>}
            </section>
          )}
        </div>

        {showForm && canManageAccounts && (
          <aside className="product-drawer" aria-label="Nueva cuenta corriente">
            <div className="drawer-heading"><div><p className="folio">CRÉDITO</p><h2>Nueva cuenta</h2></div><button className="icon-button" type="button" aria-label="Cerrar formulario" onClick={() => { resetForm(); setShowForm(false); }}>×</button></div>
            <form className="product-form account-form" onSubmit={saveAccount} noValidate>
              <label htmlFor="account-customer">Cliente</label>
              <select id="account-customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Seleccione un cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.fullName} · {client.documentNumber}</option>)}</select>
              <label htmlFor="account-number">Número de cuenta</label><input id="account-number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
              <label htmlFor="credit-limit">Límite de crédito</label><input id="credit-limit" inputMode="decimal" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} />
              <div className="form-divider"><span>Condición inicial</span></div>
              <div className="form-pair"><label htmlFor="compensatory-rate">Tasa compensatoria<input id="compensatory-rate" inputMode="decimal" value={compensatoryRate} onChange={(event) => setCompensatoryRate(event.target.value)} /></label><label htmlFor="late-rate">Tasa moratoria<input id="late-rate" inputMode="decimal" value={lateRate} onChange={(event) => setLateRate(event.target.value)} /></label></div>
              <p className="field-help">Las tasas se ingresan por unidad: 0.24 equivale a 24 % efectiva anual.</p>
              <div className="form-pair"><label htmlFor="billing-day">Día de corte<input id="billing-day" type="number" min="1" max="30" value={billingDay} onChange={(event) => setBillingDay(event.target.value)} /></label><label htmlFor="due-day">Día de vencimiento<input id="due-day" type="number" min="1" max="30" value={dueDay} onChange={(event) => setDueDay(event.target.value)} /></label></div>
              <div className="form-pair"><label htmlFor="max-installments">Máximo de cuotas<input id="max-installments" type="number" min="1" max="120" value={maxInstallments} onChange={(event) => setMaxInstallments(event.target.value)} /></label><label htmlFor="grace-months">Meses de gracia<input id="grace-months" type="number" min="0" max="24" value={graceMonths} onChange={(event) => setGraceMonths(event.target.value)} /></label></div>
              <label htmlFor="valid-from">Vigente desde</label><input id="valid-from" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
              {error && <Alert severity="error">{error}</Alert>}
              <div className="drawer-actions"><button className="secondary-button" type="button" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear cuenta'}</button></div>
            </form>
          </aside>
        )}
      </div>
    </section>
  );
}

function ConditionDetails({ condition }: { condition: CreditConditionView }) {
  return (
    <div className="condition-grid">
      <div><span>Tasa compensatoria</span><strong>{rateAsPercentage(condition.compensatoryRate)}</strong><small>{rateKindLabel(condition.compensatoryRateKind)}</small></div>
      <div><span>Tasa moratoria</span><strong>{rateAsPercentage(condition.lateRate)}</strong><small>{rateKindLabel(condition.lateRateKind)}</small></div>
      <div><span>Ciclo de pago</span><strong>Corte {condition.billingDay} · Pago {condition.dueDay}</strong><small>Mes comercial</small></div>
      <div><span>Plan permitido</span><strong>Máximo {condition.maxInstallments} cuotas</strong><small>{condition.graceMonths} meses de gracia total</small></div>
      <div><span>Vigencia</span><strong>Desde {commercialDate(condition.validFrom)}</strong><small>Versión {condition.version}</small></div>
    </div>
  );
}

function PaymentPlans({ api, access, accounts }: { api: ApiClient; access: StoreAccess; accounts: AccountView[] }) {
  const [accountId, setAccountId] = useState('');
  const [schedule, setSchedule] = useState<ScheduleItemView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scheduleRequest = useRef(0);
  const selectedAccount = accounts.find((account) => account.id === accountId);

  useEffect(() => {
    const requestId = ++scheduleRequest.current;
    setSchedule([]);
    setError('');
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void api.getSchedule(accountId, access.storeId)
      .then((nextSchedule) => {
        if (scheduleRequest.current === requestId) setSchedule(nextSchedule);
      })
      .catch((reason: unknown) => {
        if (scheduleRequest.current === requestId) {
          setError(reason instanceof Error ? reason.message : 'No fue posible consultar el cronograma.');
        }
      })
      .finally(() => {
        if (scheduleRequest.current === requestId) setLoading(false);
      });
  }, [access.storeId, accountId, api]);

  const nextPending = schedule.find((item) => item.status === 'PENDING' || item.status === 'OVERDUE');

  return (
    <section className="schedule-page">
      <div className="page-lead"><p>Consulta el plan francés y las obligaciones calculadas por el motor financiero.</p></div>
      <section className="schedule-selector">
        <label htmlFor="schedule-account">Cuenta del cliente</label>
        <select id="schedule-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Seleccione una cuenta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.customerName} · {account.accountNumber}</option>)}</select>
      </section>

      {selectedAccount && (
        <section className="metric-strip schedule-metrics" aria-label="Resumen del plan de pago">
          <article><span>Límite de crédito</span><strong>{money(selectedAccount.currency, selectedAccount.creditLimit)}</strong></article>
          <article><span>Capital original pendiente</span><strong>{money(selectedAccount.currency, selectedAccount.originalOutstanding)}</strong></article>
          <article><span>Obligaciones del plan</span><strong>{schedule.length}</strong></article>
          <article><span>Próximo vencimiento</span><strong className="store-name">{nextPending ? commercialDate(nextPending.dueDate) : 'Sin pendientes'}</strong></article>
        </section>
      )}

      {error && <Alert severity="error">{error}</Alert>}
      <section className="catalog-panel schedule-panel" aria-labelledby="schedule-title">
        <div className="catalog-panel-heading"><div><p className="folio">CRONOGRAMA OFICIAL</p><h2 id="schedule-title">Plan de pagos</h2></div><span>{loading ? 'Consultando…' : `${schedule.length} obligaciones`}</span></div>
        {!accountId ? <p className="empty-state schedule-empty">Seleccione una cuenta para consultar su cronograma.</p> : loading ? <div className="schedule-loading"><CircularProgress size={24} /><span>Consultando obligaciones…</span></div> : schedule.length === 0 ? <p className="empty-state schedule-empty">La cuenta no tiene obligaciones en cuotas.</p> : (
          <div className="table-wrapper"><table className="schedule-table" aria-label="Cronograma de pagos"><thead><tr><th>Cuota</th><th>Vencimiento</th><th>Saldo inicial</th><th>Interés</th><th>Capital</th><th>Importe exigible</th><th>Pagado</th><th>Estado</th></tr></thead><tbody>{schedule.map((item) => { const status = obligationStatus(item.status); return <tr key={item.id}><td>{item.installmentNumber}</td><td>{commercialDate(item.dueDate)}</td><td>{money(item.currency, item.openingBalance)}</td><td>{money(item.currency, item.compensatoryInterest)}</td><td>{money(item.currency, item.principalDue)}</td><td className="money-cell">{money(item.currency, item.amountDue)}</td><td>{money(item.currency, item.paidAmount)}</td><td><span className={`status-pill ${status.tone}`}>{status.label}</span></td></tr>; })}</tbody></table></div>
        )}
      </section>
      <p className="audit-note">Las cuotas, intereses y fechas provienen de la API. El frontend no reconstruye el plan financiero.</p>
    </section>
  );
}

function PaymentRegistration({
  api,
  access,
  accounts,
  onPaymentSaved,
}: {
  api: ApiClient;
  access: StoreAccess;
  accounts: AccountView[];
  onPaymentSaved: () => Promise<void>;
}) {
  const [accountId, setAccountId] = useState('');
  const [quote, setQuote] = useState<PaymentQuoteView | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceiptView | null>(null);
  const [paymentInstant, setPaymentInstant] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const quoteRequest = useRef(0);
  const paymentKey = useRef<string | null>(null);
  const paymentInFlight = useRef(false);
  const selectedAccount = accounts.find((account) => account.id === accountId);

  useEffect(() => {
    const requestId = ++quoteRequest.current;
    setQuote(null);
    setReceipt(null);
    setError('');
    setNotice('');
    paymentKey.current = null;
    if (!accountId) {
      setLoading(false);
      return;
    }
    const paidAt = new Date().toISOString();
    setPaymentInstant(paidAt);
    setLoading(true);
    void api.getPaymentQuote(accountId, access.storeId, paidAt)
      .then((nextQuote) => {
        if (quoteRequest.current === requestId) setQuote(nextQuote);
      })
      .catch((reason: unknown) => {
        if (quoteRequest.current === requestId) {
          setError(reason instanceof Error ? reason.message : 'No fue posible consultar el importe exigible.');
        }
      })
      .finally(() => {
        if (quoteRequest.current === requestId) setLoading(false);
      });
  }, [access.storeId, accountId, api]);

  async function submitPayment() {
    if (!quote || !accountId || paymentInFlight.current) return;
    paymentInFlight.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');
    const idempotencyKey = paymentKey.current ?? crypto.randomUUID();
    paymentKey.current = idempotencyKey;
    try {
      const payment = await api.createPayment(accountId, {
        storeId: access.storeId,
        paidAt: paymentInstant,
        currency: quote.currency,
        amount: quote.amount,
        idempotencyKey,
      });
      const nextReceipt = await api.getReceipt(payment.id, access.storeId);
      setReceipt(nextReceipt);
      setQuote(null);
      setNotice('Pago registrado correctamente.');
      paymentKey.current = null;
      await onPaymentSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible registrar el pago.');
    } finally {
      paymentInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="payment-page">
      <div className="page-lead"><p>Registra únicamente el pago completo exigible. La mora y la prelación se calculan en el servidor.</p></div>
      <section className="schedule-selector payment-selector">
        <label htmlFor="payment-account">Cuenta del cliente</label>
        <select id="payment-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Seleccione una cuenta</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.customerName} · {account.accountNumber}</option>)}
        </select>
      </section>

      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {loading ? (
        <div className="schedule-loading"><CircularProgress size={24} /><span>Calculando el importe exigible…</span></div>
      ) : selectedAccount && quote ? (
        <div className="payment-layout">
          <section className="payment-quote" aria-label="Importe exigible">
            <p className="folio">PAGO COMPLETO</p>
            <h2>{selectedAccount.customerName}</h2>
            <span className="payment-account-number">Cuenta {selectedAccount.accountNumber} · Fecha {commercialDate(quote.paidOn)}</span>
            <div className="payment-total"><span>Importe oficial a pagar</span><strong>{money(quote.currency, quote.amount)}</strong></div>
            <p className="field-help">El importe no puede editarse. Incluye todas las obligaciones vencidas y exigibles a la fecha.</p>
            <button className="primary-button" type="button" disabled={submitting || quote.obligations.length === 0} onClick={submitPayment}>
              {submitting ? 'Registrando pago…' : 'Registrar pago completo'}
            </button>
          </section>
          <section className="catalog-panel payment-breakdown" aria-labelledby="payment-breakdown-title">
            <div className="catalog-panel-heading"><div><p className="folio">APLICACIÓN DEL PAGO</p><h2 id="payment-breakdown-title">Obligaciones exigibles</h2></div><span>{quote.obligations.length} obligaciones</span></div>
            {quote.obligations.length === 0 ? <p className="empty-state schedule-empty">Esta cuenta no tiene obligaciones exigibles para pagar hoy.</p> : (
              <div className="table-wrapper"><table aria-label="Detalle del pago"><thead><tr><th>Vencimiento</th><th>Días de mora</th><th>Mora</th><th>Interés</th><th>Capital</th></tr></thead><tbody>{quote.obligations.map((item) => <tr key={item.id}><td>{commercialDate(item.dueDate)}</td><td>{item.lateDays}</td><td>{money(quote.currency, item.lateInterest)}</td><td>{money(quote.currency, item.compensatoryInterest)}</td><td className="money-cell">{money(quote.currency, item.principal)}</td></tr>)}</tbody></table></div>
            )}
          </section>
        </div>
      ) : receipt ? (
        <section className="receipt-card" aria-label="Comprobante de pago">
          <div><p className="folio">COMPROBANTE DE PAGO</p><h2>{receipt.receiptNumber}</h2><span>{new Date(receipt.paidAt).toLocaleString('es-PE')}</span></div>
          <strong>{money(receipt.currency, receipt.amount)}</strong>
          <div className="receipt-allocations table-wrapper">
            <table aria-label="Aplicación del comprobante"><thead><tr><th>Obligación</th><th>Mora</th><th>Interés</th><th>Capital</th></tr></thead><tbody>{receipt.allocations.map((item) => <tr key={item.obligationId}><td>{item.obligationId}</td><td>{money(receipt.currency, item.lateInterestPaid)}</td><td>{money(receipt.currency, item.compensatoryPaid)}</td><td className="money-cell">{money(receipt.currency, item.principalPaid)}</td></tr>)}</tbody></table>
          </div>
        </section>
      ) : accountId ? null : <p className="empty-state payment-empty">Seleccione una cuenta para consultar el pago exigible.</p>}
      <p className="audit-note">La aplicación respeta la prelación: mora, interés compensatorio y capital. No se aceptan pagos parciales ni excesivos.</p>
    </section>
  );
}

function CutReports({ api, access, accounts }: { api: ApiClient; access: StoreAccess; accounts: AccountView[] }) {
  const [accountId, setAccountId] = useState('');
  const [statements, setStatements] = useState<StatementView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const statementsRequest = useRef(0);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const latest = statements[0];

  async function loadStatements(selectedId: string, clearExisting: boolean) {
    const requestId = ++statementsRequest.current;
    if (clearExisting) setStatements([]);
    setError('');
    if (!selectedId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextStatements = await api.getStatements(selectedId, access.storeId);
      if (statementsRequest.current === requestId) setStatements(nextStatements);
    } catch (reason) {
      if (statementsRequest.current === requestId) {
        setError(reason instanceof Error ? reason.message : 'No fue posible consultar los estados de cuenta.');
      }
    } finally {
      if (statementsRequest.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatements(accountId, true);
  }, [access.storeId, accountId, api]);

  return (
    <section className="cut-report-page">
      <div className="page-lead">
        <p>Consulta los cortes emitidos por el proceso automático y sus importes oficiales.</p>
        <button className="secondary-button compact-button" type="button" disabled={!accountId || loading} onClick={() => void loadStatements(accountId, false)}>{loading ? 'Actualizando…' : 'Actualizar estados'}</button>
      </div>
      <section className="schedule-selector">
        <label htmlFor="statement-account">Cuenta del cliente</label>
        <select id="statement-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Seleccione una cuenta</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.customerName} · {account.accountNumber}</option>)}
        </select>
      </section>

      {selectedAccount && (
        <section className="metric-strip statement-metrics" aria-label="Resumen de estados de cuenta">
          <article><span>Cuenta</span><strong className="store-name">{selectedAccount.accountNumber}</strong></article>
          <article><span>Estados emitidos</span><strong>{statements.length}</strong></article>
          <article><span>Último importe exigible</span><strong>{latest ? officialMoney(latest.currency, latest.totalDue) : 'Sin corte'}</strong></article>
          <article><span>Último vencimiento</span><strong className="store-name">{latest ? commercialDate(latest.dueDate) : 'Sin corte'}</strong></article>
        </section>
      )}

      {error && <Alert severity="error">{error}</Alert>}
      <section className="catalog-panel statement-panel" aria-labelledby="statement-title">
        <div className="catalog-panel-heading"><div><p className="folio">HISTORIAL DE CORTES</p><h2 id="statement-title">Estados de cuenta emitidos</h2></div><span>{loading ? 'Consultando…' : `${statements.length} estados`}</span></div>
        {!accountId ? <p className="empty-state statement-empty">Seleccione una cuenta para consultar sus cortes.</p> : loading ? <div className="schedule-loading"><CircularProgress size={24} /><span>Consultando estados de cuenta…</span></div> : statements.length === 0 ? <p className="empty-state statement-empty">Todavía no se han emitido estados para esta cuenta.</p> : (
          <div className="table-wrapper"><table className="statement-table" aria-label="Estados de cuenta emitidos"><thead><tr><th>Corte</th><th>Periodo</th><th>Vencimiento</th><th>Importe exigible</th><th>Estado</th></tr></thead><tbody>{statements.map((statement) => <tr key={statement.id}><td>{commercialInstantInLima(statement.cutAt)}</td><td>{commercialDate(statement.periodStart)} – {commercialDate(statement.periodEnd)}</td><td>{commercialDate(statement.dueDate)}</td><td className="money-cell">{officialMoney(statement.currency, statement.totalDue)}</td><td><span className="status-pill ready">Emitido</span></td></tr>)}</tbody></table></div>
        )}
      </section>
      <p className="audit-note">Los cortes vencidos se procesan automáticamente cada minuto. El reporte no recalcula importes en el navegador.</p>
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
  const [clients, setClients] = useState<ClientView[]>([]);

  async function refreshAccounts() {
    try {
      setAccounts(await api.listAccounts(access.storeId));
    } catch {
      // La compra ya fue aceptada: se conserva el último saldo visible si falla la recarga.
    }
  }

  useEffect(() => {
    void Promise.all([
      api.listAccounts(access.storeId),
      api.listProducts(access.storeId),
      api.listClients(access.storeId),
    ]).then(([nextAccounts, nextProducts, nextClients]) => {
      setAccounts(nextAccounts);
      setProducts(nextProducts);
      setClients(nextClients);
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

  if (activeSection === 'Clientes') {
    return (
      <ClientManagement
        api={api}
        access={access}
        clients={clients}
        setClients={setClients}
        accounts={accounts}
      />
    );
  }

  if (activeSection === 'Registrar compra') {
    return (
      <PurchaseRegistration
        api={api}
        access={access}
        accounts={accounts}
        products={products}
        onPurchaseSaved={refreshAccounts}
      />
    );
  }

  if (activeSection === 'Cuentas corrientes') {
    return (
      <AccountManagement
        api={api}
        access={access}
        clients={clients}
        accounts={accounts}
        setAccounts={setAccounts}
      />
    );
  }

  if (activeSection === 'Planes de pago') {
    return <PaymentPlans api={api} access={access} accounts={accounts} />;
  }

  if (activeSection === 'Registrar pago') {
    return <PaymentRegistration api={api} access={access} accounts={accounts} onPaymentSaved={refreshAccounts} />;
  }

  if (activeSection === 'Reporte de corte') {
    return <CutReports api={api} access={access} accounts={accounts} />;
  }

  return (
    <>
      <section className="metric-strip">
        <article><span>Cuentas activas</span><strong>{accounts.length}</strong></article>
        <article><span>Crédito disponible</span><strong>{money(access.currency, String(available))}</strong></article>
        <article><span>Tienda</span><strong className="store-name">{access.storeName}</strong></article>
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
  const availableNavigation = ['Panel del negocio', 'Productos y servicios', 'Clientes', 'Registrar compra', 'Cuentas corrientes', 'Planes de pago', 'Registrar pago', 'Reporte de corte'];
  const title = activeSection === 'Productos y servicios'
    ? 'Productos y servicios'
    : activeSection === 'Clientes'
      ? 'Gestión de clientes'
      : activeSection === 'Registrar compra'
        ? 'Registrar compra'
        : activeSection === 'Cuentas corrientes'
          ? 'Cuentas corrientes'
          : activeSection === 'Planes de pago'
            ? 'Planes de pago'
            : activeSection === 'Registrar pago'
              ? 'Registrar pago'
              : activeSection === 'Reporte de corte'
                ? 'Reporte de corte'
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

function ClientWorkspace({ api, activeSection }: { api: ApiClient; activeSection: string }) {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [statements, setStatements] = useState<Array<{ id: string; dueDate: string; totalDue: string; currency: string }>>([]);
  const [purchases, setPurchases] = useState<Awaited<ReturnType<ApiClient['getMyPurchases']>>>([]);
  const [schedule, setSchedule] = useState<ScheduleItemView[]>([]);
  const [payments, setPayments] = useState<ClientPaymentView[]>([]);
  const [loadWarning, setLoadWarning] = useState(false);

  useEffect(() => {
    void Promise.allSettled([
      api.getMyAccounts(),
      api.getMyStatements(),
      api.getMyPurchases(),
      api.getMySchedule(),
      api.getMyPayments(),
    ]).then(([nextAccounts, nextStatements, nextPurchases, nextSchedule, nextPayments]) => {
      if (nextAccounts.status === 'fulfilled') setAccounts(nextAccounts.value);
      if (nextStatements.status === 'fulfilled') setStatements(nextStatements.value);
      if (nextPurchases.status === 'fulfilled') setPurchases(nextPurchases.value);
      if (nextSchedule.status === 'fulfilled') setSchedule(nextSchedule.value);
      if (nextPayments.status === 'fulfilled') setPayments(nextPayments.value);
      setLoadWarning([nextAccounts, nextStatements, nextPurchases, nextSchedule, nextPayments].some((result) => result.status === 'rejected'));
    });
  }, [api]);

  if (activeSection === 'Mis compras') return <section className="paper-section client-ledger"><p className="folio">MIS COMPRAS</p><h2>Consumos registrados</h2>{purchases.length === 0 ? <p className="empty-state">No hay compras recientes.</p> : purchases.map((purchase) => <article className="client-purchase" key={purchase.id}><div><span>{commercialInstantInLima(purchase.purchasedAt)}</span><strong>{officialMoney(purchase.currency, purchase.total)}</strong></div><div className="client-purchase-items">{purchase.items.map((item) => <div key={`${purchase.id}-${item.productId}`}><ProductImage src={item.imageUrl} name={item.description} /><p>{item.description}</p><span>{item.quantity} × {officialMoney(purchase.currency, item.unitPrice)}</span></div>)}</div></article>)}</section>;

  if (activeSection === 'Estado de cuenta') return <section className="paper-section"><p className="folio">ESTADOS DE CUENTA</p><h2>Cortes emitidos</h2>{statements.length === 0 ? <p className="empty-state">No hay estados de cuenta emitidos.</p> : <div className="table-wrapper"><table aria-label="Mis estados de cuenta"><thead><tr><th>Vencimiento</th><th>Importe exigible</th><th>Estado</th></tr></thead><tbody>{statements.map((item) => <tr key={item.id}><td>{commercialDate(item.dueDate)}</td><td className="money-cell">{officialMoney(item.currency, item.totalDue)}</td><td><span className="status-pill ready">Emitido</span></td></tr>)}</tbody></table></div>}</section>;

  if (activeSection === 'Plan de pagos') return <section className="paper-section"><p className="folio">PLAN DE PAGOS</p><h2>Cuotas y vencimientos</h2>{schedule.length === 0 ? <p className="empty-state">No hay cuotas programadas.</p> : <div className="table-wrapper"><table aria-label="Mi plan de pagos"><thead><tr><th>Cuota</th><th>Vencimiento</th><th>Capital</th><th>Interés</th><th>Importe</th><th>Estado</th></tr></thead><tbody>{schedule.map((item) => { const status = obligationStatus(item.status); return <tr key={item.id}><td>{item.installmentNumber}</td><td>{commercialDate(item.dueDate)}</td><td>{officialMoney(item.currency, item.principalDue)}</td><td>{officialMoney(item.currency, item.compensatoryInterest)}</td><td className="money-cell">{officialMoney(item.currency, item.amountDue)}</td><td><span className={`status-pill ${status.tone}`}>{status.label}</span></td></tr>; })}</tbody></table></div>}</section>;

  if (activeSection === 'Historial de pagos') return <section className="paper-section"><p className="folio">HISTORIAL DE PAGOS</p><h2>Comprobantes registrados</h2>{payments.length === 0 ? <p className="empty-state">No hay pagos registrados.</p> : <div className="table-wrapper"><table aria-label="Mi historial de pagos"><thead><tr><th>Comprobante</th><th>Fecha</th><th>Método</th><th>Importe</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.receiptNumber}</td><td>{commercialInstantInLima(payment.paidAt)}</td><td>{payment.method.replaceAll('_', ' ')}</td><td className="money-cell">{officialMoney(payment.currency, payment.amount)}</td></tr>)}</tbody></table></div>}</section>;

  if (activeSection === 'Ayuda') return <section className="paper-section"><p className="folio">AYUDA</p><h2>Cómo leer tu CrediCuenta</h2><p className="empty-state">Los importes mostrados provienen del cálculo oficial. Si necesitas corregir una compra o un pago, comunícate con la tienda que administra tu cuenta.</p></section>;

  return (
    <>
      {loadWarning && <Alert severity="warning">Algunos datos no pudieron cargarse. Puedes seguir consultando la información disponible.</Alert>}
      <section className="client-balance-grid">
        {accounts.map((account) => (
          <article className="balance-ticket" key={account.id}>
            <span>{account.storeName}</span>
            <p>Capital pendiente</p>
            <strong>{officialMoney(account.currency, account.originalOutstanding)}</strong>
            <div><span>Cuenta {account.accountNumber}</span><span>Límite {officialMoney(account.currency, account.creditLimit)}</span></div>
          </article>
        ))}
      </section>
      <div className="two-column-grid" id="actividad">
        <section className="paper-section"><p className="folio">ESTADOS DE CUENTA</p><h2>Próximos vencimientos</h2>
          {statements.length === 0 ? <p className="empty-state">No hay estados de cuenta emitidos.</p> : statements.map((item) => <p key={item.id}>{commercialDate(item.dueDate)} · {officialMoney(item.currency, item.totalDue)}</p>)}
        </section>
        <section className="paper-section"><p className="folio">HISTORIAL</p><h2>Compras recientes</h2>
          {purchases.length === 0 ? <p className="empty-state">No hay compras recientes.</p> : purchases.map((item) => <p key={item.id}>{commercialInstantInLima(item.purchasedAt)} · {officialMoney(item.currency, item.total)}</p>)}
        </section>
      </div>
    </>
  );
}

function ClientArea({ api, profile, onLogout }: { api: ApiClient; profile: Profile; onLogout: () => void }) {
  const [activeSection, setActiveSection] = useState('Mi resumen');
  return <WorkspaceShell profile={profile} title={activeSection === 'Mi resumen' ? 'Mi CrediCuenta' : activeSection} kicker="Estado personal" navigation={clientNavigation} activeNavigation={activeSection} onNavigate={setActiveSection} onLogout={onLogout}><ClientWorkspace api={api} activeSection={activeSection} /></WorkspaceShell>;
}

export function App({ api = defaultApi }: { api?: ApiClient }) {
  const isActivation = window.location.pathname === '/activar';
  const activationToken = isActivation
    ? new URLSearchParams(window.location.search).get('token')
    : null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [restoring, setRestoring] = useState(
    !isActivation && Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)),
  );

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
  if (!profile) {
    return isActivation
      ? <ActivationPanel api={api} token={activationToken} onAuthenticated={setProfile} />
      : <LoginPanel api={api} onAuthenticated={setProfile} />;
  }

  if (profile.platformRole === 'PLATFORM_ADMIN') {
    return <PlatformArea api={api} profile={profile} onLogout={logout} />;
  }

  const businessAccess = profile.storeAccesses.find((access) =>
    ['STORE_ADMIN', 'OPERATOR'].includes(access.role),
  );
  if (businessAccess) {
    return <BusinessArea api={api} profile={profile} access={businessAccess} onLogout={logout} />;
  }

  return <ClientArea api={api} profile={profile} onLogout={logout} />;
}
