import { test as base, chromium, expect as baseExpect } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Define Keplr Fixture type
type KeplrFixtureType = {
  keplrContext: { page: any; context: any };
};

// Keplr fixture, provides browser context with loaded Keplr extension
export const test = base.extend<KeplrFixtureType>({
  keplrContext: async ({}, use) => {
    // Get Keplr extension path
    const keplrPath = process.env.KEPLR_EXTENSION_PATH || './extensions/keplr';
    
    // Create unique temporary directory
    const randomId = Math.random().toString(36).substring(2, 15);
    const tempDir = path.join(os.tmpdir(), `keplr-test-${randomId}-${Date.now()}`);
    
    // Ensure temporary directory doesn't exist
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Simple logging function
    const log = (message: string) => console.log(`[${new Date().toISOString()}] ${message}`);
    
    // Create browser context with Keplr extension
    log('Starting browser with Keplr extension');
    const context = await chromium.launchPersistentContext(tempDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${keplrPath}`,
        `--load-extension=${keplrPath}`
      ],
      timeout: 60000
    });
    
    // Create pages
    const page = await context.newPage();
    const setupPage = await context.newPage();

    try {
      // Close extra blank tabs
      log('Closing extra blank tabs');
      const initialPages = context.pages();
      for (const p of initialPages) {
        if (p !== page && p !== setupPage && p.url() === 'about:blank') {
          await p.close();
        }
      }

      // Setup Keplr wallet
      log('Starting Keplr wallet setup');
      
      // Visit extension page
      await setupPage.goto('chrome://extensions/');
      
      // Wait for Keplr popup
      log('Waiting for Keplr popup');
      const keplrTabPromise = context.waitForEvent('page', { timeout: 60000 });
      let keplrPage = await keplrTabPromise;
      
      // Check if registration interface is shown
      if (!keplrPage.url().includes('register.html')) {
        log('Keplr extension page did not load registration interface');
        await keplrPage.screenshot({ path: 'screenshots/error-no-onboarding.png' });
        throw new Error('Keplr extension page did not load registration interface');
      }
      
      log('Detected Keplr page: ' + keplrPage.url());
      
      // Wallet import process
      const mnemonicWords = ['they', 'vehicle', 'access', 'distance', 'galaxy', 'frozen', 'nice', 'casual', 'mystery', 'luxury', 'knife', 'fish'];
      const password = '1234567890';
      
      // Click "Import existing wallet"
      log('Clicking import existing wallet button');
      await keplrPage.waitForSelector('button[type="button"] >> :has-text("Import an existing wallet")', { 
        state: 'visible', 
        timeout: 20000 
      });
      await keplrPage.getByText(/Import an existing wallet/i).click();
      
      // Click "Use recovery phrase or private key"
      log('Clicking use recovery phrase or private key button');
      await keplrPage.waitForSelector('button[type="button"] >> :has-text("Use recovery phrase or private key")', { 
        state: 'visible', 
        timeout: 10000 
      });
      await keplrPage.getByText(/Use recovery phrase or private key/i).click();
      
      // Input mnemonic words
      log('Inputting mnemonic words');
      await keplrPage.waitForSelector('input[class="sc-efBctP cSWuvD"]', { 
        state: 'visible', 
        timeout: 10000 
      });
      const allInputs = await keplrPage.locator('input[class="sc-efBctP cSWuvD"]').all();
      
      if (allInputs.length >= 12) {
        for (let i = 0; i < 12; i++) {
          await allInputs[i].fill(mnemonicWords[i]);
          await keplrPage.waitForTimeout(200);
        }
      } else {
        log('Not enough input fields for mnemonic words');
        await keplrPage.screenshot({ path: 'screenshots/error-mnemonic-inputs.png' });
        throw new Error('Not enough input fields for mnemonic words');
      }
      
      // Click import button
      log('Clicking import button');
      await keplrPage.waitForSelector('button[type="submit"] >> :has-text("Import")', { 
        state: 'visible', 
        timeout: 10000 
      });
      await keplrPage.locator('button[type="submit"]').filter({ hasText: /Import/i }).click();
      
      // Wait for page load
      log('Waiting for page load');
      await keplrPage.waitForLoadState('domcontentloaded', { timeout: 30000 });
      await keplrPage.waitForLoadState('networkidle', { timeout: 30000 });
      
      // Set wallet name and password
      log('Setting wallet name');
      try {
        await keplrPage.waitForFunction(
          () => document.querySelector('input[name="name"]') !== null,
          { timeout: 20000 }
        );
        const walletNameInput = keplrPage.locator('input[name="name"]');
        if (await walletNameInput.isVisible({ timeout: 5000 })) {
          await walletNameInput.fill('autokeplr');
        }
      } catch (error: any) {
        log('Wallet name input not found, continuing execution');
      }
      
      // Set password
      log('Setting password');
      try {
        await keplrPage.waitForSelector('input[type="password"][name="password"]', { 
          state: 'visible', 
          timeout: 10000 
        });
        const passwordInput = keplrPage.locator('input[type="password"][name="password"]');
        if (await passwordInput.isVisible()) {
          await passwordInput.fill(password);
        }
      } catch (error: any) {
        log('Password input not found, continuing execution');
      }
      
      // Confirm password
      try {
        await keplrPage.waitForSelector('input[type="password"][name="confirmPassword"]', { 
          state: 'visible', 
          timeout: 10000 
        });
        const confirmPasswordInput = keplrPage.locator('input[type="password"][name="confirmPassword"]');
        if (await confirmPasswordInput.isVisible()) {
          await confirmPasswordInput.fill(password);
        }
      } catch (error: any) {
        log('Confirm password input not found, continuing execution');
      }
      
      // Click next button
      log('Clicking next button');
      try {
        await keplrPage.waitForSelector('button[type="submit"] >> :has-text("Next")', { 
          state: 'visible', 
          timeout: 10000 
        });
        const nextButton = keplrPage.locator('button[type="submit"]').filter({ hasText: /Next/i });
        if (await nextButton.isVisible()) {
          await nextButton.click();
        }
      } catch (error: any) {
        log('Next button not found, continuing execution');
      }
      
      // Wait for page load
      await keplrPage.waitForLoadState('domcontentloaded', { timeout: 30000 })
        .catch(() => log('Page load timeout after clicking next button'));
      
      // Click save button
      log('Looking for save button');
      try {
        await keplrPage.waitForSelector('button[type="button"] >> :has-text("Save")', { 
          state: 'visible', 
          timeout: 10000 
        });
        const saveButton = keplrPage.locator('button[type="button"]').filter({ hasText: /Save/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
      } catch (error: any) {
        log('Save button not found, continuing execution');
      }
      
      // Check additional import button
      log('Checking for additional import button');
      try {
        const importButton = keplrPage.locator('button[type="button"]').filter({ hasText: /Import/i });
        if (await importButton.isVisible({ timeout: 5000 })) {
          await importButton.click();
        }
      } catch (error: any) {
        log('Additional import button not found');
      }
      
      // Close Keplr page
      log('Closing Keplr page');
      if (!keplrPage.isClosed()) {
        await keplrPage.close();
      }
      
      // Close setup page
      log('Closing setup page');
      if (!setupPage.isClosed()) {
        await setupPage.close();
      }
      
      // Close any remaining extension tabs
      log('Closing any remaining extension tabs');
      const pagesAfterSetup = context.pages();
      for (const p of pagesAfterSetup) {
        if (p.url().startsWith('chrome-extension://') && p !== page) {
          await p.close();
        }
      }
      
      // Provide page and context to test
      log('Keplr setup complete, providing context to test');
      await use({ page, context });
    } catch (error: any) {
      log(`Keplr setup failed: ${error.message}`);
      
      // Screenshot for debugging
      if (!page.isClosed()) {
        await page.screenshot({ path: 'screenshots/error-page.png' });
      }
      
      // If setup page is still open, close it
      if (setupPage && !setupPage.isClosed()) {
        await setupPage.close();
      }
      
      throw error;
    } finally {
      // Clean up resources
      log('Closing browser context');
      await context.close();
      
      // Clean up temporary directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }
});

export const expect = baseExpect;
