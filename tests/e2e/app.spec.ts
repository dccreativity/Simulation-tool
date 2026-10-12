import { expect, test, type Page } from '@playwright/test';

const map = (page: Page) => page.getByRole('application', { name: /field map/ });

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('home page offers both learning modes and all ecosystems', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ECO FIELD LAB' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start Simulation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Use My Data' })).toBeVisible();
  for (const name of ['Grassland', 'Woodland', 'Pond', 'Coastal', 'Desert', 'Wetland', 'Urban Park', 'Tropical Forest']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await noHorizontalScroll(page);
});

test('every main page loads', async ({ page }) => {
  for (const path of ['/explore', '/explore/coastal', '/simulation', '/my-data', '/data-lab', '/statistics', '/statistics/t-test', '/statistics/chi-squared', '/statistics/which-test', '/notebook', '/achievements', '/auth']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    await noHorizontalScroll(page);
  }
});

test('quadrat sampling collects real data and checks for bias', async ({ page }) => {
  await page.goto('/simulation/grassland');
  await expect(map(page)).toBeVisible();
  await page.getByRole('button', { name: 'Generate locations' }).click();
  await page.getByRole('button', { name: 'Collect all' }).click();
  await expect(page.getByRole('tab', { name: 'Quadrats (10)' })).toBeVisible({ timeout: 10_000 });
  // Place one quadrat by hand.
  // Toasts can cover the lower part of a small screen; click near the top of the map.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const box = (await map(page).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.25);
  await expect(page.getByRole('tab', { name: 'Quadrats (11)' })).toBeVisible();
  await expect(page.getByText(/Well spread samples|No sign of bias|Sampling bias detected/)).toBeVisible();
  // Send it to the Data Lab.
  await page.getByRole('button', { name: 'Add to Data Lab' }).click();
  await expect(page).toHaveURL(/data-lab\?dataset=/);
  await expect(page.getByRole('table')).toBeVisible();
});

test('belt transect records sections along the suggested line', async ({ page }) => {
  await page.goto('/simulation/coastal');
  await expect(map(page)).toBeVisible();
  await page.getByRole('radio', { name: 'Belt Transect' }).click();
  await page.getByRole('button', { name: /suggested line/ }).click();
  await page.getByRole('button', { name: 'Run transect' }).click();
  await expect(page.getByText(/Transect 1 recorded/)).toBeVisible();
  await expect(page.getByText('Distance → species abundance')).toBeVisible();
});

test('My Data → t-test gives the textbook result', async ({ page }) => {
  await page.goto('/my-data');
  await page.getByRole('button', { name: 'Example: Two groups' }).click();
  await page.getByRole('button', { name: 'Analyse my data' }).click();
  await page.getByRole('link', { name: 'Compare with a t-test' }).click();
  await page.getByRole('button', { name: 'Run t-test' }).click();
  // Group A: 12 15 8 17 11 14, Group B: 7 5 9 4 8 6 → t = 4.196, df = 10, p = 0.002
  await expect(page.getByText('4.196', { exact: true })).toBeVisible();
  await expect(page.getByText('0.002', { exact: true })).toBeVisible();
  await expect(page.getByText(/statistically significant at the 0.05 level/)).toBeVisible();
});

test('chi-squared updates when the expected ratio changes', async ({ page }) => {
  await page.goto('/my-data');
  await page.getByRole('tab', { name: 'Try example data' }).click();
  await page.getByRole('button', { name: /Mendel/ }).click();
  await page.getByRole('link', { name: 'Run a chi-squared test' }).click();
  await expect(page.getByRole('cell', { name: 'χ² = 0.47' })).toBeVisible();
  await page.getByRole('button', { name: 'Equal' }).click();
  await expect(page.getByText(/differ significantly/)).toBeVisible();
});

test('saving to the Field Notebook survives a reload', async ({ page }) => {
  await page.goto('/my-data');
  await page.getByRole('button', { name: 'Try example data' }).first().click();
  await page.getByRole('button', { name: 'Analyse my data' }).click();
  await page.goto('/statistics');
  await page.getByRole('button', { name: 'Save to Field Notebook' }).click();
  await page.getByLabel('Conclusion').fill('Counts varied a lot between quadrats.');
  await page.getByLabel('Limitations').fill('Small sample.');
  await page.getByRole('button', { name: 'Save to notebook' }).click();
  await page.getByRole('link', { name: 'Open entry' }).click();
  await expect(page.getByText('Counts varied a lot between quadrats.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Counts varied a lot between quadrats.')).toBeVisible();
  await page.goto('/notebook');
  await expect(page.getByText(/descriptive statistics/).first()).toBeVisible();
});

test('which-test pathway reasons its way to a t-test', async ({ page }) => {
  await page.goto('/statistics/which-test');
  await page.getByRole('button', { name: /Whether two groups are different/ }).click();
  await page.getByRole('button', { name: /Numbers for each sample/ }).click();
  await page.getByRole('button', { name: /Yes — different quadrats/ }).click();
  await expect(page.getByText('t-test (independent samples)')).toBeVisible();
});
