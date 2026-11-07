# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\push-notifications.spec.ts >> Push Notifications - Flujo completo >> 1. Login exitoso y redirección a dashboard
- Location: tests\push-notifications.spec.ts:32:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('input[name="email"], input[type="text"][name="email"]') to be visible

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // Configuración de credenciales admin
  4   | const ADMIN_USER = 'alex';
  5   | const ADMIN_PASS = 'alex123';
  6   | const BASE_URL = 'http://localhost:3000';
  7   | 
  8   | test.describe.configure({ retries: 2, timeout: 120000 });
  9   | 
  10  | test.describe('Push Notifications - Flujo completo', () => {
  11  |   test.beforeEach(async ({ page }) => {
  12  |     // Login previo a cada test
  13  |     await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  14  |     
  15  |     // Esperar a que el formulario esté listo - usar selector más robusto
> 16  |     await page.waitForSelector('input[name="email"], input[type="text"][name="email"]', { timeout: 30000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
  17  |     
  18  |     // Llenar formulario de login
  19  |     await page.fill('input[name="email"]', ADMIN_USER);
  20  |     await page.fill('input[name="password"]', ADMIN_PASS);
  21  |     
  22  |     // Submit del formulario
  23  |     await page.click('button[type="submit"]');
  24  |     
  25  |     // Esperar redirección a dashboard (admin)
  26  |     await page.waitForURL(`${BASE_URL}/admin/dashboard`, { timeout: 30000 });
  27  |     
  28  |     // Verificar que estamos en el dashboard
  29  |     await expect(page.locator('h1:has-text("Dashboard del Administrador")')).toBeVisible({ timeout: 15000 });
  30  |   });
  31  | 
  32  |   test('1. Login exitoso y redirección a dashboard', async ({ page }) => {
  33  |     await expect(page).toHaveURL(`${BASE_URL}/admin/dashboard`);
  34  |     await expect(page.locator('h1:has-text("Dashboard del Administrador")')).toBeVisible();
  35  |   });
  36  | 
  37  |   test('2. Navegación a página de notificaciones', async ({ page }) => {
  38  |     await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
  39  |     await expect(page).toHaveURL(`${BASE_URL}/notifications`);
  40  |     await expect(page.locator('h1:has-text("Notificaciones")')).toBeVisible({ timeout: 15000 });
  41  |   });
  42  | 
  43  |   test('3. Toggle de push notifications visible en /notifications', async ({ page }) => {
  44  |     await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
  45  |     
  46  |     // Verificar si push está soportado en este navegador
  47  |     const pushSupported = await page.evaluate(() => {
  48  |       return 'Notification' in window && 'serviceWorker' in navigator && 'pushManager' in navigator.serviceWorker;
  49  |     });
  50  |     
  51  |     // En headless Chrome, push no está soportado - el componente retorna null
  52  |     if (!pushSupported) {
  53  |       console.log('Push no soportado en este navegador - test omitido');
  54  |       // Verificar que NO hay placeholder de carga (el componente retorna null)
  55  |       const loadingPlaceholder = page.locator('.animate-pulse').first();
  56  |       await expect(loadingPlaceholder).toHaveCount(0);
  57  |       return;
  58  |     }
  59  |     
  60  |     // Verificar que existe el componente PushNotificationsToggle
  61  |     const toggle = page.locator('button[role="switch"]').first();
  62  |     await expect(toggle).toBeVisible({ timeout: 20000 });
  63  |   });
  64  | 
  65  |   test('4. Service Worker registrado correctamente (solo en producción)', async ({ page }) => {
  66  |     await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
  67  |     
  68  |     // Verificar si estamos en modo desarrollo (donde next-pwa deshabilita SW)
  69  |     const isDev = await page.evaluate(() => {
  70  |       return window.location.hostname === 'localhost' ||
  71  |              window.location.hostname === '127.0.0.1';
  72  |     });
  73  |     
  74  |     if (isDev) {
  75  |       console.log('Modo desarrollo: SW deshabilitado por next-pwa - test omitido');
  76  |       return;
  77  |     }
  78  |     
  79  |     const swRegistered = await page.evaluate(async () => {
  80  |       try {
  81  |         if (!('serviceWorker' in navigator)) return false;
  82  |         const reg = await Promise.race([
  83  |           navigator.serviceWorker.ready,
  84  |           new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
  85  |         ]);
  86  |         return !!reg;
  87  |       } catch {
  88  |         return false;
  89  |       }
  90  |     });
  91  |     expect(swRegistered).toBeTruthy();
  92  |   });
  93  | 
  94  |   test('5. Push subscription - activar toggle', async ({ page }) => {
  95  |     await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
  96  |     
  97  |     // Verificar si push está soportado
  98  |     const pushSupported = await page.evaluate(() => {
  99  |       return 'Notification' in window && 'serviceWorker' in navigator && 'pushManager' in navigator.serviceWorker;
  100 |     });
  101 |     
  102 |     if (!pushSupported) {
  103 |       console.log('Push no soportado - test omitido');
  104 |       return;
  105 |     }
  106 |     
  107 |     const toggle = page.locator('button[role="switch"]').first();
  108 |     
  109 |     // Obtener estado inicial
  110 |     const initialState = await toggle.getAttribute('aria-checked');
  111 |     
  112 |     // Click para activar (si está OFF)
  113 |     if (initialState === 'false') {
  114 |       await toggle.click();
  115 |       
  116 |       // Esperar a que el permiso se solicite (si es primera vez)
```