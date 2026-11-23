import { useEffect, useState, type FormEvent } from 'react';

import type {
  ApiClient,
  InvitationStatus,
  PlatformInvitationView,
  PlatformStoreView,
  PlatformUserView,
} from '../../api/client';

const roleLabels = {
  PLATFORM_ADMIN: 'Administrador de plataforma',
  USER: 'Usuario',
  STORE_ADMIN: 'Administrador del negocio',
  OPERATOR: 'Operador',
  CLIENT: 'Cliente',
} as const;

const statusLabels: Record<InvitationStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Utilizada',
  EXPIRED: 'Vencida',
  REVOKED: 'Revocada',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeZone: 'America/Lima',
  }).format(new Date(value));
}

export function PlatformAccessManagement({
  api,
  stores,
}: {
  api: ApiClient;
  stores: PlatformStoreView[];
}) {
  const [users, setUsers] = useState<PlatformUserView[]>([]);
  const [invitations, setInvitations] = useState<PlatformInvitationView[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStoreId, setInviteStoreId] = useState('');
  const [activationLink, setActivationLink] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([api.listPlatformUsers(), api.listInvitations()])
      .then(([nextUsers, nextInvitations]) => {
        if (!active) return;
        setUsers(nextUsers);
        setInvitations(nextInvitations);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'No fue posible cargar los accesos.');
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function inviteAdministrator(event: FormEvent) {
    event.preventDefault();
    if (!inviteEmail.includes('@') || !inviteStoreId) {
      setError('Seleccione una tienda e ingrese un correo válido.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createInvitation({
        email: inviteEmail,
        platformRole: 'USER',
        storeId: inviteStoreId,
        storeRole: 'STORE_ADMIN',
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });
      setActivationLink(
        `${window.location.origin}/activar?token=${encodeURIComponent(created.token)}`,
      );
      setInvitations(await api.listInvitations());
      setInviteEmail('');
      setCopyNotice('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear la invitación.');
    } finally {
      setSubmitting(false);
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

  async function revokeInvitation(invitationId: string) {
    setRevokingId(invitationId);
    try {
      await api.revokeInvitation(invitationId);
      setInvitations((current) => current.map((item) => (
        item.id === invitationId ? { ...item, status: 'REVOKED' } : item
      )));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible revocar la invitación.');
    } finally {
      setRevokingId('');
    }
  }

  return (
    <>
      <section className="paper-section invitation-section">
        <div><p className="folio">ACCESOS · INVITACIÓN</p><h2>Administrador del negocio</h2></div>
        <form className="inline-form" onSubmit={inviteAdministrator}>
          <label htmlFor="invite-store">Tienda asignada</label>
          <select
            id="invite-store"
            value={inviteStoreId}
            onChange={(event) => setInviteStoreId(event.target.value)}
          >
            <option value="">Seleccione una tienda</option>
            {stores.filter((store) => store.active).map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
          <label htmlFor="invite-email">Correo del administrador</label>
          <input
            id="invite-email"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
          />
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Creando…' : 'Crear invitación'}
          </button>
        </form>
        {activationLink && (
          <div className="invitation-link">
            <label htmlFor="activation-link">Enlace de activación</label>
            <div>
              <input id="activation-link" readOnly value={activationLink} />
              <button
                className="secondary-button"
                type="button"
                onClick={() => void copyActivationLink()}
              >
                Copiar enlace
              </button>
            </div>
            <p className="field-help">
              Este enlace se muestra una sola vez. Entrégalo únicamente a la persona invitada.
              {copyNotice && <> {copyNotice}</>}
            </p>
          </div>
        )}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>

      <section className="paper-section">
        <div className="section-title">
          <div><p className="folio">PLATAFORMA · USUARIOS</p><h2>Usuarios y roles</h2></div>
          <span>{users.length} usuarios</span>
        </div>
        {users.length === 0 ? (
          <p className="empty-state">Aún no hay usuarios para mostrar.</p>
        ) : (
          <div className="table-wrapper">
            <table aria-label="Usuarios de plataforma">
              <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Accesos</th><th>Estado</th></tr></thead>
              <tbody>{users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.displayName}</strong><br /><small>{user.username}</small></td>
                  <td>{user.email}</td>
                  <td>{roleLabels[user.platformRole]}</td>
                  <td>{user.storeAccesses.length === 0 ? 'Sin tienda asignada' : (
                    <ul>{user.storeAccesses.map((access) => (
                      <li key={`${user.id}-${access.storeId}`}>
                        {access.storeName} · {roleLabels[access.role]} · {access.active ? 'Activo' : 'Inactivo'}
                      </li>
                    ))}</ul>
                  )}</td>
                  <td>{user.active ? 'Activo' : 'Inactivo'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="paper-section">
        <div className="section-title">
          <div><p className="folio">ACCESOS · HISTORIAL</p><h2>Invitaciones</h2></div>
          <span>{invitations.length} invitaciones</span>
        </div>
        {invitations.length === 0 ? (
          <p className="empty-state">Aún no hay invitaciones para mostrar.</p>
        ) : (
          <div className="table-wrapper">
            <table aria-label="Historial de invitaciones">
              <thead><tr><th>Correo</th><th>Tienda</th><th>Rol</th><th>Estado</th><th>Vencimiento</th><th>Acción</th></tr></thead>
              <tbody>{invitations.map((item) => (
                <tr key={item.id}>
                  <td>{item.email}</td>
                  <td>{item.store?.name ?? 'Plataforma'}</td>
                  <td>{item.storeRole ? roleLabels[item.storeRole] : roleLabels[item.platformRole]}</td>
                  <td>{statusLabels[item.status]}</td>
                  <td>{formatDate(item.expiresAt)}</td>
                  <td>{item.status === 'PENDING' ? (
                    <button
                      aria-label={`Revocar invitación de ${item.email}`}
                      className="table-action"
                      disabled={revokingId === item.id}
                      type="button"
                      onClick={() => void revokeInvitation(item.id)}
                    >
                      {revokingId === item.id ? 'Revocando…' : 'Revocar'}
                    </button>
                  ) : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
