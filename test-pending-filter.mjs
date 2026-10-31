import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

// Go to login page
await page.goto('http://localhost:3000/login');
await page.waitForLoadState('networkidle');

console.log('On login page');

// Wait for form to be ready
await page.waitForSelector('input[name="email"]', { timeout: 10000 });

// Fill login form - using credentials from the backend
await page.fill('input[name="email"]', 'admin@taller.com');
await page.fill('input[name="password"]', 'admin123');
await page.click('button[type="submit"]');

// Wait for navigation - longer timeout
try {
  await page.waitForURL('**/admin/dashboard', { timeout: 30000 });
  console.log('Logged in, on dashboard');
} catch (e) {
  // Check if there's an error message
  const errorMsg = await page.locator('text=/credenciales|inválidas|error/i').first().textContent().catch(() => '');
  console.log('Login error:', errorMsg);
  
  // Check if we're already on dashboard
  const url = page.url();
  console.log('Current URL:', url);
  
  if (url.includes('/admin/dashboard')) {
    console.log('Already on dashboard');
  } else {
    // Try to see what's on the page
    const bodyText = await page.locator('body').textContent();
    console.log('Page content preview:', bodyText?.substring(0, 500));
  }
  await browser.close();
  process.exit(1);
}

console.log('Logged in, on dashboard');

// Wait for orders to load
await page.waitForSelector('text=Lista de Órdenes', { timeout: 15000 });
await page.waitForTimeout(2000);

console.log('Orders loaded');

// Check for pending counter badge
const pendingBadge = await page.locator('text=/solicitud.*pendiente/i').first();
console.log('Pending badge visible:', await pendingBadge.isVisible().catch(() => false));

// Check for pending filter button
const pendingFilterBtn = await page.locator('button:has-text("Pendientes")').first();
console.log('Pending filter button visible:', await pendingFilterBtn.isVisible());

// Take screenshot of initial state
await page.screenshot({ path: 'test-before-filter.png', fullPage: true });
console.log('Screenshot before filter saved');

// Click the pending filter
await pendingFilterBtn.click();
await page.waitForTimeout(1000);

// Check if filter is active (primary variant)
const isActive = await pendingFilterBtn.evaluate(el => 
  el.classList.contains('bg-brand-600') || 
  el.classList.contains('bg-brand-500') ||
  el.classList.contains('bg-brand-700')
);
console.log('Filter active:', isActive);

// Check order cards for "Por aprobación" badge
const porAprobacionBadges = await page.locator('text=/Por aprobación/i').all();
console.log('"Por aprobación" badges found:', porAprobacionBadges.length);

// Take screenshot
await page.screenshot({ path: 'test-pending-filter.png', fullPage: true });
console.log('Screenshot saved');

// Click filter again to deactivate
await page.locator('button:has-text("Pendientes")').first().click();
await page.waitForTimeout(1000);

// Check order cards again
const allOrderCards = await page.locator('.rounded-2xl.border.border-slate-200').all();
console.log('Total order cards visible:', allOrderCards.length);

// Take screenshot after filter
await page.screenshot({ path: 'test-after-filter.png', fullPage: true });
console.log('Screenshot after filter saved');

await browser.close();