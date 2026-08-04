import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { stubReadyProvider } from './support/provider.js';
import { advanceToDecisionTurn, completeConceptAgreement, resolveDecisionTurn } from './support/idea-flow.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { createPromtgenPackage } from '../../src/v4/exporter.js';
import JSZip from 'jszip';

test.describe('PromtGen V4 Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await stubReadyProvider(page);
  });

  test('loads the application shell', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PromtGen/);
  });

  test('renders the main app container', async ({ page }) => {
    await page.goto('/');
    const app = page.locator('#root');
    await expect(app).toBeVisible();
  });

  test('shows the focused idea-first product promise', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Form doldurma. Fikrini anlat.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fikri geliştir' })).toBeVisible();
  });

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test('previews verified packages and restores existing projects as a new revision', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const fixture = createProjectDocument({
      idea: 'Bireysel geliştiricinin kapsam kararlarını yerel olarak planlayan web uygulaması',
      name: 'Paket kurtarma E2E'
    });
    fixture.sections.vision.content = 'Paket içindeki doğrulanmış ürün vizyonu.';
    const artifact = await createPromtgenPackage(fixture, { includeExports: false });
    const packagePath = testInfo.outputPath('verified-project.promtgen');
    await writeFile(packagePath, Buffer.from(await artifact.blob.arrayBuffer()));

    await page.goto('/');
    await page.locator('input[accept=".promtgen"]').setInputFiles(packagePath);
    await expect(page.locator('.package-import-dialog, .package-import-error')).toBeVisible();
    const firstImportError = await page.locator('.package-import-error').count()
      ? await page.locator('.package-import-error').textContent()
      : null;
    if (firstImportError) throw new Error(`Paket önizlemesi açılamadı: ${firstImportError}`);
    const dialog = page.getByRole('dialog', { name: 'Paket kurtarma E2E' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Paket içeriği SHA-256 kayıtlarıyla eşleşiyor')).toBeVisible();
    await expect(dialog.getByText(/paketi kimin ürettiğini.*kanıtlamaz/)).toBeVisible();
    expect(await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('promtgen-v4', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const count = await new Promise<number>((resolve, reject) => {
        const request = db.transaction('projects', 'readonly').objectStore('projects').count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return count;
    })).toBe(0);
    await dialog.getByRole('button', { name: 'Yeni proje olarak içe aktar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Paket kurtarma E2E', { exact: true }).first()).toBeVisible();

    const changedRevision = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('promtgen-v4', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const project = await new Promise<any>((resolve, reject) => {
        const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
        request.onsuccess = () => resolve(request.result[0]);
        request.onerror = () => reject(request.error);
      });
      project.documentRevision += 1;
      project.canonicalRevision += 1;
      project.sections.vision.content = 'Paket dışındaki geçici değişiklik.';
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        tx.objectStore('projects').put(project);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return project.canonicalRevision;
    });

    await page.reload();
    await page.locator('input[accept=".promtgen"]').setInputFiles(packagePath);
    const recoveryDialog = page.getByRole('dialog', { name: 'Paket kurtarma E2E' });
    await expect(recoveryDialog.getByText('Geri yükleme etkisi')).toBeVisible();
    await expect(recoveryDialog.getByText(new RegExp(`Paket r${fixture.canonicalRevision} → yerel yeni r${changedRevision + 1}`))).toBeVisible();
    await expect(recoveryDialog.getByText(new RegExp(`Yerel r${changedRevision} zaman çizelgesi korunur`))).toBeVisible();
    await recoveryDialog.getByRole('button', { name: 'Yeni revision olarak geri yükle' }).click();
    await expect(recoveryDialog).toBeHidden();

    const restored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('promtgen-v4', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const project = await new Promise<any>((resolve, reject) => {
        const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
        request.onsuccess = () => resolve(request.result[0]);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return { canonicalRevision: project.canonicalRevision, vision: project.sections.vision.content };
    });
    expect(restored).toEqual({ canonicalRevision: changedRevision + 1, vision: 'Paket içindeki doğrulanmış ürün vizyonu.' });

    const legacyProject = structuredClone(fixture);
    legacyProject.sections.vision.content = 'Eski ve kriptografik kanıtsız paket vizyonu.';
    const legacyZip = new JSZip();
    legacyZip.file('manifest.json', JSON.stringify({
      format: 'promtgen', formatVersion: 1, schemaVersion: 5, schemaRevision: legacyProject.schemaRevision, files: []
    }));
    legacyZip.file('project.json', JSON.stringify(legacyProject));
    const legacyPath = testInfo.outputPath('legacy-project.promtgen');
    await writeFile(legacyPath, Buffer.from(await legacyZip.generateAsync({ type: 'uint8array' })));

    await page.reload();
    await page.locator('input[accept=".promtgen"]').setInputFiles(legacyPath);
    const legacyDialog = page.getByRole('dialog', { name: 'Paket kurtarma E2E' });
    const legacyRestore = legacyDialog.getByRole('button', { name: 'Yeni revision olarak geri yükle' });
    await expect(legacyDialog.getByText('Eski paket — sınırlı doğrulama')).toBeVisible();
    await expect(legacyRestore).toBeDisabled();
    await legacyDialog.getByLabel('Sınırlı doğrulamayı kabul ediyorum').check();
    await expect(legacyRestore).toBeEnabled();
  });

  test('create, save, reopen and canonical export smoke flow', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Ne yapmak istiyorsun?').fill('Bireysel geliştiricilerin fikirlerini yerel olarak onaylı MVP kapsamına ve uygulanabilir görevlere dönüştüren bir web uygulaması yapmak istiyorum');
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();
    // Konsept alanları kullanıcının cevaplarından dolar; sistem hiçbirini uydurmaz.
    await advanceToDecisionTurn(page);
    await resolveDecisionTurn(page);
    await page.getByRole('button', { name: 'Fikir Özeti', exact: true }).click();
    await completeConceptAgreement(page);
    await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    await page.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();
    await expect(page.getByRole('heading', { name: 'Yaşayan plan' })).toBeVisible();
    const editor = page.locator('.pg-plan-editor textarea');
    await editor.fill('Kullanıcının kısa fikrini onaylı kararlarla yaşayan plana dönüştür.');
    await page.getByRole('button', { name: 'Bölümü kaydet' }).click();
    await expect(page.locator('.toast')).toContainText('kaydedildi');

    await page.reload();
    await page.locator('.portfolio-project-open').first().click();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.locator('.pg-plan-editor textarea')).toHaveValue(/yaşayan plana dönüştür/);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Markdown' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.md$/);
  });
});

// Sağlayıcı stub'ı KULLANMAZ: yerel motorun bağımsız çalıştığını doğrular.
test.describe('Yerel fikir motoru', () => {
  test('sağlayıcı yokken fikri engellemez ve yerel çalışma biçimini açıklar', async ({ page }) => {
    await page.route('**/api/tags', route => route.abort());
    await page.goto('/');

    await expect(page.getByRole('status').filter({ hasText: 'Yerel fikir motoru' })).toBeVisible();
    await expect(page.getByText(/Yerleşik GLM-5.2 etkinleştirilmeyi bekliyor/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'GLM-5.2’yi etkinleştir' })).toBeVisible();

    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Küçük ekiplerin toplantı notlarından karar ve aksiyon çıkaran bir web uygulaması yapmak istiyorum'
    );
    await expect(page.getByRole('button', { name: 'Fikri geliştir' })).toBeEnabled();
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();
    await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
  });

  test('sağlayıcı doğrulanınca kapı açılır', async ({ page }) => {
    await stubReadyProvider(page);
    await page.goto('/');

    await expect(page.getByRole('status').filter({ hasText: /Ollama/ })).toBeVisible();
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Küçük ekiplerin toplantı notlarından karar ve aksiyon çıkaran bir web uygulaması yapmak istiyorum'
    );
    await expect(page.getByRole('button', { name: 'Fikri geliştir' })).toBeEnabled();
  });
});
