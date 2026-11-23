import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  ApiClient,
  PlatformInvitationView,
  PlatformUserView,
} from '../../api/client';
import { PlatformAccessManagement } from './PlatformAccessManagement';

const users: PlatformUserView[] = [
  {
    id: 'platform-admin-1',
    username: 'admin.plataforma',
    email: 'plataforma@example.com',
    displayName: 'Admin Plataforma',
    platformRole: 'PLATFORM_ADMIN',
    active: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    storeAccesses: [],
  },
  {
    id: 'business-user-1',
    username: 'equipo.negocio',
    email: 'equipo@example.com',
    displayName: 'Equipo del negocio',
    platformRole: 'USER',
    active: true,
    createdAt: '2026-11-02T10:00:00.000Z',
    storeAccesses: [
      { storeId: 'store-1', storeName: 'Bodega Norte', role: 'STORE_ADMIN', active: true },
      { storeId: 'store-2', storeName: 'Bodega Sur', role: 'OPERATOR', active: true },
      { storeId: 'store-3', storeName: 'Bodega Este', role: 'CLIENT', active: false },
    ],
  },
];

const invitation = (
  id: string,
  status: PlatformInvitationView['status'],
): PlatformInvitationView => ({
  id,
  email: `${id}@example.com`,
  platformRole: 'USER',
  storeRole: 'STORE_ADMIN',
  status,
  expiresAt: '2026-11-30T10:00:00.000Z',
  acceptedAt: status === 'ACCEPTED' ? '2026-11-22T10:00:00.000Z' : null,
  createdAt: '2026-11-20T10:00:00.000Z',
  store: { id: 'store-1', name: 'Bodega Norte' },
  issuedBy: { id: 'platform-admin-1', displayName: 'Admin Plataforma' },
});

const invitations = [
  invitation('pending', 'PENDING'),
  invitation('accepted', 'ACCEPTED'),
  invitation('expired', 'EXPIRED'),
  invitation('revoked', 'REVOKED'),
];

function makeApi() {
  return {
    listPlatformUsers: vi.fn().mockResolvedValue(users),
    listInvitations: vi.fn().mockResolvedValue(invitations),
    createInvitation: vi.fn().mockResolvedValue({
      id: 'new-invitation', token: 'one-time-token', expiresAt: '2026-11-30T10:00:00.000Z',
    }),
    revokeInvitation: vi.fn().mockResolvedValue({ id: 'pending', status: 'REVOKED' }),
  } as unknown as ApiClient;
}

describe('PlatformAccessManagement', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows platform users, every store role and all invitation states', async () => {
    render(<PlatformAccessManagement
      api={makeApi()}
      stores={[{ id: 'store-1', name: 'Bodega Norte', active: true }]}
    />);

    const userTable = await screen.findByRole('table', { name: /usuarios de plataforma/i });
    expect(within(userTable).getByText('Admin Plataforma')).toBeVisible();
    expect(within(userTable).getByText('Administrador de plataforma')).toBeVisible();
    expect(within(userTable).getByText(/Bodega Norte · Administrador del negocio · Activo/)).toBeVisible();
    expect(within(userTable).getByText(/Bodega Sur · Operador · Activo/)).toBeVisible();
    expect(within(userTable).getByText(/Bodega Este · Cliente · Inactivo/)).toBeVisible();

    const invitationTable = screen.getByRole('table', { name: /historial de invitaciones/i });
    expect(within(invitationTable).getByText('Pendiente')).toBeVisible();
    expect(within(invitationTable).getByText('Utilizada')).toBeVisible();
    expect(within(invitationTable).getByText('Vencida')).toBeVisible();
    expect(within(invitationTable).getByText('Revocada')).toBeVisible();
  });

  it('creates an invitation, exposes its one-time activation link and refreshes history', async () => {
    const api = makeApi();
    vi.mocked(api.listInvitations)
      .mockResolvedValueOnce(invitations)
      .mockResolvedValueOnce([invitation('new-invitation', 'PENDING'), ...invitations]);
    render(<PlatformAccessManagement
      api={api}
      stores={[{ id: 'store-1', name: 'Bodega Norte', active: true }]}
    />);

    await screen.findByRole('table', { name: /usuarios de plataforma/i });
    fireEvent.change(screen.getByLabelText(/tienda asignada/i), { target: { value: 'store-1' } });
    fireEvent.change(screen.getByLabelText(/correo del administrador/i), {
      target: { value: 'nuevo.admin@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear invitación/i }));

    const link = await screen.findByLabelText(/enlace de activación/i);
    expect(link).toHaveValue(`${window.location.origin}/activar?token=one-time-token`);
    expect(link).toHaveAttribute('readonly');
    expect(api.createInvitation).toHaveBeenCalledWith(expect.objectContaining({
      email: 'nuevo.admin@example.com',
      storeId: 'store-1',
      storeRole: 'STORE_ADMIN',
      platformRole: 'USER',
      expiresAt: expect.any(String),
    }));
    await waitFor(() => expect(api.listInvitations).toHaveBeenCalledTimes(2));
    expect(screen.getByText('new-invitation@example.com')).toBeVisible();
  });

  it('copies the activation link when clipboard access exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<PlatformAccessManagement
      api={makeApi()}
      stores={[{ id: 'store-1', name: 'Bodega Norte', active: true }]}
    />);

    await screen.findByRole('table', { name: /usuarios de plataforma/i });
    fireEvent.change(screen.getByLabelText(/tienda asignada/i), { target: { value: 'store-1' } });
    fireEvent.change(screen.getByLabelText(/correo del administrador/i), {
      target: { value: 'nuevo.admin@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear invitación/i }));
    await screen.findByLabelText(/enlace de activación/i);
    fireEvent.click(screen.getByRole('button', { name: /copiar enlace/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/activar?token=one-time-token`,
    ));
    expect(await screen.findByText(/Enlace copiado\./)).toBeVisible();
  });

  it('keeps the one-time link selectable when clipboard access is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    render(<PlatformAccessManagement
      api={makeApi()}
      stores={[{ id: 'store-1', name: 'Bodega Norte', active: true }]}
    />);

    await screen.findByRole('table', { name: /usuarios de plataforma/i });
    fireEvent.change(screen.getByLabelText(/tienda asignada/i), { target: { value: 'store-1' } });
    fireEvent.change(screen.getByLabelText(/correo del administrador/i), {
      target: { value: 'nuevo.admin@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear invitación/i }));

    const link = await screen.findByLabelText(/enlace de activación/i);
    fireEvent.click(screen.getByRole('button', { name: /copiar enlace/i }));
    expect(link).toBeVisible();
    expect(link).toHaveValue(`${window.location.origin}/activar?token=one-time-token`);
  });

  it('offers revocation only for pending invitations and updates their state', async () => {
    const api = makeApi();
    render(<PlatformAccessManagement
      api={api}
      stores={[{ id: 'store-1', name: 'Bodega Norte', active: true }]}
    />);

    const table = await screen.findByRole('table', { name: /historial de invitaciones/i });
    const revokeButtons = within(table).getAllByRole('button', { name: /revocar invitación/i });
    expect(revokeButtons).toHaveLength(1);
    fireEvent.click(revokeButtons[0]!);

    await waitFor(() => expect(api.revokeInvitation).toHaveBeenCalledWith('pending'));
    expect(within(table).getAllByText('Revocada')).toHaveLength(2);
    expect(within(table).queryByRole('button', { name: /revocar invitación/i })).not.toBeInTheDocument();
  });
});
