import { BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';

/**
 * KeplrSetup Class - Specifically responsible for Keplr wallet setup and import process
 */
export class KeplrSetup {
  private context: BrowserContext;
  private setupPage: Page;
  private mnemonicWords = ['they', 'vehicle', 'access', 'distance', 'galaxy', 'frozen', 'nice', 'casual', 'mystery', 'luxury', 'knife', 'fish'];
  private password = '1234567890';
  
  // Element selectors
  private selectors = {
    importWalletButton: 'button[type="button"] >> :has-text("Import an existing wallet")',
    useRecoveryButton: 'button[type="button"] >> :has-text("Use recovery phrase or private key")',
    mnemonicInput: 'input[class="sc-efBctP cSWuvD"]',
    importButton: 'button[type="submit"] >> :has-text("Import")',
    walletNameInput: 'input[name="name"]',
    passwordInput: 'input[type="password"][name="password"]',
    confirmPasswordInput: 'input[type="password"][name="confirmPassword"]',
    nextButton: 'button[type="submit"] >> :has-text("Next")',
    saveButton: 'button[type="button"] >> :has-text("Save")',
    additionalImportButton: 'button[type="button"] >> :has-text("Import")'
  };

  constructor(context: BrowserContext, setupPage: Page) {
    this.context = context;
    this.setupPage = setupPage;
  }

  /**
   * Log recording function
   */
  private log(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
  
  /**
   * Create screenshot
   */
  private async takeScreenshot(page: Page, name: string): Promise<void> {
    if (!fs.existsSync('./screenshots')) {
      fs.mkdirSync('./screenshots', { recursive: true });
    }
    
    await page.screenshot({ path: `./screenshots/${name}.png` });
  }

  /**
   * Complete Keplr wallet setup process
   */
  async setupWallet(): Promise<void> {
    // Visit extension page
    await this.setupPage.goto('chrome://extensions/');
    
    // Wait for Keplr popup page
    this.log('Waiting for Keplr popup');
    const keplrTabPromise = this.context.waitForEvent('page', { timeout: 60000 });
    let keplrPage = await keplrTabPromise;
    
    // Check if Keplr page shows registration interface
    if (!keplrPage.url().includes('register.html')) {
      this.log('Keplr extension page did not load registration interface');
      await this.takeScreenshot(keplrPage, 'error-no-onboarding');
      throw new Error('Keplr extension page did not load registration interface');
    }
    
    this.log('Detected Keplr page: ' + keplrPage.url());
    
    // Complete wallet import process
    await this.importWallet(keplrPage);
    await this.setupWalletDetails(keplrPage);
    await this.completeImport(keplrPage);
    
    // Close Keplr and setup pages
    this.log('Closing Keplr page and setup page');
    if (!keplrPage.isClosed()) {
      await keplrPage.close();
    }
    if (!this.setupPage.isClosed()) {
      await this.setupPage.close();
    }
    
    // Close any remaining extension tabs
    this.log('Closing any remaining extension tabs');
    const pagesAfterSetup = this.context.pages();
    for (const p of pagesAfterSetup) {
      if (p.url().startsWith('chrome-extension://') && p !== this.setupPage) {
        await p.close();
      }
    }
  }
  
  /**
   * Import wallet steps
   */
  private async importWallet(keplrPage: Page): Promise<void> {
    // Click "Import existing wallet"
    this.log('Clicking import existing wallet button');
    await keplrPage.waitForSelector(this.selectors.importWalletButton, { 
      state: 'visible', 
      timeout: 20000 
    });
    await keplrPage.locator(this.selectors.importWalletButton).click();
    
    // Click "Use recovery phrase or private key"
    this.log('Clicking use recovery phrase or private key button');
    await keplrPage.waitForSelector(this.selectors.useRecoveryButton, { 
      state: 'visible', 
      timeout: 10000 
    });
    await keplrPage.locator(this.selectors.useRecoveryButton).click();
    
    // Input mnemonic words
    this.log('Inputting mnemonic words');
    await keplrPage.waitForSelector(this.selectors.mnemonicInput, { 
      state: 'visible', 
      timeout: 10000 
    });
    const allInputs = await keplrPage.locator(this.selectors.mnemonicInput).all();
    
    if (allInputs.length >= 12) {
      for (let i = 0; i < 12; i++) {
        await allInputs[i].fill(this.mnemonicWords[i]);
        await keplrPage.waitForTimeout(200);
      }
    } else {
      this.log('Not enough input fields for mnemonic words');
      await this.takeScreenshot(keplrPage, 'error-mnemonic-inputs');
      throw new Error('Not enough input fields for mnemonic words');
    }
    
    // Click import button
    this.log('Clicking import button');
    await keplrPage.waitForSelector(this.selectors.importButton, { 
      state: 'visible', 
      timeout: 10000 
    });
    await keplrPage.locator(this.selectors.importButton).click();
    
    // Wait for page load
    this.log('Waiting for page load');
    await keplrPage.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await keplrPage.waitForLoadState('networkidle', { timeout: 30000 });
  }
  
  /**
   * Setup wallet details steps
   */
  private async setupWalletDetails(keplrPage: Page): Promise<void> {
    // Set wallet name
    this.log('Setting wallet name');
    try {
      await keplrPage.waitForFunction(
        () => document.querySelector('input[name="name"]') !== null,
        { timeout: 20000 }
      );
      const walletNameInput = keplrPage.locator(this.selectors.walletNameInput);
      if (await walletNameInput.isVisible({ timeout: 5000 })) {
        await walletNameInput.fill('autokeplr');
      }
    } catch (error) {
      this.log('Wallet name input not found, continuing execution');
    }
    
    // Set password
    this.log('Setting password');
    try {
      await keplrPage.waitForSelector(this.selectors.passwordInput, { 
        state: 'visible', 
        timeout: 10000 
      });
      const passwordInput = keplrPage.locator(this.selectors.passwordInput);
      if (await passwordInput.isVisible()) {
        await passwordInput.fill(this.password);
      }
    } catch (error) {
      this.log('Password input not found, continuing execution');
    }
    
    // Confirm password
    try {
      await keplrPage.waitForSelector(this.selectors.confirmPasswordInput, { 
        state: 'visible', 
        timeout: 10000 
      });
      const confirmPasswordInput = keplrPage.locator(this.selectors.confirmPasswordInput);
      if (await confirmPasswordInput.isVisible()) {
        await confirmPasswordInput.fill(this.password);
      }
    } catch (error) {
      this.log('Confirm password input not found, continuing execution');
    }
  }
  
  /**
   * Complete import process
   */
  private async completeImport(keplrPage: Page): Promise<void> {
    // Click next button
    this.log('Clicking next button');
    try {
      await keplrPage.waitForSelector(this.selectors.nextButton, { 
        state: 'visible', 
        timeout: 10000 
      });
      const nextButton = keplrPage.locator(this.selectors.nextButton);
      if (await nextButton.isVisible()) {
        await nextButton.click();
      }
    } catch (error) {
      this.log('Next button not found, continuing execution');
    }
    
    // Wait for page load
    await keplrPage.waitForLoadState('domcontentloaded', { timeout: 30000 })
      .catch(() => this.log('Page load timeout after clicking next button'));
    
    // Click save button
    this.log('Looking for save button');
    try {
      await keplrPage.waitForSelector(this.selectors.saveButton, { 
        state: 'visible', 
        timeout: 10000 
      });
      const saveButton = keplrPage.locator(this.selectors.saveButton);
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
    } catch (error) {
      this.log('Save button not found, continuing execution');
    }
    
    // Check additional import button
    this.log('Checking for additional import button');
    try {
      const importButton = keplrPage.locator(this.selectors.additionalImportButton);
      if (await importButton.isVisible({ timeout: 5000 })) {
        await importButton.click();
      }
    } catch (error) {
      this.log('Additional import button not found');
    }
  }
}