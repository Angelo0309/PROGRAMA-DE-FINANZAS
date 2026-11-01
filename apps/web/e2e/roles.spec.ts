import { expect, test } from '@playwright/test';

test('a client signs in and sees only the personal portal', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/auth/login')) {
      return route.fulfill({
        json: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
      });
    }
    if (url.endsWith('/me/profile')) {
      return route.fulfill({
        json: {
          id: 'client-1',
          displayName: 'Maria Demo',
          platformRole: 'USER',
          storeAccesses: [
            {
              storeId: 'store-1',
              storeName: 'Bodega Demo',
              currency: 'PEN',
              role: 'CLIENT',
            },
          ],
        },
      });
    }
    if (url.endsWith('/me/accounts')) {
      return route.fulfill({
        json: [
          {
            id: 'account-1',
            accountNumber: 'CC-001',
            storeName: 'Bodega Demo',
            creditLimit: '1000.00',
            originalOutstanding: '100.00',
            currency: 'PEN',
          },
        ],
      });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/');
  await page.getByLabel('Correo o usuario').fill('cliente@credicuenta.test');
  await page.getByLabel('Contraseña').fill('DemoSegura#2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('heading', { name: 'Mi CrediCuenta' })).toBeVisible();
  await expect(page.getByText('S/ 100.00')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Control de plataforma' })).toHaveCount(0);
});
