// tests/pages/BridgeNavigationPage.ts
import { Page, BrowserContext } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Bridge Navigation Page Class - Responsible for navigating to Bridge interface and handling UI transitions
 */
export class BridgeNavigationPage extends BasePage {
  private selectors = {
    // Navigation and UI elements
    homeButton: 'button._logo_1evmk_10',
    headerFirstButton: 'header button:first-child',
    buttonWithImage: 'button:has(img)',
    
    // BridgeUI related
    bridgeButton: 'button._item_zmlsm_7:has(span:text("Bridge/Swap"))',
    bridgeButtonWithIcon: 'button._item_zmlsm_7:has(svg path[d*="M11 3.5v-2l4 3-4 3v-2H2v-2zm-6 7v-2l-4 3 4 3v-2h9v-2z"])',
    bridgeIconPath: 'path[d="M11 3.5v-2l4 3-4 3v-2H2v-2zm-6 7v-2l-4 3 4 3v-2h9v-2zm0 1.75V10.5z"]',
    
    // WalletUI related
    overlayButton: 'button._overlay_1dxcf_1'
  };

  constructor(page: Page, context: BrowserContext) {
    super(page, context);
  }

  /**
   * Check if WalletUI is started
   */
  async isWalletUIStarted(): Promise<boolean> {
    const overlayButton = this.page.locator(this.selectors.overlayButton);
    return await overlayButton.isVisible({ timeout: 2000 }).catch(() => false);
  }

  /**
   * Navigate to Bridge/Swap interface - Direct click on Bridge/Swap button
   */
  async navigateToBridgeUI(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}]\n===== Attempting to enter Bridge/Swap interface =====`);
    
    // Define precise Bridge/Swap button selector
    const bridgeButtonSelector = 'button._item_zmlsm_7:has(span:text("Bridge/Swap"))';
    const homeButton = this.page.locator(this.selectors.homeButton);
    const homeButtonVisible = await homeButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (homeButtonVisible) {
      console.log(`[TaskID: ${this.taskId}] Home button visible, attempting to click...`);
      await this.takeScreenshot('before-home-button-click');
      await homeButton.click();
      await this.wait(2000);
      await this.takeScreenshot('after-home-button-click');
      console.log(`[TaskID: ${this.taskId}] Clicked home button`);
    } else {
      console.log(`[TaskID: ${this.taskId}] Home button not visible`);
    }
    
    try {
      console.log(`[TaskID: ${this.taskId}] Attempting to locate Bridge/Swap button...`);
      const bridgeButton = this.page.locator(bridgeButtonSelector);
      const buttonCount = await bridgeButton.count();
      
      if (buttonCount > 0) {
        console.log(`[TaskID: ${this.taskId}] Found ${buttonCount} Bridge/Swap buttons`);
        const isVisible = await bridgeButton.first().isVisible({ timeout: 3000 }).catch(() => false);
        
        if (isVisible) {
          console.log(`[TaskID: ${this.taskId}] Bridge/Swap button visible, clicking...`);
          await this.takeScreenshot('before-bridge-button-click');
          
          // Click button
          await bridgeButton.first().click({ timeout: 5000 });
          await this.wait(2000);
          
          await this.takeScreenshot('after-bridge-button-click');
          console.log(`[TaskID: ${this.taskId}] Clicked Bridge/Swap button, waiting for page load...`);
          
          // Wait for page load
          try {
            await this.waitForPageLoad(10000);
          } catch (loadError) {
            console.log(`[TaskID: ${this.taskId}] Page load timeout, but continuing execution`);
          }
          
          console.log(`[TaskID: ${this.taskId}] Bridge/Swap interface should be loaded`);
          return true;
        } else {
          console.log(`[TaskID: ${this.taskId}] Bridge/Swap button not visible`);
        }
      } else {
        console.log(`[TaskID: ${this.taskId}] Bridge/Swap button not found, trying backup selectors`);
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error locating Bridge/Swap button: ${error.message}`);
    }
    
    // Try various backup methods
    const alternativeMethods = [
      this.tryBridgeByIcon.bind(this),
      this.tryBridgeByXPath.bind(this),
      this.tryBridgeByText.bind(this),
      this.tryBridgeByURL.bind(this)
    ];
    
    for (const method of alternativeMethods) {
      try {
        const success = await method();
        if (success) {
          return true;
        }
      } catch (error: any) {
        console.log(`[TaskID: ${this.taskId}] Error using backup method: ${error.message}`);
      }
    }
    
    console.log(`[TaskID: ${this.taskId}] All attempts failed, unable to navigate to Bridge/Swap interface`);
    console.log(`[TaskID: ${this.taskId}] ===== Bridge/Swap interface navigation operation ended =====\n`);
    return false;
  }
  
  /**
   * Try to find Bridge button by icon
   */
  private async tryBridgeByIcon(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Attempting to locate Bridge/Swap button via SVG path...`);
    
    // Find button containing specific path SVG
    const pathSelector = 'button._item_zmlsm_7:has(path[d*="M11 3.5v-2l4 3-4 3v-2H2v-2z"])';
    const pathButton = this.page.locator(pathSelector);
    
    const pathButtonCount = await pathButton.count();
    if (pathButtonCount > 0) {
      console.log(`[TaskID: ${this.taskId}] Found ${pathButtonCount} buttons with Bridge icon`);
      const isVisible = await pathButton.first().isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isVisible) {
        console.log(`[TaskID: ${this.taskId}] Button with Bridge icon visible, clicking...`);
        await this.takeScreenshot('before-bridge-icon-click');
        
        // Click button
        await pathButton.first().click({ timeout: 5000 });
        await this.wait(2000);
        
        await this.takeScreenshot('after-bridge-icon-click');
        console.log(`[TaskID: ${this.taskId}] Clicked button with Bridge icon, waiting for page load...`);
        
        // Wait for page load
        await this.waitForPageLoad(10000);
        
        console.log(`[TaskID: ${this.taskId}] Bridge/Swap interface should be loaded`);
        return true;
      } else {
        console.log(`[TaskID: ${this.taskId}] Button with Bridge icon not visible`);
      }
    } else {
      console.log(`[TaskID: ${this.taskId}] No button found with Bridge icon`);
    }
    
    return false;
  }
  
  /**
   * Try to find Bridge button by XPath
   */
  private async tryBridgeByXPath(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Attempting to locate Bridge/Swap button via XPath...`);
    
    // Use XPath to locate Bridge/Swap button
    const xpathSelector = '//button[contains(@class, "_item_")][.//span[text()="Bridge/Swap"]]';
    const xpathButton = this.page.locator(xpathSelector);
    
    const xpathButtonCount = await xpathButton.count();
    if (xpathButtonCount > 0) {
      console.log(`[TaskID: ${this.taskId}] Found ${xpathButtonCount} Bridge/Swap buttons via XPath`);
      const isVisible = await xpathButton.first().isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isVisible) {
        console.log(`[TaskID: ${this.taskId}] Bridge/Swap button found via XPath visible, clicking...`);
        await this.takeScreenshot('before-xpath-button-click');
        
        // Click button
        await xpathButton.first().click({ timeout: 5000 });
        await this.wait(2000);
        
        await this.takeScreenshot('after-xpath-button-click');
        console.log(`[TaskID: ${this.taskId}] Clicked Bridge/Swap button found via XPath, waiting for page load...`);
        
        // Wait for page load
        await this.waitForPageLoad(10000);
        
        console.log(`[TaskID: ${this.taskId}] Bridge/Swap interface should be loaded`);
        return true;
      } else {
        console.log(`[TaskID: ${this.taskId}] Bridge/Swap button found via XPath not visible`);
      }
    } else {
      console.log(`[TaskID: ${this.taskId}] No Bridge/Swap button found via XPath`);
    }
    
    return false;
  }
  
  /**
   * Try to find Bridge button by text content
   */
  private async tryBridgeByText(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Attempting to locate Bridge/Swap button via simple text content...`);
    
    // Use simple text content to locate Bridge/Swap button
    const textSelector = 'button:has-text("Bridge/Swap")';
    const textButton = this.page.locator(textSelector);
    
    const textButtonCount = await textButton.count();
    if (textButtonCount > 0) {
      console.log(`[TaskID: ${this.taskId}] Found ${textButtonCount} Bridge/Swap buttons via text content`);
      const isVisible = await textButton.first().isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isVisible) {
        console.log(`[TaskID: ${this.taskId}] Bridge/Swap button found via text content visible, clicking...`);
        await this.takeScreenshot('before-text-button-click');
        
        // Click button
        await textButton.first().click({ timeout: 5000 });
        await this.wait(2000);
        
        await this.takeScreenshot('after-text-button-click');
        console.log(`[TaskID: ${this.taskId}] Clicked Bridge/Swap button found via text content, waiting for page load...`);
        
        // Wait for page load
        await this.waitForPageLoad(10000);
        
        console.log(`[TaskID: ${this.taskId}] Bridge/Swap interface should be loaded`);
        return true;
      } else {
        console.log(`[TaskID: ${this.taskId}] Bridge/Swap button found via text content not visible`);
      }
    } else {
      console.log(`[TaskID: ${this.taskId}] No Bridge/Swap button found via text content`);
    }
    
    return false;
  }
  
  /**
   * Try to navigate to Bridge page directly via URL
   */
  private async tryBridgeByURL(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] All methods failed, attempting to navigate to Bridge page directly via URL...`);
    // Use baseUrl to build bridge page URL
    const bridgeUrl = `${this.baseUrl}/bridge`;
    await this.page.goto(bridgeUrl, { 
      timeout: 30000,
      waitUntil: 'domcontentloaded' 
    });
    await this.wait(2000);
    
    console.log(`[TaskID: ${this.taskId}] Navigated to Bridge page via URL: ${bridgeUrl}`);
    return true;
  }

  /**
   * Click home button operation
   */
  async clickHomeButton(): Promise<void> {
    console.log(`[TaskID: ${this.taskId}]\n===== Attempting to click home button =====`);
    
    // Check WalletUI
    const walletUIStarted = await this.isWalletUIStarted();
    if (!walletUIStarted) {
      console.log(`[TaskID: ${this.taskId}] WalletUI not successfully started, home button click may not be effective`);
    }
    
    // Now attempt to click home button
    try {
      // 1. Try to find home button by class name
      let homeButton = this.page.locator(this.selectors.homeButton);
      let isVisible = await homeButton.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        console.log(`[TaskID: ${this.taskId}] Found home button (._logo_1evmk_10), clicking...`);
        await this.takeScreenshot('before-home-button-click');
        await homeButton.click();
        await this.wait(1000);
        await this.takeScreenshot('after-home-button-click');
        console.log(`[TaskID: ${this.taskId}] Clicked home button`);
      } else {
        // 2. Try to find by first button
        homeButton = this.page.locator(this.selectors.headerFirstButton);
        isVisible = await homeButton.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (isVisible) {
          console.log(`[TaskID: ${this.taskId}] Found first button in header, clicking...`);
          await this.takeScreenshot('before-first-button-click');
          await homeButton.click();
          await this.wait(1000);
          await this.takeScreenshot('after-first-button-click');
          console.log(`[TaskID: ${this.taskId}] Clicked first button in header`);
        } else {
          // 3. Try to find any button with image
          homeButton = this.page.locator(this.selectors.buttonWithImage).first();
          isVisible = await homeButton.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (isVisible) {
            console.log(`[TaskID: ${this.taskId}] Found button with image, clicking...`);
            await this.takeScreenshot('before-img-button-click');
            await homeButton.click();
            await this.wait(1000);
            await this.takeScreenshot('after-img-button-click');
            console.log(`[TaskID: ${this.taskId}] Clicked button with image`);
          } else {
            console.log(`[TaskID: ${this.taskId}] Could not find any possible home button`);
          }
        }
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error clicking home button: ${error.message}`);
    }
    
    // Wait for navigation to complete
    try {
      await this.waitForPageLoad(10000);
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error waiting for page load: ${error.message}`);
    }
    
    // Output current URL
    const currentUrl = this.page.url();
    console.log(`[TaskID: ${this.taskId}] Current page URL: ${currentUrl}`);
    
    console.log(`[TaskID: ${this.taskId}] ===== Home button click operation ended =====\n`);
  }

  /**
   * Wait for Bridge page loading - Simplified version, prioritize checking Loading text
   * @param maxWaitTime Maximum wait time (milliseconds), default 15 seconds
   * @returns Whether successfully waited for loading to complete
   */
  async waitForBridgePageLoading(maxWaitTime: number = 15000): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Waiting for Bridge page loading to complete...`);
    
    // First check if there's obvious Loading text on page
    const loadingTextSelectors = [
      'text="Loading..."',
      'text="Loading"',
      'text="加载中..."',
      'text="加载中"',
      'div:has-text("Loading")',
      'span:has-text("Loading")',
      'p:has-text("Loading")'
    ];
    
    // Core loading indicator selectors - keep most common ones
    const loadingElementSelectors = [
      'div[role="progressbar"]',
      '.spinner',
      'div[class*="loading"]',
      'svg[class*="spin"]'
    ];
    
    // Combine all selectors
    const allSelectors = [...loadingTextSelectors, ...loadingElementSelectors];
    
    // Check if any loading indicator is visible
    let anyLoadingVisible = false;
    let visibleSelector = '';
    
    for (const selector of allSelectors) {
      try {
        const elements = this.page.locator(selector);
        const count = await elements.count();
        
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const isVisible = await elements.nth(i).isVisible().catch(() => false);
            if (isVisible) {
              anyLoadingVisible = true;
              visibleSelector = selector;
              console.log(`[TaskID: ${this.taskId}] Detected loading indicator: ${selector}`);
              break;
            }
          }
        }
        
        if (anyLoadingVisible) break;
      } catch (e) {
        // Ignore selector errors, continue checking next one
      }
    }
    
    // If no loading indicator detected, return immediately
    if (!anyLoadingVisible) {
      console.log(`[TaskID: ${this.taskId}] No loading indicator detected, page may be already loaded`);
      await this.takeScreenshot('bridge-page-already-loaded');
      return true;
    }
    
    // Record loading state
    console.log(`[TaskID: ${this.taskId}] Loading state detected, waiting for it to disappear...`);
    await this.takeScreenshot('bridge-page-loading');
    
    // Wait for loading indicator to disappear
    const startTime = Date.now();
    
    try {
      // Wait for detected loading indicator to disappear
      await this.page.waitForSelector(visibleSelector, { 
        state: 'hidden',
        timeout: maxWaitTime 
      });
      
      const waitTime = Date.now() - startTime;
      console.log(`[TaskID: ${this.taskId}] Loading indicator disappeared, took ${waitTime}ms`);
      await this.takeScreenshot('bridge-loading-completed');
      
      // Wait extra small time to ensure page fully rendered
      await this.page.waitForTimeout(1000);
      
      return true;
    } catch (error) {
      // After timeout, log and take screenshot
      console.log(`[TaskID: ${this.taskId}] Timeout waiting for loading indicator to disappear (${maxWaitTime}ms), continuing with operation`);
      await this.takeScreenshot('bridge-loading-timeout');
      
      // Check if any buttons or inputs are visible, if so, page might actually be usable
      const interactiveElements = [
        'button:visible', 
        'input:visible',
        'select:visible'
      ];
      
      for (const selector of interactiveElements) {
        try {
          const count = await this.page.locator(selector).count();
          if (count > 0) {
            console.log(`[TaskID: ${this.taskId}] Although loading indicator still visible, detected ${count} interactive elements on page`);
            return true;
          }
        } catch (e) {
          // Ignore selector errors
        }
      }
      
      return false;
    }
  }

  /**
   * Check if form elements are ready
   * @returns Whether form elements are ready
   */
  async checkFormElementsReady(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Checking if form elements are ready...`);
    
    // Define key form element selectors
    const formSelectors = [
      'button._root_1luwi_1', // FROM/TO button
      'input[inputmode="decimal"]', // Amount input
      'button:has-text("Preview Route")', // Preview button
      'form' // Form container
    ];
    
    // Wait for any key form element to appear
    for (const selector of formSelectors) {
      const element = this.page.locator(selector);
      const isVisible = await element.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isVisible) {
        console.log(`[TaskID: ${this.taskId}] Detected key form element: ${selector}`);
        await this.takeScreenshot('form-elements-ready');
        return true;
      }
    }
    
    console.log(`[TaskID: ${this.taskId}] No key form elements detected`);
    await this.takeScreenshot('form-elements-not-ready');
    return false;
  }
}