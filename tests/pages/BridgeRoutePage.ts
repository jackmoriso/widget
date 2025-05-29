// tests/pages/BridgeRoutePage.ts
import { Page, BrowserContext } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Bridge Route Page Class - Responsible for route preview and submission stages
 */
export class BridgeRoutePage extends BasePage {
  private selectors = {
    // Route preview page elements
    routeDetails: 'div[class*="details"], div[class*="summary"]',
    submitButton: 'button:has-text("Submit")',
    
    // Submission confirmation page elements
    confirmationTitle: 'h2:has-text("Confirmation"), div[class*="title"]:has-text("Confirm")',
    approveButton: 'button:has-text("Approve"), button:has-text("Confirm")',
    
    // Modal elements
    modal: 'div[role="dialog"], div.modal',
    modalCloseButton: 'button:has-text("Close"), button:has-text("关闭"), button.close-button'
  };

  constructor(page: Page, context: BrowserContext) {
    super(page, context);
  }

  /**
   * Verify if on route preview page
   */
  async verifyRoutePreviewPage(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Verifying if on route preview page`);
    
    try {
      await this.wait(2000); // Wait for page to stabilize
      await this.takeScreenshot('route-preview-check');
      
      // Check route details element
      const routeDetails = this.page.locator(this.selectors.routeDetails);
      const detailsVisible = await routeDetails.isVisible({ timeout: 5000 }).catch(() => false);
      
      // Check submit button
      const submitButton = this.page.locator(this.selectors.submitButton);
      const submitVisible = await submitButton.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (detailsVisible && submitVisible) {
        console.log(`[TaskID: ${this.taskId}] Confirmed on route preview page`);
        await this.takeScreenshot('route-preview-page');
        return true;
      } else if (detailsVisible) {
        console.log(`[TaskID: ${this.taskId}] Found route details but submit button not found`);
        return true;
      } else if (submitVisible) {
        console.log(`[TaskID: ${this.taskId}] Found submit button but route details not found`);
        return true;
      } else {
        console.log(`[TaskID: ${this.taskId}] No route preview page elements detected`);
        
        // Try to check current page URL
        const currentUrl = this.page.url();
        if (currentUrl.includes('/preview') || currentUrl.includes('/route')) {
          console.log(`[TaskID: ${this.taskId}] URL indicates preview page: ${currentUrl}`);
          return true;
        }
        
        return false;
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error verifying route preview page: ${error.message}`);
      return false;
    }
  }

  /**
   * Click Submit button - Use precise selector to locate second button
   */
  async clickSubmitButton(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Attempting to click Submit button`);
    
    try {
      // First check and wait for "Fetching messages..." to disappear
      const fetchingMessageSelector = 'div:has-text("Fetching messages...")';
      const fetchingElement = this.page.locator(fetchingMessageSelector);
      
      // Check if "Fetching messages..." is visible
      const isFetchingVisible = await fetchingElement.isVisible({ timeout: 2000 })
        .catch(() => false);
      
      if (isFetchingVisible) {
        console.log(`[TaskID: ${this.taskId}] Detected "Fetching messages...", waiting for it to disappear...`);
        
        // Wait for element to disappear, maximum 30 seconds
        await this.page.waitForSelector(fetchingMessageSelector, { 
          state: 'hidden',
          timeout: 30000 
        }).catch(error => {
          console.log(`[TaskID: ${this.taskId}] Timeout waiting for "Fetching messages..." to disappear: ${error.message}`);
        });
        
        console.log(`[TaskID: ${this.taskId}] "Fetching messages..." has disappeared or timed out`);
        // Wait extra second to ensure UI update
        await this.wait(1000);
      }
      
      // Wait for Submit button to become available
      console.log(`[TaskID: ${this.taskId}] Waiting for Submit button to become available...`);
      
      // Try to use exact locator method from error message to find second Submit button
      let submitButton;
      
      // Method 1: Use class selector - most direct method
      try {
        console.log(`[TaskID: ${this.taskId}] Attempting to locate Submit button using class selector: button._button_1ey5t_1`);
        submitButton = this.page.locator('button._button_1ey5t_1');
        const count = await submitButton.count();
        
        if (count > 0) {
          console.log(`[TaskID: ${this.taskId}] Found ${count} buttons using class selector`);
        } else {
          console.log(`[TaskID: ${this.taskId}] No buttons found using class selector, trying other methods`);
          submitButton = null;
        }
      } catch (e) {
        console.log(`[TaskID: ${this.taskId}] Failed to search using class selector: ${e}`);
        submitButton = null;
      }
      
      // Method 2: Use role selector - if method 1 fails
      if (!submitButton) {
        try {
          console.log(`[TaskID: ${this.taskId}] Attempting to locate Submit button using role selector`);
          submitButton = this.page.getByRole('contentinfo').getByRole('button', { name: 'Submit' });
          const count = await submitButton.count();
          
          if (count > 0) {
            console.log(`[TaskID: ${this.taskId}] Found ${count} buttons using role selector`);
          } else {
            console.log(`[TaskID: ${this.taskId}] No buttons found using role selector, trying other methods`);
            submitButton = null;
          }
        } catch (e) {
          console.log(`[TaskID: ${this.taskId}] Failed to search using role selector: ${e}`);
          submitButton = null;
        }
      }
      
      // If both precise methods fail, try fallback methods
      if (!submitButton) {
        console.log(`[TaskID: ${this.taskId}] Precise selectors failed to find button, trying fallback methods`);
        
        // Fallback selector list
        const fallbackSelectors = [
          'button._button_1ey5t_1:has-text("Submit")',       // Combine class and text
          'button:has-text("Submit")',                       // Generic text selector
          'form button:has-text("Submit")',                  // Button in form
          'button[type="submit"]'                            // Submit type button
        ];
        
        for (const selector of fallbackSelectors) {
          try {
            const locator = this.page.locator(selector);
            const count = await locator.count();
            
            if (count > 0) {
              console.log(`[TaskID: ${this.taskId}] Found ${count} buttons using fallback selector "${selector}"`);
              submitButton = locator;
              break;
            }
          } catch (e) {
            console.log(`[TaskID: ${this.taskId}] Fallback selector "${selector}" search failed: ${e}`);
          }
        }
      }
      
      // If Submit button found, click it
      if (submitButton) {
        // Check if button is visible and enabled
        const isVisible = await submitButton.isVisible({ timeout: 5000 })
          .catch(() => false);
        
        if (isVisible) {
          // Check if button is enabled
          const isEnabled = await submitButton.isEnabled().catch(() => true);
          if (!isEnabled) {
            console.log(`[TaskID: ${this.taskId}] Submit button is disabled, attempting to resolve potential issues...`);
            
            // Try clicking elsewhere on page to trigger possible form validation
            await this.page.mouse.click(50, 50);
            await this.wait(1000);
          }
          
          await this.takeScreenshot('before-submit-click');
          
          // Try to click even if button might be disabled
          await submitButton.click({ force: true });
          
          // Wait for page change
          await this.wait(2000);
          await this.waitForPageLoad();
          
          await this.takeScreenshot('after-submit-click');
          console.log(`[TaskID: ${this.taskId}] Clicked Submit button`);
          return true;
        } else {
          console.log(`[TaskID: ${this.taskId}] Found Submit button but it's not visible`);
        }
      }
      
      // If above methods all fail, try using JavaScript to directly find and click button with specific class
      console.log(`[TaskID: ${this.taskId}] Attempting to find and click Submit button using JavaScript...`);
      const clicked = await this.page.evaluate(() => {
        // First try to find button with specific class name
        let buttons = Array.from(document.querySelectorAll('button._button_1ey5t_1'))
          .filter(btn => btn.textContent && btn.textContent.trim() === 'Submit');
        
        if (buttons.length === 0) {
          // If not found, try to find any button with Submit text
          buttons = Array.from(document.querySelectorAll('button'))
            .filter(btn => btn.textContent && btn.textContent.trim() === 'Submit');
        }
        
        if (buttons.length > 0) {
          // Click found button
          (buttons[0] as HTMLButtonElement).click();
          console.log(`Found and clicked Submit button`);
          return true;
        }
        
        return false;
      });
      
      if (clicked) {
        console.log(`[TaskID: ${this.taskId}] Successfully clicked Submit button via JavaScript`);
        await this.wait(2000);
        await this.waitForPageLoad();
        await this.takeScreenshot('after-js-submit-click');
        return true;
      }
      
      // Try to find possible "Continue", "Next" or similar buttons
      console.log(`[TaskID: ${this.taskId}] Submit button not found, trying alternative buttons...`);
      const alternativeButtons = [
        this.page.locator('button:has-text("Continue")').first(),
        this.page.locator('button:has-text("Next")').first(),
        this.page.locator('button:has-text("Confirm")').first(),
        this.page.locator('button:has-text("Process")').first()
      ];
      
      for (const button of alternativeButtons) {
        try {
          if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log(`[TaskID: ${this.taskId}] Found alternative button, clicking...`);
            await this.takeScreenshot('before-alternative-button-click');
            await button.click();
            await this.wait(2000);
            await this.takeScreenshot('after-alternative-button-click');
            return true;
          }
        } catch (e) {
          // Continue trying next alternative button
        }
      }
      
      console.log(`[TaskID: ${this.taskId}] No Submit button or alternative buttons found`);
      return false;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error clicking Submit button: ${error.message}`);
      return false;
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
}