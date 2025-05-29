// tests/pages/WalletPage.ts
import { Page, BrowserContext } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Wallet Page Class - Responsible for wallet connection and management functions
 */
export class WalletPage extends BasePage {
  /**
   * Selectors organization - Group all selectors together for maintenance
   * Grouped by functionality with comments
   */
  private readonly selectors = {
    // Wallet connection related
    connect: {
      walletButton: 'button:has-text("Connect"), button:has-text("连接钱包")',
      keplrOption: 'text=Keplr'
    },
    
    // Authorization related
    authorization: {
      // Keplr popup
      approveButton: 'button:has-text("Approve"), button:has-text("Confirm")',
      rejectButton: 'button:has-text("Reject"), button:has-text("拒绝")',
      inlineApproveButton: 'button:has-text("Approve"), button:has-text("Confirm"), button:has-text("授权")',
      
      // Keplr popup button search strategy
      keplrApproveButtons: [
        'button:has-text("Approve")',
        'button:has-text("批准")',
        'button:has-text("允许")',
        'button.approve-button',
        'button.primary-button',
        'button.blue-button',
        'button:right-of(:text("Reject"))',
        'button:last-child'
      ],
      visibleButtons: 'button:visible'
    },
    
    // Wallet status detection related
    walletStatus: {
      // Address display related
      walletAddressBase: '.wallet-address, .address-display, ._address_1evmk_27',
      walletAddressSelectors: [
        '.wallet-address', 
        '.address-display', 
        '._address_1evmk_27', 
        'button._copy_1evmk_15',
        'text=/init1\\w+/i'
      ],
      disconnectButton: 'button._disconnect_1evmk_51, button:has(svg) >> nth=1',
      actionButton: 'button:has-text("Action")'
    },
    
    // WalletUI related
    walletUI: {
      walletUILabelSelector: 'span.m_811560b9, span.mantine-Button-label',
      walletUIButtonSelector: 'button:has-text("init"), button:has-text(".init")',
      overlayButton: 'button._overlay_1dxcf_1'
    }
  };

  constructor(page: Page, context: BrowserContext) {
    super(page, context);
  }

  /**
   * Click connect wallet button
   */
  async clickConnectWallet(): Promise<void> {
    console.log(`[TaskID: ${this.taskId}] Attempting to click connect wallet button`);
    const connectButton = this.page.locator(this.selectors.connect.walletButton).first();
    
    if (await connectButton.isVisible({ timeout: 5000 })) {
      console.log(`[TaskID: ${this.taskId}] Found connect wallet button, clicking...`);
      await connectButton.click();
      await this.wait(2000);
    } else {
      console.log(`[TaskID: ${this.taskId}] Connect wallet button not found, may already be connected`);
    }
  }
  
  /**
   * Select Keplr wallet option
   */
  async selectKeplrWallet(): Promise<void> {
    console.log(`[TaskID: ${this.taskId}] Attempting to select Keplr wallet`);
    const keplrOption = this.page.locator(this.selectors.connect.keplrOption);
    
    if (await keplrOption.isVisible({ timeout: 5000 })) {
      console.log(`[TaskID: ${this.taskId}] Found Keplr option, clicking...`);
      await keplrOption.click();
      await this.wait(2000);
    } else {
      console.log(`[TaskID: ${this.taskId}] Keplr option not found, may be automatically selected`);
    }
  }

  /**
   * Handle Keplr authorization popup
   */
  async handleKeplrApproval(): Promise<void> {
    console.log(`[TaskID: ${this.taskId}] Waiting for Keplr authorization popup...`);
    
    // Find existing Keplr authorization page
    const pages = this.context.pages();
    let keplrPopup = null;
    
    for (const page of pages) {
      if (page !== this.page) {
        const url = page.url();
        const title = await page.title().catch(() => '');
        
        // Check URL or title to determine if it's Keplr authorization page
        if ((url.includes('chrome-extension') && url.includes('permission')) || 
            (title === 'Keplr' && url.includes('popup.html'))) {
          console.log(`[TaskID: ${this.taskId}] Found Keplr authorization page: ${url}`);
          keplrPopup = page;
          break;
        }
      }
    }
    
    // If found Keplr authorization page, try to click Approve button
    if (keplrPopup) {
      try {
        console.log(`[TaskID: ${this.taskId}] Looking for approve button in Keplr popup`);
        await keplrPopup.screenshot({ path: `screenshots/keplr-popup-task-${this.taskId}.png` });
        
        // Try multiple selectors to find approve button
        let found = false;
        for (const selector of this.selectors.authorization.keplrApproveButtons) {
          const button = keplrPopup.locator(selector);
          const count = await button.count();
          if (count > 0) {
            // Check if visible
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`[TaskID: ${this.taskId}] Found approve button (${selector}), clicking...`);
              await button.click();
              await keplrPopup.waitForTimeout(2000);
              found = true;
              break;
            }
          }
        }
        
        // If can't find button, print all visible buttons
        if (!found) {
          console.log(`[TaskID: ${this.taskId}] Could not find approve button via selectors, printing all visible buttons:`);
          
          const allButtons = keplrPopup.locator(this.selectors.authorization.visibleButtons);
          const buttonCount = await allButtons.count();
          console.log(`[TaskID: ${this.taskId}] Found ${buttonCount} visible buttons`);
          
          // Check each button
          for (let i = 0; i < buttonCount; i++) {
            const buttonElement = allButtons.nth(i);
            const text = await buttonElement.textContent()
              .catch(() => 'Unable to get text');
            const className = await buttonElement.getAttribute('class')
              .catch(() => 'Unable to get class name');
            console.log(`[TaskID: ${this.taskId}] Button ${i+1}: Text="${text ? text.trim() : ''}", Class="${className}"`);
            
            // If text contains Approve or similar, click it
            if (text && (text.includes('Approve') || text.includes('批准') || text.includes('确认'))) {
              console.log(`[TaskID: ${this.taskId}] Found matching text button: ${text}, clicking...`);
              await buttonElement.click();
              await keplrPopup.waitForTimeout(2000);
              found = true;
              break;
            }
          }
          
          // If still can't find button, try clicking last button (usually confirm button)
          if (!found && buttonCount > 0) {
            console.log(`[TaskID: ${this.taskId}] Attempting to click last button (usually confirm button)`);
            await allButtons.last().click();
            await keplrPopup.waitForTimeout(2000);
          }
        }
        
        // If popup still open, close it
        if (!keplrPopup.isClosed()) {
          console.log(`[TaskID: ${this.taskId}] Keplr authorization page still open, closing it`);
          await keplrPopup.close();
        }
      } catch (error: any) {
        console.log(`[TaskID: ${this.taskId}] Error handling Keplr authorization page: ${error.message}`);
        // Try to take screenshot
        try {
          if (!keplrPopup.isClosed()) {
            await keplrPopup.screenshot({ path: `screenshots/keplr-popup-error-task-${this.taskId}.png` });
          }
        } catch (e) {
          // Ignore screenshot error
        }
      }
    } else {
      console.log(`[TaskID: ${this.taskId}] No Keplr authorization page found, waiting for new page`);
      
      // Wait for new authorization page
      const popupPromise = this.context.waitForEvent('page', { timeout: 5000 })
        .catch(() => {
          console.log(`[TaskID: ${this.taskId}] Timeout waiting for new page, no authorization page appeared`);
          return null;
        });
      
      const newPopup = await popupPromise;
      if (newPopup) {
        console.log(`[TaskID: ${this.taskId}] Detected new page: ${newPopup.url()}`);
        await newPopup.waitForLoadState('domcontentloaded', { timeout: 10000 });
        
        // Find approve button
        const approveButton = newPopup.locator(this.selectors.authorization.approveButton);
        if (await approveButton.isVisible({ timeout: 5000 })) {
          console.log(`[TaskID: ${this.taskId}] Found approve button, clicking...`);
          await approveButton.click();
          await newPopup.waitForTimeout(2000);
        }
        
        // If popup still open then close
        if (!newPopup.isClosed()) {
          await newPopup.close();
        }
      }
    }
    
    // Check for inline authorization dialog
    try {
      console.log(`[TaskID: ${this.taskId}] Checking main page for inline authorization dialog`);
      const inlineApproveButton = this.page.locator(this.selectors.authorization.inlineApproveButton);
      if (await inlineApproveButton.isVisible({ timeout: 2000 })) {
        console.log(`[TaskID: ${this.taskId}] Found authorization button on main page, clicking...`);
        await inlineApproveButton.click();
        await this.wait(2000);
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error checking inline authorization dialog: ${error.message}`);
    }
    
    await this.takeScreenshot('after-wallet-connection');
  }
  
  /**
   * Complete wallet connection flow
   */
  async connectWallet(): Promise<void> {
    try {
      console.log(`[TaskID: ${this.taskId}] Starting wallet connection flow`);
      
      // First attempt to click connect wallet button
      await this.clickConnectWallet();
      
      // Try to select Keplr
      const keplrOption = this.page.locator(this.selectors.connect.keplrOption);
      const isKeplrVisible = await keplrOption.isVisible({ timeout: 2000 }).catch(() => false);
      
      // If Keplr option not found, close popup and retry
      if (!isKeplrVisible) {
        console.log(`[TaskID: ${this.taskId}] Keplr option not found, closing popup and retrying`);
        
        // Close popup by clicking top-left or pressing ESC
        await this.page.keyboard.press('Escape');
        await this.wait(1000);
        
        // Click connect wallet button again
        console.log(`[TaskID: ${this.taskId}] Clicking connect wallet button again`);
        await this.clickConnectWallet();
      }
      
      // Select Keplr wallet
      await this.selectKeplrWallet();
      
      // Handle Keplr authorization popup
      await this.handleKeplrApproval();
      
      console.log(`[TaskID: ${this.taskId}] Wallet connection flow complete`);
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error during wallet connection: ${error.message}`);
      // Continue test even if connection fails
    }
  }
  
  /**
   * Verify wallet is connected - Enhanced version
   */
  async verifyWalletConnected(): Promise<boolean> {
    // Use defined selectors array
    for (const selector of this.selectors.walletStatus.walletAddressSelectors) {
      const element = this.page.locator(selector);
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        console.log(`[TaskID: ${this.taskId}] Found wallet address element: ${selector}`);
        return true;
      }
    }
    
    // Check disconnect button
    const disconnectButton = this.page.locator(this.selectors.walletStatus.disconnectButton);
    if (await disconnectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`[TaskID: ${this.taskId}] Found wallet disconnect button, wallet is connected`);
      return true;
    }
    
    console.log(`[TaskID: ${this.taskId}] No wallet address element found, wallet may not be connected`);
    return false;
  }

  /**
   * Launch WalletUI - Check if WalletUI is started, if not click start button
   */
  async launchWalletUI(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}]\n===== Starting WalletUI Launch =====`);
    
    // First check if WalletUI is already started (by checking overlay button)
    const overlayButton = this.page.locator(this.selectors.walletUI.overlayButton);
    const overlayButtonVisible = await overlayButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (overlayButtonVisible) {
      console.log(`[TaskID: ${this.taskId}] WalletUI is already started (overlay button found)`);
      return true;
    }
    
    console.log(`[TaskID: ${this.taskId}] WalletUI not detected as started, attempting to start WalletUI...`);
    
    // Try to find and click WalletUI launch button
    let found = false;
    
    // 1. Try to find via Mantine button text
    try {
      console.log(`[TaskID: ${this.taskId}] Attempting to find via Mantine button text...`);
      const walletLabels = this.page.locator(this.selectors.walletUI.walletUILabelSelector);
      const labelCount = await walletLabels.count();
      
      console.log(`[TaskID: ${this.taskId}] Found ${labelCount} Mantine button labels`);
      
      for (let i = 0; i < labelCount; i++) {
        const label = walletLabels.nth(i);
        const text = await label.textContent();
        
        // Check if text contains specific content
        if (text && (text.includes('init') || text.includes('.init'))) {
          console.log(`[TaskID: ${this.taskId}] Found matching button label: "${text}"`);
          
          // Get parent button element
          const button = label.locator('xpath=ancestor::button');
          const isVisible = await button.isVisible().catch(() => false);
          
          if (isVisible) {
            console.log(`[TaskID: ${this.taskId}] Found WalletUI launch button, clicking...`);
            await this.takeScreenshot('before-wallet-button-click');
            await button.click();
            await this.wait(2000);
            await this.takeScreenshot('after-wallet-button-click');
            found = true;
            break;
          }
        }
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Failed to find via Mantine button text: ${error.message}`);
    }
    
    // 2. If above method fails, try via more generic selector
    if (!found) {
      try {
        console.log(`[TaskID: ${this.taskId}] Attempting to find WalletUI button via generic selector...`);
        const genericButton = this.page.locator(this.selectors.walletUI.walletUIButtonSelector);
        const buttonCount = await genericButton.count();
        
        if (buttonCount > 0) {
          console.log(`[TaskID: ${this.taskId}] Found ${buttonCount} matching buttons`);
          const button = genericButton.first();
          console.log(`[TaskID: ${this.taskId}] Clicking found button...`);
          await this.takeScreenshot('before-generic-wallet-click');
          await button.click();
          await this.wait(2000);
          await this.takeScreenshot('after-generic-wallet-click');
          found = true;
        } else {
          console.log(`[TaskID: ${this.taskId}] No buttons found matching text`);
        }
      } catch (error: any) {
        console.log(`[TaskID: ${this.taskId}] Failed to find via generic selector: ${error.message}`);
      }
    }
    
    // 3. If both methods fail, print all button information
    if (!found) {
      console.log(`[TaskID: ${this.taskId}] All attempts failed`);
      console.log(`[TaskID: ${this.taskId}] Failed to start WalletUI`);
      return false;
    }
    
    // Check again if WalletUI is started
    console.log(`[TaskID: ${this.taskId}] Checking if WalletUI successfully started...`);
    
    // Check overlay button
    const overlayButtonAfter = this.page.locator(this.selectors.walletUI.overlayButton);
    const isOverlayButtonVisible = await overlayButtonAfter.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isOverlayButtonVisible) {
      console.log(`[TaskID: ${this.taskId}] WalletUI successfully started (overlay button found)`);
      return true;
    }
    
    // Check other possible indicators
    for (const selector of this.selectors.walletStatus.walletAddressSelectors) {
      const element = this.page.locator(selector);
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        console.log(`[TaskID: ${this.taskId}] WalletUI successfully started (found wallet address element: ${selector})`);
        return true;
      }
    }
    
    console.log(`[TaskID: ${this.taskId}] WalletUI may not have started successfully`);
    return false;
  }
}