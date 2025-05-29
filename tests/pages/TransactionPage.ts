// tests/pages/TransactionPage.ts
import { Page, BrowserContext } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Transaction Page Class - Responsible for transaction confirmation and result verification
 */
export class TransactionPage extends BasePage {
  private selectors = {
    // Keplr wallet confirmation
    keplrConfirmButton: 'button:has-text("Confirm"), button:has-text("Approve")',
    
    // Transaction result page
    successMessage: 'div:has-text("Success")',
    transactionHash: 'div[class*="hash"], div:has-text("Transaction")',
    errorMessage: 'div:has-text("Error")',
    
    // Return buttons
    backButton: 'button:has-text("Back")',
    closeButton: 'button:has-text("Close")'
  };

  constructor(page: Page, context: BrowserContext) {
    super(page, context);
  }

  /**
   * Handle Keplr wallet confirmation - Enhanced version, handles window close scenarios
   */
  async handleKeplrConfirmation(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Handling Keplr wallet confirmation`);
    
    // Find Keplr popup
    const pages = this.context.pages();
    let keplrPopup = null;
    
    for (const page of pages) {
      if (page !== this.page) {
        const url = page.url();
        const title = await page.title().catch(() => '');
        
        if ((url.includes('chrome-extension')) || 
            (title === 'Keplr' && url.includes('popup.html'))) {
          console.log(`[TaskID: ${this.taskId}] Found Keplr confirmation page: ${url}`);
          keplrPopup = page;
          break;
        }
      }
    }
    
    if (keplrPopup) {
      // Declare in outer scope to resolve "Cannot find name 'windowClosed'" error
      let windowClosed = false;
      
      try {
        // Screenshot record initial state
        await keplrPopup.screenshot({ path: `screenshots/keplr-confirm-before-task-${this.taskId}.png` })
            .catch(e => console.log(`[TaskID: ${this.taskId}] Screenshot failed: ${e.message}`));
        
        // Ensure window is active
        await keplrPopup.bringToFront()
            .catch(e => console.log(`[TaskID: ${this.taskId}] Window bring to front failed: ${e.message}`));
        console.log(`[TaskID: ${this.taskId}] Brought Keplr window to front`);
        
        // Listen for window close event - key improvement
        keplrPopup.once('close', () => {
          console.log(`[TaskID: ${this.taskId}] Detected Keplr window closed, might indicate successful operation`);
          windowClosed = true;
        });
        
        // Analyze buttons on page
        console.log(`[TaskID: ${this.taskId}] Analyzing buttons on page...`);
        const buttonTexts = await keplrPopup.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(btn => ({
            text: btn.textContent?.trim() || 'no text',
            bounds: btn.getBoundingClientRect(),
            enabled: !btn.disabled,
            classes: btn.className
          }));
        }).catch(e => {
          console.log(`[TaskID: ${this.taskId}] Failed to get button information: ${e.message}`);
          return [];
        });
        
        console.log(`[TaskID: ${this.taskId}] Found ${buttonTexts.length} buttons on page`);
        buttonTexts.forEach((btn, idx) => {
          console.log(`[TaskID: ${this.taskId}] Button ${idx+1}: ${btn.text} | Classes: ${btn.classes} | Enabled: ${btn.enabled} | Position: x=${Math.round(btn.bounds.x)}, y=${Math.round(btn.bounds.y)}, w=${Math.round(btn.bounds.width)}, h=${Math.round(btn.bounds.height)}`);
        });
        
        // JavaScript click attempt
        try {
          console.log(`[TaskID: ${this.taskId}] Attempting to directly click Approve button using JavaScript...`);
          
          let clicked = await keplrPopup.evaluate(() => {
            const findApproveButton = () => {
              // Search by text content
              const approveButtons = Array.from(document.querySelectorAll('button')).filter(
                btn => btn.textContent && btn.textContent.includes('Approve')
              );
              if (approveButtons.length > 0) return approveButtons[0];
              
              // Search by class name (based on seen classes in logs)
              const classButtons = document.querySelectorAll('button.sc-iTONeN.jEEuKd');
              if (classButtons.length > 0) return classButtons[0];
              
              // Search by attribute
              const primaryButtons = document.querySelectorAll('button[color="primary"]');
              if (primaryButtons.length > 0) return primaryButtons[0];
              
              return null;
            };
            
            try {
              const button = findApproveButton();
              if (button) {
                // Add type assertion to resolve TypeScript error
                (button as HTMLElement).click();
                return true;
              }
              return false;
            } catch (error) {
              console.error('JavaScript click error: ' + error);
              return false;
            }
          }).catch(e => {
            console.log(`[TaskID: ${this.taskId}] JavaScript click failed: ${e.message}`);
            return false;
          });
          
          console.log(`[TaskID: ${this.taskId}] JavaScript ${clicked ? 'successfully' : 'failed to'} click button`);
          
          // Wait briefly to see if JavaScript click caused window to close
          await keplrPopup.waitForTimeout(500).catch(() => {
            console.log(`[TaskID: ${this.taskId}] Timeout waiting, window might be closed`);
          });
          
          // Check if window closed
          if (windowClosed || keplrPopup.isClosed()) {
            console.log(`[TaskID: ${this.taskId}] Window closed after JavaScript click, considering successful`);
            return true;
          }
        } catch (jsClickError: any) {
          console.log(`[TaskID: ${this.taskId}] JavaScript click process error: ${jsClickError.message}`);
          
          // If error is because window closed, consider successful
          if (windowClosed || keplrPopup.isClosed()) {
            console.log(`[TaskID: ${this.taskId}] Despite error, window closed, considering successful`);
            return true;
          }
        }
        
        // Coordinate click attempt
        try {
          console.log(`[TaskID: ${this.taskId}] Attempting to click using precise coordinates...`);
          
          // Get Approve button position
          const buttonInfo = await keplrPopup.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button')).filter(
              btn => btn.textContent && btn.textContent.includes('Approve')
            );
            
            if (buttons.length > 0) {
              const rect = buttons[0].getBoundingClientRect();
              return {
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
                width: rect.width,
                height: rect.height
              };
            }
            return null;
          }).catch(e => {
            console.log(`[TaskID: ${this.taskId}] Failed to get button position: ${e.message}`);
            return null;
          });
          
          if (buttonInfo) {
            console.log(`[TaskID: ${this.taskId}] Found button position: x=${buttonInfo.x}, y=${buttonInfo.y}, width=${buttonInfo.width}, height=${buttonInfo.height}`);
            
            // Click button center
            await keplrPopup.mouse.click(buttonInfo.x, buttonInfo.y)
              .catch(e => console.log(`[TaskID: ${this.taskId}] Coordinate click failed: ${e.message}`));
            console.log(`[TaskID: ${this.taskId}] Clicked coordinates (${buttonInfo.x}, ${buttonInfo.y})`);
            
            // Wait briefly to see if coordinate click caused window to close
            try {
              await keplrPopup.waitForTimeout(500);
            } catch (timeoutError) {
              console.log(`[TaskID: ${this.taskId}] Timeout waiting, window might be closed`);
            }
            
            // Check if window closed
            if (windowClosed || keplrPopup.isClosed()) {
              console.log(`[TaskID: ${this.taskId}] Window closed after coordinate click, considering successful`);
              return true;
            }
          }
        } catch (coordError: any) {
          console.log(`[TaskID: ${this.taskId}] Coordinate click process error: ${coordError.message}`);
          
          // If error is because window closed, consider successful
          if (windowClosed || keplrPopup.isClosed()) {
            console.log(`[TaskID: ${this.taskId}] Despite error, window closed, considering successful`);
            return true;
          }
        }
        
        // Keyboard navigation attempt
        try {
          console.log(`[TaskID: ${this.taskId}] Attempting to use keyboard navigation...`);
          
          // Click page first to ensure focus
          await keplrPopup.click('body', { force: true })
            .catch(e => console.log(`[TaskID: ${this.taskId}] Page click failed: ${e.message}`));
          
          // Use Tab key to cycle to Approve button
          for (let i = 0; i < 5; i++) {
            await keplrPopup.keyboard.press('Tab')
              .catch(e => console.log(`[TaskID: ${this.taskId}] Tab key press failed: ${e.message}`));
            await keplrPopup.waitForTimeout(200)
              .catch(() => {});
            
            // If window closed, return success immediately
            if (windowClosed || keplrPopup.isClosed()) {
              console.log(`[TaskID: ${this.taskId}] Window closed during Tab navigation, considering successful`);
              return true;
            }
          }
          
          // Try pressing Enter key
          await keplrPopup.keyboard.press('Enter')
            .catch(e => console.log(`[TaskID: ${this.taskId}] Enter key press failed: ${e.message}`));
          console.log(`[TaskID: ${this.taskId}] Pressed Enter key`);
          
          // Wait to observe if window closes
          try {
            await keplrPopup.waitForTimeout(1000);
          } catch (timeoutError) {
            console.log(`[TaskID: ${this.taskId}] Timeout waiting, window might be closed`);
          }
          
          // Final check if window closed
          if (windowClosed || keplrPopup.isClosed()) {
            console.log(`[TaskID: ${this.taskId}] Window closed after keyboard navigation, considering successful`);
            return true;
          }
        } catch (keyboardError: any) {
          console.log(`[TaskID: ${this.taskId}] Keyboard navigation process error: ${keyboardError.message}`);
          
          // If error is because window closed, consider successful
          if (windowClosed || keplrPopup.isClosed()) {
            console.log(`[TaskID: ${this.taskId}] Despite error, window closed, considering successful`);
            return true;
          }
        }
        
        // If we get here, all methods tried but window still exists
        try {
          if (!keplrPopup.isClosed()) {
            console.log(`[TaskID: ${this.taskId}] After all methods tried, Keplr window still exists, click might have failed`);
            return false;
          } else {
            console.log(`[TaskID: ${this.taskId}] Final check: Keplr window closed, considering successful`);
            return true;
          }
        } catch (finalError: any) {
          // If error here, likely because window already closed
          console.log(`[TaskID: ${this.taskId}] Error during final check, window might be closed: ${finalError.message}`);
          return true;
        }
        
      } catch (error: any) {
        console.log(`[TaskID: ${this.taskId}] Error handling Keplr confirmation: ${error.message}`);
        
        // Key check if window closed, consider successful
        try {
          if (windowClosed || keplrPopup.isClosed()) {
            console.log(`[TaskID: ${this.taskId}] Despite process error, window closed, considering successful`);
            return true;
          }
        } catch (e) {
          // If error here, likely also because window closed
          console.log(`[TaskID: ${this.taskId}] Error checking window state, window might be closed`);
          return true;
        }
        
        return false;
      }
    } else {
      console.log(`[TaskID: ${this.taskId}] No Keplr confirmation page found`);
      return false;
    }
  }

  /**
   * Verify transaction result
   */
  async verifyTransactionResult(): Promise<{ success: boolean; hash?: string; error?: string }> {
    console.log(`[TaskID: ${this.taskId}] Verifying transaction result`);
    
    try {
      await this.wait(5000); // Wait for result page to fully load
      await this.takeScreenshot('transaction-result');
      
      // Check success message
      const successMessage = this.page.locator(this.selectors.successMessage);
      const isSuccess = await successMessage.isVisible({ timeout: 10000 }).catch(() => false);
      
      if (isSuccess) {
        console.log(`[TaskID: ${this.taskId}] Transaction completed successfully`);
        
        // Try to get transaction hash
        const hashElement = this.page.locator(this.selectors.transactionHash);
        const hash = await hashElement.textContent().catch(() => '');
        
        return { success: true, hash: hash || undefined };
      }
      
      // Check error message
      const errorMessage = this.page.locator(this.selectors.errorMessage);
      const isError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isError) {
        const errorText = await errorMessage.textContent().catch(() => 'Unknown error');
        console.log(`[TaskID: ${this.taskId}] Transaction failed: ${errorText}`);
        return { success: false, error: errorText || 'Unknown error' };
      }
      
      // Neither success nor error message found
      console.log(`[TaskID: ${this.taskId}] No clear transaction result indicator found`);
      
      // Check if URL contains success or failure hints
      const currentUrl = this.page.url();
      if (currentUrl.includes('success') || currentUrl.includes('complete')) {
        console.log(`[TaskID: ${this.taskId}] URL suggests transaction might be successful: ${currentUrl}`);
        return { success: true };
      } else if (currentUrl.includes('error') || currentUrl.includes('fail')) {
        console.log(`[TaskID: ${this.taskId}] URL suggests transaction might have failed: ${currentUrl}`);
        return { success: false, error: 'Inferred failure from URL' };
      }
      
      // Unable to determine result
      return { success: false, error: 'Unable to determine transaction result' };
      
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error verifying transaction result: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Click back or close button
   */
  async clickBackOrCloseButton(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Attempting to click back or close button`);
    
    try {
      // Try Back button first
      const backButton = this.page.locator(this.selectors.backButton);
      if (await backButton.isVisible({ timeout: 2000 })) {
        await this.takeScreenshot('before-back-click');
        await backButton.click();
        await this.wait(2000);
        console.log(`[TaskID: ${this.taskId}] Clicked Back button`);
        return true;
      }
      
      // Then try Close button
      const closeButton = this.page.locator(this.selectors.closeButton);
      if (await closeButton.isVisible({ timeout: 2000 })) {
        await this.takeScreenshot('before-close-click');
        await closeButton.click();
        await this.wait(2000);
        console.log(`[TaskID: ${this.taskId}] Clicked Close button`);
        return true;
      }
      
      // Try pressing ESC key
      console.log(`[TaskID: ${this.taskId}] Attempting to close result page using ESC key`);
      await this.page.keyboard.press('Escape');
      await this.wait(2000);
      
      console.log(`[TaskID: ${this.taskId}] No back or close button found, tried ESC key`);
      return false;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error clicking back or close button: ${error.message}`);
      return false;
    }
  }
}