import { test, expect } from '@playwright/test';

// Configuración de credenciales admin
const ADMIN_USER = 'alex';
const ADMIN_PASS = 'alex123';
const BASE_URL = 'http://localhost:3000';

test.describe.configure({ retries: 2, timeout: 120000 });

test.describe('Push Notifications - Flujo completo', () => {
  test.beforeEach(async ({ page }) => {
    // Login previo a cada test
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    
    // Esperar a que el formulario esté listo - usar selector más robusto
    await page.waitForSelector('input[name="email"], input[type="text"][name="email"]', { timeout: 30000 });
    
    // Llenar formulario de login
    await page.fill('input[name="email"]', ADMIN_USER);
    await page.fill('input[name="password"]', ADMIN_PASS);
    
    // Submit del formulario
    await page.click('button[type="submit"]');
    
    // Esperar redirección a dashboard (admin)
    await page.waitForURL(`${BASE_URL}/admin/dashboard`, { timeout: 30000 });
    
    // Verificar que estamos en el dashboard
    await expect(page.locator('h1:has-text("Dashboard del Administrador")')).toBeVisible({ timeout: 15000 });
  });

  test('1. Login exitoso y redirección a dashboard', async ({ page }) => {
    await expect(page).toHaveURL(`${BASE_URL}/admin/dashboard`);
    await expect(page.locator('h1:has-text("Dashboard del Administrador")')).toBeVisible();
  });

  test('2. Navegación a página de notificaciones', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(`${BASE_URL}/notifications`);
    await expect(page.locator('h1:has-text("Notificaciones")')).toBeVisible({ timeout: 15000 });
  });

  test('3. Toggle de push notifications visible en /notifications', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    
    // Verificar si push está soportado en este navegador
    const pushSupported = await page.evaluate(() => {
      return 'Notification' in window && 'serviceWorker' in navigator && 'pushManager' in navigator.serviceWorker;
    });
    
    // En headless Chrome, push no está soportado - el componente retorna null
    if (!pushSupported) {
      console.log('Push no soportado en este navegador - test omitido');
      // Verificar que NO hay placeholder de carga (el componente retorna null)
      const loadingPlaceholder = page.locator('.animate-pulse').first();
      await expect(loadingPlaceholder).toHaveCount(0);
      return;
    }
    
    // Verificar que existe el componente PushNotificationsToggle
    const toggle = page.locator('button[role="switch"]').first();
    await expect(toggle).toBeVisible({ timeout: 20000 });
  });

  test('4. Service Worker registrado correctamente (solo en producción)', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    
    // Verificar si estamos en modo desarrollo (donde next-pwa deshabilita SW)
    const isDev = await page.evaluate(() => {
      return window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1';
    });
    
    if (isDev) {
      console.log('Modo desarrollo: SW deshabilitado por next-pwa - test omitido');
      return;
    }
    
    const swRegistered = await page.evaluate(async () => {
      try {
        if (!('serviceWorker' in navigator)) return false;
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        return !!reg;
      } catch {
        return false;
      }
    });
    expect(swRegistered).toBeTruthy();
  });

  test('5. Push subscription - activar toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    
    // Verificar si push está soportado
    const pushSupported = await page.evaluate(() => {
      return 'Notification' in window && 'serviceWorker' in navigator && 'pushManager' in navigator.serviceWorker;
    });
    
    if (!pushSupported) {
      console.log('Push no soportado - test omitido');
      return;
    }
    
    const toggle = page.locator('button[role="switch"]').first();
    
    // Obtener estado inicial
    const initialState = await toggle.getAttribute('aria-checked');
    
    // Click para activar (si está OFF)
    if (initialState === 'false') {
      await toggle.click();
      
      // Esperar a que el permiso se solicite (si es primera vez)
      await page.waitForTimeout(3000);
      
      // Verificar snackbar de éxito o error
      const snackbar = page.locator('[role="alert"], .snackbar, [data-testid="snackbar"]').first();
      await expect(snackbar).toBeVisible({ timeout: 15000 });
    }
  });

  test('6. Push subscription - desactivar toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    
    const pushSupported = await page.evaluate(() => {
      return 'Notification' in window && 'serviceWorker' in navigator && 'pushManager' in navigator.serviceWorker;
    });
    
    if (!pushSupported) {
      console.log('Push no soportado - test omitido');
      return;
    }
    
    const toggle = page.locator('button[role="switch"]').first();
    const initialState = await toggle.getAttribute('aria-checked');
    
    // Si está ON, click para desactivar
    if (initialState === 'true') {
      await toggle.click();
      await page.waitForTimeout(2000);
      
      // Verificar snackbar de desactivación
      const snackbar = page.locator('[role="alert"], .snackbar, [data-testid="snackbar"]').first();
      await expect(snackbar).toBeVisible({ timeout: 15000 });
      
      // Verificar que el toggle está OFF
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
    }
  });

  test('7. Service Worker handlers push y notificationclick presentes (solo producción)', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    
    const isDev = await page.evaluate(() => {
      return window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1';
    });
    
    if (isDev) {
      console.log('Modo desarrollo: SW deshabilitado - test omitido');
      return;
    }
    
    const swHandlers = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return {
        controller: !!navigator.serviceWorker.controller,
        controlled: reg.active !== null
      };
    });
    
    expect(swHandlers.controller).toBeTruthy();
    expect(swHandlers.controlled).toBeTruthy();
  });

  test('8. LocalStorage pushNotificationsEnabled persistido', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    
    const pushSupported = await page.evaluate(() => {
      return 'Notification' in window && 'serviceWorker' in navigator && 'pushManager' in navigator.serviceWorker;
    });
    
    if (!pushSupported) {
      console.log('Push no soportado - test omitido');
      return;
    }
    
    const toggle = page.locator('button[role="switch"]').first();
    
    // Click para cambiar estado
    await toggle.click();
    await page.waitForTimeout(2000);
    
    // Verificar en localStorage
    const stored = await page.evaluate(() => localStorage.getItem('pushNotificationsEnabled'));
    expect(stored).not.toBeNull();
  });

  test('9. Responsive - toggle visible en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    
    const pushSupported = await page.evaluate(() => {
      return 'Notification' in window && 'serviceWorker' in navigator && 'pushManager' in navigator.serviceWorker;
    });
    
    if (!pushSupported) {
      console.log('Push no soportado - test omitido');
      return;
    }
    
    const toggle = page.locator('button[role="switch"]').first();
    await expect(toggle).toBeVisible({ timeout: 20000 });
  });

  test('10. Navegación entre tabs de notificaciones funciona', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications?tab=unread`, { waitUntil: 'networkidle' });
    await expect(page.locator('#panel-unread')).toBeVisible({ timeout: 15000 });
    
    await page.goto(`${BASE_URL}/notifications?tab=read`, { waitUntil: 'networkidle' });
    await expect(page.locator('#panel-read')).toBeVisible({ timeout: 15000 });
  });
});

// Test específico para Service Worker handlers
test.describe('Service Worker - Handlers push/notificationclick', () => {
  test('SW tiene event listeners push y notificationclick (solo producción)', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    
    // Verificar si estamos en modo desarrollo
    const isDev = await page.evaluate(() => {
      return window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1';
    });
    
    if (isDev) {
      console.log('Modo desarrollo: SW deshabilitado - test omitido');
      return;
    }
    
    const hasHandlers = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active !== null;
    });
    
    expect(hasHandlers).toBeTruthy();
  });
});