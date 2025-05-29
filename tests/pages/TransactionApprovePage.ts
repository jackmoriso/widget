// tests/pages/TransactionApprovePage.ts
import { Page, BrowserContext } from '@playwright/test';
import { BasePage } from './BasePage';
import { BridgeOperationInput, BridgeOperationOutput } from './BridgeInterfaces';

/**
 * Transaction Approve Page Class - Specifically responsible for handling transaction confirmation and approval process
 */
export class TransactionApprovePage extends BasePage {
  private selectors = {
    // Error message related
    errorMessage: 'div[class*="error"], div[style*="color: red"], div:has-text("Insufficient balance")',
    warningIcon: 'svg[class*="warning"], svg[class*="error"]',
    
    // Confirmation related
    confirmationTitle: 'h2:has-text("Confirmation"), div[class*="title"]:has-text("Confirm")',
    approveButton: 'button:has-text("Approve"), button:has-text("确认")',
    rejectButton: 'button:has-text("Reject"), button:has-text("拒绝")',
    
    // Transaction details
    feeItem: 'div._item_13b0h_1',
    feeTitle: 'div._title_13b0h_11',
    feeContent: 'div._content_13b0h_15',
    chainInfo: 'div:has-text("Chain")',
    
    // Transaction operations
    callItem: 'div:has-text("Call")',
    initiateItem: 'div:has-text("Initiate token withdrawal")',
    
    // Modal elements
    modal: 'div[role="dialog"], div.modal',
    modalCloseButton: 'button:has-text("Close"), button:has-text("关闭"), button.close-button'
  };

  constructor(page: Page, context: BrowserContext) {
    super(page, context);
  }

  /**
   * Check if page displays error message
   * @returns Error message text (if exists) or undefined (if no error)
   */
  async checkForErrorMessage(): Promise<string | undefined> {
    console.log(`[TaskID: ${this.taskId}] Checking for error messages...`);
    
    try {
      // Check various possible error message element selectors
      const errorSelectors = [
        // Red error messages, like "Insufficient balance for fee"
        'div[class*="error"], div[style*="color: red"]',
        // Messages with warning icons
        'div:has(svg[class*="warning"]), div:has(svg[class*="error"])',
        // Specific error message classes
        'div._error_8hdzq_24, div[class*="_error_"]',
        // Messages containing specific text
        'div:has-text("Insufficient balance")',
        'div:has-text("Error")',
        'div:has-text("Failed")'
      ];
      
      // Screenshot
      await this.takeScreenshot('error-message-check');
      
      // Check each selector for error messages
      for (const selector of errorSelectors) {
        const errorElement = this.page.locator(selector);
        
        // Check if there are matching error elements
        const count = await errorElement.count();
        if (count > 0) {
          // Loop through all matching elements, find visible error messages
          for (let i = 0; i < count; i++) {
            const element = errorElement.nth(i);
            const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
            
            if (isVisible) {
              // Get error text
              const errorText = await element.textContent();
              if (errorText && errorText.trim()) {
                console.log(`[TaskID: ${this.taskId}] Found error message: "${errorText.trim()}"`);
                return errorText.trim();
              }
            }
          }
        }
      }
      
      // Use JavaScript to find error messages in page, more flexible handling
      const jsError = await this.page.evaluate(() => {
        // Find all possible error elements
        const errorElements = [
          // Search by class name
          ...Array.from(document.querySelectorAll('[class*="error"], [class*="Error"]')),
          // Search by color
          ...Array.from(document.querySelectorAll('div')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.color === 'red' || style.color === '#ff0000' || style.color.includes('rgb(255');
          }),
          // Search by content
          ...Array.from(document.querySelectorAll('div')).filter(el => {
            const text = el.textContent?.trim().toLowerCase() || '';
            return text.includes('error') || 
                   text.includes('insufficient') || 
                   text.includes('failed') ||
                   text.includes('balance');
          })
        ];
        
        // Filter out invisible elements and get error text
        for (const el of errorElements) {
          // Check if element is visible
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (isVisible) {
            const text = el.textContent?.trim();
            if (text) return text;
          }
        }
        
        return null; // No error message found
      });
      
      if (jsError) {
        console.log(`[TaskID: ${this.taskId}] Found error message via JavaScript: "${jsError}"`);
        return jsError;
      }
      
      console.log(`[TaskID: ${this.taskId}] No error message found`);
      return undefined;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error checking for error messages: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Check if Approve button is enabled
   * @returns Boolean indicating whether button is enabled
   */
  async isApproveButtonEnabled(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Checking if Approve button is enabled...`);
    
    try {
      // Screenshot
      await this.takeScreenshot('approve-button-check');
      
      // Use selector defined in class
      const approveButton = this.page.locator(this.selectors.approveButton);
      
      // First check if button is visible
      const isVisible = await approveButton.isVisible({ timeout: 3000 }).catch(() => false);
      if (!isVisible) {
        console.log(`[TaskID: ${this.taskId}] Approve button not visible`);
        return false;
      }
      
      // Then check if button is enabled (not disabled)
      const isEnabled = await approveButton.isEnabled({ timeout: 1000 }).catch(() => false);
      console.log(`[TaskID: ${this.taskId}] Approve button status: ${isEnabled ? 'enabled' : 'disabled'}`);
      
      // If button is visible but disabled, check for visual disabled indicators
      if (!isEnabled) {
        // Check if button's class name or style indicates it's disabled
        const isDisabledByClass = await approveButton.evaluate(el => {
          return el.classList.contains('disabled') || 
                 el.classList.contains('btn-disabled') || 
                 el.hasAttribute('disabled') ||
                 window.getComputedStyle(el).opacity === '0.5' ||
                 window.getComputedStyle(el).cursor === 'not-allowed';
        });
        
        if (isDisabledByClass) {
          console.log(`[TaskID: ${this.taskId}] Approve button confirmed disabled via CSS styles`);
          return false;
        }
      }
      
      // If above methods don't determine, use JavaScript for deeper check
      const jsCheckResult = await this.page.evaluate(() => {
        // Try to find Approve button in multiple ways
        const approveButtons = [
          ...Array.from(document.querySelectorAll('button')).filter(btn => 
            btn.textContent?.trim() === 'Approve'
          ),
          document.querySelector('button[class*="approve"]'),
          document.querySelector('button.primary-button')
        ].filter(Boolean); // Filter out null and undefined
        
        if (approveButtons.length === 0) {
          return { found: false, enabled: false };
        }
        
        // Check first matching button
        const button = approveButtons[0] as HTMLButtonElement;
        
        // Check if button is enabled
        const isDisabled = button.disabled || 
                          button.hasAttribute('disabled') || 
                          button.classList.contains('disabled') ||
                          window.getComputedStyle(button).opacity === '0.5' ||
                          window.getComputedStyle(button).cursor === 'not-allowed';
        
        return { 
          found: true, 
          enabled: !isDisabled,
          classes: button.className,
          style: {
            opacity: window.getComputedStyle(button).opacity,
            cursor: window.getComputedStyle(button).cursor,
            backgroundColor: window.getComputedStyle(button).backgroundColor
          }
        };
      });
      
      if (jsCheckResult.found) {
        console.log(`[TaskID: ${this.taskId}] JavaScript check of Approve button:`);
        console.log(`[TaskID: ${this.taskId}] - Enabled status: ${jsCheckResult.enabled}`);
        console.log(`[TaskID: ${this.taskId}] - Classes: ${jsCheckResult.classes}`);
        console.log(`[TaskID: ${this.taskId}] - Style: ${JSON.stringify(jsCheckResult.style)}`);
        
        return jsCheckResult.enabled;
      }
      
      // Return result from DOM property check
      return isEnabled;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error checking Approve button status: ${error.message}`);
      // Return false on error, being conservative
      return false;
    }
  }

  /**
   * Click Approve button
   * @returns Whether successfully clicked
   */
  async clickApproveButton(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Attempting to click Approve button`);
    
    try {
      const approveButton = this.page.locator(this.selectors.approveButton);
      
      if (await approveButton.isVisible({ timeout: 5000 })) {
        await this.takeScreenshot('before-approve-click');
        await approveButton.click();
        
        // Wait for page change
        await this.wait(2000);
        await this.waitForPageLoad();
        
        await this.takeScreenshot('after-approve-click');
        console.log(`[TaskID: ${this.taskId}] Clicked Approve button`);
        return true;
      } else {
        console.log(`[TaskID: ${this.taskId}] Approve button not found, trying alternative options...`);
        
        // Try to find possible "Confirm", "Accept" or similar buttons
        const alternativeButtons = [
          this.page.locator('button:has-text("Confirm")'),
          this.page.locator('button:has-text("确认")'),
          this.page.locator('button:has-text("Agree")'),
          this.page.locator('button:has-text("Accept")'),
          this.page.locator('button:has-text("Yes")')
        ];
        
        for (const button of alternativeButtons) {
          if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log(`[TaskID: ${this.taskId}] Found alternative confirmation button, clicking...`);
            await this.takeScreenshot('before-alternative-approve-click');
            await button.click();
            await this.wait(2000);
            await this.takeScreenshot('after-alternative-approve-click');
            return true;
          }
        }
        
        // If modal exists but no clear confirmation button found, try last button
        const modal = this.page.locator(this.selectors.modal);
        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
          const modalButtons = modal.locator('button');
          const buttonCount = await modalButtons.count();
          
          if (buttonCount > 0) {
            console.log(`[TaskID: ${this.taskId}] Found ${buttonCount} buttons in modal, clicking last one...`);
            await this.takeScreenshot('before-modal-last-button-click');
            await modalButtons.last().click();
            await this.wait(2000);
            await this.takeScreenshot('after-modal-last-button-click');
            return true;
          }
        }
        
        console.log(`[TaskID: ${this.taskId}] No Approve button or alternative buttons found`);
        return false;
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error clicking Approve button: ${error.message}`);
      return false;
    }
  }

  /**
   * Wait for transaction processing
   * @param timeout Wait timeout (milliseconds)
   * @returns Whether successfully completed processing
   */
  async waitForTransactionProcessing(timeout: number = 30000): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Waiting for transaction processing to complete...`);
    
    // Screenshot current state
    await this.takeScreenshot('wait-transaction-start');
    
    // Define possible loading indicators
    const loadingIndicators = [
      'div[class*="loading"], div[class*="spinner"]',
      'svg[class*="spin"], svg[class*="loading"]',
      'div:has-text("Processing..."), div:has-text("处理中")'
    ];
    
    // Check if loading indicator exists
    let processingDetected = false;
    for (const indicator of loadingIndicators) {
      const element = this.page.locator(indicator);
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[TaskID: ${this.taskId}] Detected processing indicator: ${indicator}`);
        processingDetected = true;
        break;
      }
    }
    
    if (processingDetected) {
      // Wait for processing to complete - wait for all loading indicators to disappear
      const startTime = Date.now();
      let allHidden = false;
      
      while (Date.now() - startTime < timeout) {
        allHidden = true;
        
        for (const indicator of loadingIndicators) {
          const element = this.page.locator(indicator);
          if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
            allHidden = false;
            break;
          }
        }
        
        if (allHidden) {
          console.log(`[TaskID: ${this.taskId}] All processing indicators disappeared, transaction processing might be complete`);
          break;
        }
        
        // Wait a while before checking again
        await this.wait(2000);
      }
      
      // Check if timed out
      if (!allHidden) {
        console.log(`[TaskID: ${this.taskId}] Waiting for transaction processing timed out (${timeout}ms)`);
        await this.takeScreenshot('wait-transaction-timeout');
        return false;
      }
    } else {
      console.log(`[TaskID: ${this.taskId}] No processing indicator detected, might be completed or not started yet`);
    }
    
    // Wait for page to stabilize
    await this.wait(2000);
    await this.takeScreenshot('wait-transaction-complete');
    
    return true;
  }

  /**
   * Get transaction fee information
   * @returns Fee information string
   */
  async getTransactionFee(): Promise<string | undefined> {
    console.log(`[TaskID: ${this.taskId}] Getting transaction fee information...`);
    
    try {
      // Use precise class name selectors
      const feeItemSelector = this.selectors.feeItem;
      const feeTitleSelector = this.selectors.feeTitle;
      const feeContentSelector = this.selectors.feeContent;
      
      // Find all fee items
      const allItems = await this.page.locator(feeItemSelector).all();
      console.log(`[TaskID: ${this.taskId}] Found ${allItems.length} possible Fee items`);
      
      // Loop through all items, find one with title "Fee"
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const titleElement = item.locator(feeTitleSelector);
        
        // Get title text
        const titleText = await titleElement.textContent();
        
        if (titleText && titleText.trim() === 'Fee') {
          // Get content text
          const contentElement = item.locator(feeContentSelector);
          const feeValue = await contentElement.textContent();
          
          if (feeValue) {
            console.log(`[TaskID: ${this.taskId}] Got Fee information: ${feeValue.trim()}`);
            return feeValue.trim();
          }
        }
      }
      
      // Fallback method: CSS combination selector
      try {
        const directFeeSelector = 'div._title_13b0h_11:has-text("Fee") + div._content_13b0h_15';
        const directFeeElement = this.page.locator(directFeeSelector);
        
        if (await directFeeElement.isVisible({ timeout: 2000 })) {
          const feeValue = await directFeeElement.textContent();
          if (feeValue) {
            console.log(`[TaskID: ${this.taskId}] Got Fee information via fallback method: ${feeValue.trim()}`);
            return feeValue.trim();
          }
        }
      } catch (e) {
        // Ignore error, try next method
      }
      
      console.log(`[TaskID: ${this.taskId}] Unable to get Fee information`);
      return undefined;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error getting Fee information: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Handle possible modals
   */
  async handlePossibleModals(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Checking and handling possible modals`);
    
    try {
      // Check if modal exists
      const modal = this.page.locator(this.selectors.modal);
      const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (modalVisible) {
        console.log(`[TaskID: ${this.taskId}] Modal detected, attempting to close`);
        await this.takeScreenshot('modal-detected');
        
        // Try to click close button
        const closeButton = this.page.locator(this.selectors.modalCloseButton);
        if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`[TaskID: ${this.taskId}] Found modal close button, clicking...`);
          await closeButton.click();
          await this.wait(1000);
          return true;
        }
        
        // Try pressing ESC key to close
        console.log(`[TaskID: ${this.taskId}] Attempting to close modal using ESC key`);
        await this.page.keyboard.press('Escape');
        await this.wait(1000);
        
        // Check if modal is closed
        const stillVisible = await modal.isVisible({ timeout: 1000 }).catch(() => false);
        if (!stillVisible) {
          console.log(`[TaskID: ${this.taskId}] Modal successfully closed`);
          return true;
        } else {
          console.log(`[TaskID: ${this.taskId}] Unable to close modal`);
        }
      } else {
        console.log(`[TaskID: ${this.taskId}] No modal detected`);
      }
      
      return false;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error handling modals: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract Gas Fee information - Optimized version based on actual UI structure
   */
  async extractGasFeeInfo(result: BridgeOperationOutput): Promise<void> {
    console.log(`[TaskID: ${this.taskId}] Attempting to get Gas Fee information...`);
    
    try {
      // Use precise class name selectors - match UI structure from screenshot
      const feeItemSelector = 'div._item_13b0h_1';
      const feeTitleSelector = 'div._title_13b0h_11';
      const feeContentSelector = 'div._content_13b0h_15';
      
      // Find all items containing Fee title
      const allItems = await this.page.locator(feeItemSelector).all();
      console.log(`[TaskID: ${this.taskId}] Found ${allItems.length} possible Fee items`);
      
      let feeValue = null;
      
      // Loop through all items, find one with title "Fee"
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const titleElement = item.locator(feeTitleSelector);
        
        // Get title text
        const titleText = await titleElement.textContent();
        
        if (titleText && titleText.trim() === 'Fee') {
          console.log(`[TaskID: ${this.taskId}] Found Fee item`);
          
          // Get content text
          const contentElement = item.locator(feeContentSelector);
          feeValue = await contentElement.textContent();
          
          if (feeValue) {
            feeValue = feeValue.trim();
            console.log(`[TaskID: ${this.taskId}] Successfully got Gas Fee: ${feeValue}`);
            break;
          }
        }
      }
      
      // If fee value found, add to result
      if (feeValue) {
        // Ensure preview object is initialized
        if (!result.preview) {
          result.preview = {};
        }
        
        // Save fee information
        result.preview.gasfee = feeValue;
      } else {
        console.log(`[TaskID: ${this.taskId}] No Gas Fee value found`);
        
        // Try fallback method - use CSS combination selector directly
        try {
          const directFeeSelector = 'div._title_13b0h_11:has-text("Fee") + div._content_13b0h_15';
          const directFeeElement = this.page.locator(directFeeSelector);
          
          if (await directFeeElement.isVisible({ timeout: 2000 })) {
            const directFeeValue = await directFeeElement.textContent();
            if (directFeeValue) {
              console.log(`[TaskID: ${this.taskId}] Got Gas Fee via fallback selector: ${directFeeValue.trim()}`);
              
              // Ensure preview object is initialized
              if (!result.preview) {
                result.preview = {};
              }
              
              // Save fee information
              result.preview.gasfee = directFeeValue.trim();
            }
          }
        } catch (backupError: any) {
          console.log(`[TaskID: ${this.taskId}] Fallback method for getting Gas Fee failed: ${backupError.message}`);
        }
      }
      
      // If above methods fail, try using JavaScript to directly search in page
      if (!result.preview?.gasfee) {
        const jsExtractedFee = await this.page.evaluate(() => {
          // Try multiple ways to find Fee element
          
          // Method 1: Search by class name
          const feeItemByClass = document.querySelector('div._item_13b0h_1');
          if (feeItemByClass) {
            const title = feeItemByClass.querySelector('div._title_13b0h_11');
            const content = feeItemByClass.querySelector('div._content_13b0h_15');
            
            if (title && content && title.textContent?.trim() === 'Fee') {
              return content.textContent?.trim() || null;
            }
          }
          
          // Method 2: Search by text content
          const allTitles = Array.from(document.querySelectorAll('div')).filter(
            div => div.textContent?.trim() === 'Fee'
          );
          
          for (const title of allTitles) {
            // Try to get adjacent content element
            const parent = title.parentElement;
            if (parent) {
              const contentElement = parent.querySelector('div:not(:first-child)');
              if (contentElement) {
                return contentElement.textContent?.trim() || null;
              }
            }
          }
          
          // Method 3: Loop through all divs that might contain Fee information
          const allDivs = document.querySelectorAll('div');
          for (const div of allDivs) {
            if (div.textContent?.includes('INIT') && div.parentElement?.textContent?.includes('Fee')) {
              return div.textContent.trim();
            }
          }
          
          return null;
        });
        
        if (jsExtractedFee) {
          console.log(`[TaskID: ${this.taskId}] Successfully extracted via JavaScript: ${jsExtractedFee}`);
          
          // Ensure preview object is initialized
          if (!result.preview) {
            result.preview = {};
          }
          
          // Save fee information
          result.preview.gasfee = jsExtractedFee;
        } else {
          console.log(`[TaskID: ${this.taskId}] Unable to extract Gas Fee information`);
        }
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error getting Gas Fee: ${error.message}`);
    }
  }
}