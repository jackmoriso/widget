// tests/pages/BridgeFormPage.ts
import { Page, BrowserContext } from '@playwright/test';
import { BasePage } from './BasePage';
import { BridgeOperationOutput } from './BridgeInterfaces';

/**
 * Bridge Form Page Class - Responsible for handling Bridge form inputs
 */
export class BridgeFormPage extends BasePage {
  private selectors = {
    // Bridge/Swap form selectors
    formButtons: 'button._root_1luwi_1, button:has(img), form button:has(div:has-text("USDC")), form button:has(div:has-text("INIT"))',
    fromToButton: 'button._root_1luwi_1',  // Precise class match for FROM/TO selection button
    selectElement: 'div._select_19cly_14', // Selection element container
    fieldsetElement: 'div._fieldset_19cly_1', // Fieldset element
    arrowElement: 'div._arrow_1kjze_5', // Arrow element
    
    // Input fields
    amountInput: 'input[inputmode="decimal"]',
    maxButton: 'button:has-text("MAX")',
    
    // Operation buttons
    previewRouteButton: 'button:has-text("Preview Route")',
    
    // Token selector
    tokenListItem: 'div[role="listitem"], div.token-item, button[class*="_item_"]',
    tokenBySymbol: (symbol: string) => `div:has-text("${symbol}"):has(img), button:has-text("${symbol}"):has(img)`,
    tokenByImage: (symbol: string) => `img[src*="/images/${symbol}.png"]`,
    
    // Chain selector
    chainButton: 'button[class*="_item_"]:has(img[src*="/images/"])',
    chainByName: (name: string) => `button[class*="_item_"]:has(img[src*="/images/${name}/chain.png"])`,
    chainImage: (name: string) => `img[src*="/images/${name}/chain.png"]`,
    
    // Route type selection
    routeTypeButton: 'button:has-text("Route Type"), button:has-text("路由类型")',
    routeTypeOption: (type: string) => `button:has-text("${type}")`,
    
    // Output and information selectors
    outputAmount: 'p._input_v9z30_1, p[class*="_input_"]',
    errorMessage: 'div._help_n8r7b_1._error_n8r7b_24, div._error_8hdzq_24, div[class*="_help_"][class*="_error_"]',
    warningMessage: 'div._help_n8r7b_1._warning_n8r7b_20, div._warning_8hdzq_19, div[class*="_help_"][class*="_warning_"]',
    estimatedDuration: 'div._row_1kjze_45:has(span:has-text("Estimated route duration"))',
    slippage: 'span._description_1kjze_55:has(button._edit_1kjze_61), span._description_1kjze_55:has(button[class*="_edit_"])'
  };

  constructor(page: Page, context: BrowserContext) {
    super(page, context);
  }

  /**
   * Click FROM or TO selection button - Direct string parameter version
   * @param buttonType 'from' indicates click FROM button, 'to' indicates click TO button
   */
  async clickSelectButton(buttonType: 'from' | 'to'): Promise<void> {
    const buttonTypeUpper = buttonType.toUpperCase();
    
    console.log(`[TaskID: ${this.taskId}]\n===== Attempting to click ${buttonTypeUpper} selection button =====`);
    
    // Use string concatenation instead of template string
    await this.takeScreenshot("before-" + buttonType + "-button-search");
    
    // Use more precise selector, specifically matching buttons with particular class name
    try {
      // Use new selector to locate FROM and TO buttons - based on class name and order
      const formButtons = this.page.locator('button._root_1luwi_1');
      const count = await formButtons.count();

      console.log(`[TaskID: ${this.taskId}] Found ${count} matching buttons`);
      
      if (count >= 2) {
        console.log(`[TaskID: ${this.taskId}] Found ${count} matching buttons`);
        
        // FROM is first button, TO is second button
        const buttonIndex = buttonType === 'from' ? 0 : 1;
        const button = formButtons.nth(buttonIndex);
        const isVisible = await button.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (isVisible) {
          console.log(`[TaskID: ${this.taskId}] Found visible ${buttonTypeUpper} button, clicking...`);
          
          // Use string concatenation
          await this.takeScreenshot("before-" + buttonType + "-click");
          
          await button.click();
          await this.wait(1000);
          
          // Use string concatenation
          await this.takeScreenshot("after-" + buttonType + "-click");
          
          console.log(`[TaskID: ${this.taskId}] Clicked ${buttonTypeUpper} button`);
          console.log(`[TaskID: ${this.taskId}] ===== ${buttonTypeUpper} selection button click operation ended =====\n`);
          return;
        } else {
          console.log(`[TaskID: ${this.taskId}] ${buttonTypeUpper} button not visible, trying other methods`);
        }
      } else {
        console.log(`[TaskID: ${this.taskId}] Not enough ._root_1luwi_1 buttons found, trying other methods`);
      }
      
      // Targeted attempt to find by specific text/attributes
      const textHint = buttonType === 'from' ? "USDC" : "INIT"; // Most interfaces default FROM to USDC, TO to INIT
      const selector = `button:has(div:has-text("${textHint}"))`;
      console.log(`[TaskID: ${this.taskId}] Attempting to find button via text "${textHint}"`);
      
      const textButton = this.page.locator(selector);
      if (await textButton.count() > 0 && await textButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[TaskID: ${this.taskId}] Found ${buttonTypeUpper} button via text, clicking...`);
        
        // Use string concatenation
        await this.takeScreenshot("before-" + buttonType + "-text-click");
        
        await textButton.click();
        await this.wait(1000);
        
        // Use string concatenation
        await this.takeScreenshot("after-" + buttonType + "-text-click");
        
        console.log(`[TaskID: ${this.taskId}] Clicked ${buttonTypeUpper} button`);
        console.log(`[TaskID: ${this.taskId}] ===== ${buttonTypeUpper} selection button click operation ended =====\n`);
        return;
      }
      
      // Use JavaScript method to try to find and click
      console.log(`[TaskID: ${this.taskId}] Attempting to find and click ${buttonTypeUpper} button via JavaScript...`);
      
      const clicked = await this.page.evaluate(
        ([type, textToFind]) => {
          // Get all buttons
          const allButtons = Array.from(document.querySelectorAll('button'));
          
          // First try to find by form position
          const formElement = document.querySelector('form');
          if (formElement) {
            const formButtons = Array.from(formElement.querySelectorAll('button'));
            if (formButtons.length >= 2) {
              const buttonIndex = type === 'from' ? 0 : 1;
              if (buttonIndex < formButtons.length) {
                (formButtons[buttonIndex] as HTMLButtonElement).click();
                return true;
              }
            }
          }
          
          // Then try to find by text content
          const textMatches = allButtons.filter(btn => {
            const text = btn.textContent || '';
            const hasImg = btn.querySelector('img') !== null;
            return text.includes(textToFind) && hasImg;
          });
          
          if (textMatches.length > 0) {
            (textMatches[0] as HTMLButtonElement).click();
            return true;
          }
          
          // Finally try to find buttons with specific class
          const classButtons = document.querySelectorAll('button._root_1luwi_1');
          if (classButtons.length >= 2) {
            const buttonIndex = type === 'from' ? 0 : 1;
            if (buttonIndex < classButtons.length) {
              (classButtons[buttonIndex] as HTMLButtonElement).click();
              return true;
            }
          }
          
          return false;
        }, 
        [buttonType, textHint]
      );
      
      if (clicked) {
        console.log(`[TaskID: ${this.taskId}] Successfully clicked ${buttonTypeUpper} button via JavaScript`);
        await this.wait(1000);
        
        // Use string concatenation
        await this.takeScreenshot("after-" + buttonType + "-js-click");
        
        console.log(`[TaskID: ${this.taskId}] ===== ${buttonTypeUpper} selection button click operation ended =====\n`);
        return;
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error clicking ${buttonTypeUpper} button: ${error.message}`);
    }
    
    console.log(`[TaskID: ${this.taskId}] Unable to find or click ${buttonTypeUpper} selection button`);
    console.log(`[TaskID: ${this.taskId}] ===== ${buttonTypeUpper} selection button click operation ended =====\n`);
  }
  /**
   * Click FROM selection button - Keep original method name for compatibility
   */
  async clickFromSelectButton(): Promise<void> {
    await this.clickSelectButton('from');
  }

  /**
   * Click TO selection button - Keep original method name for compatibility
   */
  async clickToSelectButton(): Promise<void> {
    await this.clickSelectButton('to');
  }

  /**
   * Select Chain
   * @param chainName Chain name (e.g., "BFB")
   */
  async selectChain(chainName: string): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}]\n===== Attempting to select Chain: ${chainName} =====`);
    const screenName = "before-select-chain-" + chainName;
    await this.takeScreenshot(screenName);
    
    try {
      // Only use specific class selector
      const chainClassSelector = `img._circle_80nya_5[src*="/images/${chainName}"]`;
      const chainClassElement = this.page.locator(chainClassSelector);
      
      const count = await chainClassElement.count();
      if (count > 0) {
        console.log(`[TaskID: ${this.taskId}] Found Chain: ${chainName} (${count} matches)`);
        
        // Try to click first visible element
        for (let i = 0; i < count; i++) {
          const item = chainClassElement.nth(i);
          const isVisible = await item.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (isVisible) {
            // Try to click parent element (button)
            const parentButton = item.locator('xpath=ancestor::button');
            
            if (await parentButton.count() > 0 && await parentButton.isVisible().catch(() => false)) {
              console.log(`[TaskID: ${this.taskId}] Clicking parent button of Chain icon: ${chainName}`);
              await parentButton.click();
            } else {
              // If can't find parent button, click image directly
              console.log(`[TaskID: ${this.taskId}] Clicking Chain icon directly: ${chainName}`);
              await item.click();
            }
            
            await this.wait(1000);
            const afterScreenName = "after-select-chain-" + chainName;
            await this.takeScreenshot(afterScreenName);
            console.log(`[TaskID: ${this.taskId}] Selected Chain: ${chainName}`);
            return true;
          }
        }
        
        console.log(`[TaskID: ${this.taskId}] Found Chain element but not visible: ${chainName}`);
      } else {
        console.log(`[TaskID: ${this.taskId}] No Chain element found: ${chainName}`);
      }
      
      return false;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error selecting Chain: ${error.message}`);
      return false;
    } finally {
      console.log(`[TaskID: ${this.taskId}] ===== Chain selection operation ended =====\n`);
    }
  }

  /**
   * Select Token
   * @param tokenSymbol Token symbol (e.g., "milkTIA")
   */
  async selectToken(tokenSymbol: string): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}]\n===== Attempting to select token: ${tokenSymbol} =====`);
    const screenName = "before-select-token-" + tokenSymbol;
    await this.takeScreenshot(screenName);
    
    try {
      // Only use specific class selector
      const tokenClassSelector = `img._logo_tqxo1_29[src*="/images/${tokenSymbol}"]`;
      const tokenElement = this.page.locator(tokenClassSelector);
      
      const count = await tokenElement.count();
      if (count > 0) {
        console.log(`[TaskID: ${this.taskId}] Found Token: ${tokenSymbol} (${count} matches)`);
        
        // Try to click first visible element
        for (let i = 0; i < count; i++) {
          const item = tokenElement.nth(i);
          const isVisible = await item.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (isVisible) {
            // Try to click parent element (button)
            const parentButton = item.locator('xpath=ancestor::button');
            
            if (await parentButton.count() > 0 && await parentButton.isVisible().catch(() => false)) {
              console.log(`[TaskID: ${this.taskId}] Clicking parent button of Token icon: ${tokenSymbol}`);
              await parentButton.click();
            } else {
              // If can't find parent button, click image directly
              console.log(`[TaskID: ${this.taskId}] Clicking Token icon directly: ${tokenSymbol}`);
              await item.click();
            }
            
            await this.wait(1000);
            const afterScreenName = "after-select-token-" + tokenSymbol;
            await this.takeScreenshot(afterScreenName);
            console.log(`[TaskID: ${this.taskId}] Selected Token: ${tokenSymbol}`);
            return true;
          }
        }
        
        console.log(`[TaskID: ${this.taskId}] Found Token element but not visible: ${tokenSymbol}`);
      } else {
        console.log(`[TaskID: ${this.taskId}] No Token element found: ${tokenSymbol}`);
      }
      
      return false;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error selecting Token: ${error.message}`);
      return false;
    } finally {
      console.log(`[TaskID: ${this.taskId}] ===== Token selection operation ended =====\n`);
    }
  }
  /**
   * Wait for Token list loading
   * @returns Whether successfully detected list has loaded
   */
  async waitForTokenListLoading(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Waiting for Token list to load...`);
    
    // 1. Wait a short time first to allow UI to start loading
    await this.wait(1000);
    
    // 2. Check if there's a loading indicator
    const loadingIndicators = [
      'div[class*="loading"], div[class*="spinner"]',
      'div:has(svg[class*="spinner"])',
      'div:has-text("Loading...")',
      'div:has-text("加载中")'
    ];
    
    let isLoading = false;
    for (const indicator of loadingIndicators) {
      const loadingElement = this.page.locator(indicator);
      if (await loadingElement.count() > 0 && await loadingElement.isVisible().catch(() => false)) {
        console.log(`[TaskID: ${this.taskId}] Detected loading indicator: ${indicator}`);
        isLoading = true;
        
        // Wait for loading indicator to disappear, maximum 10 seconds
        try {
          await this.page.waitForSelector(indicator, { state: 'hidden', timeout: 10000 });
          console.log(`[TaskID: ${this.taskId}] Loading indicator has disappeared`);
        } catch (error) {
          console.log(`[TaskID: ${this.taskId}] Timeout waiting for loading indicator to disappear, continuing execution`);
        }
        
        // Wait extra 500ms to ensure UI fully updated
        await this.wait(500);
        break;
      }
    }
    
    // If no obvious loading indicator, check if token list items have appeared
    if (!isLoading) {
      console.log(`[TaskID: ${this.taskId}] No obvious loading indicator detected, waiting for token list items to appear...`);
      
      // Wait for list items to appear, maximum 10 seconds
      const tokenItemSelector = 'button[class*="_item_"]';
      try {
        await this.page.waitForSelector(tokenItemSelector, { state: 'visible', timeout: 10000 });
        console.log(`[TaskID: ${this.taskId}] Detected token list items have appeared`);
        
        // Wait extra 300ms to ensure list fully rendered
        await this.wait(300);
        return true;
      } catch (error) {
        console.log(`[TaskID: ${this.taskId}] Timeout waiting for token list items to appear, continuing execution`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Complete Chain and Token selection flow
   * @param chainName Chain name
   * @param tokenSymbol Token symbol
   * @returns Whether selection completed
   */
  async selectChainAndToken(chainName: string, tokenSymbol: string): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}]\n===== Starting complete Chain and Token selection flow =====`);
    
    // Select Chain
    const chainSelected = await this.selectChain(chainName);
    
    if (!chainSelected) {
      console.log(`[TaskID: ${this.taskId}] Unable to select Chain: ${chainName}, but will attempt to select token`);
    }
    
    // Wait for Token list to load
    await this.waitForTokenListLoading();   

    // Select Token
    const tokenSelected = await this.selectToken(tokenSymbol);
    
    if (!tokenSelected) {
      console.log(`[TaskID: ${this.taskId}] Unable to select Token: ${tokenSymbol}`);
    }
    
    console.log(`[TaskID: ${this.taskId}] ===== Chain and Token selection flow ended =====`);
    
    // Only return true when both selections successful
    return chainSelected && tokenSelected;
  }

  /**
   * Enter transfer amount
   * @param amount Transfer amount
   * @returns Whether successfully entered
   */
  async enterAmount(amount: string): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}]\n===== Attempting to enter amount: ${amount} =====`);
    
    try {
      // Find amount input field
      const amountInput = this.page.locator(this.selectors.amountInput);
      const isVisible = await amountInput.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isVisible) {
        // Click first to get focus
        await amountInput.click();
        
        // Clear existing content (can use CTRL+A and delete)
        await this.page.keyboard.press('Control+a');
        await this.page.keyboard.press('Backspace');
        
        // Directly fill amount
        await amountInput.fill(amount);
        
        // Wait a moment to let page process input
        await this.wait(1000);
        
        // Record screenshot
        const screenName = "after-amount-input-" + amount;
        await this.takeScreenshot(screenName);
        
        console.log(`[TaskID: ${this.taskId}] Entered amount: ${amount}`);
        console.log(`[TaskID: ${this.taskId}] ===== Amount input operation ended =====\n`);
        return true;
      } else {
        console.log(`[TaskID: ${this.taskId}] Amount input field not found`);
        console.log(`[TaskID: ${this.taskId}] ===== Amount input operation ended =====\n`);
        return false;
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error entering amount: ${error.message}`);
      console.log(`[TaskID: ${this.taskId}] ===== Amount input operation ended =====\n`);
      return false;
    }
  }

  /**
   * Select route type - Simplified version, only handles Optimistic bridge case
   * @param routeType Route type, such as "Minitswap" or "Optimistic bridge"
   * @returns Whether successfully selected
   */
  async selectRouteType(routeType: string): Promise<boolean> {
    // If no route type provided or not Optimistic bridge, return true directly
    if (!routeType || routeType !== "Optimistic bridge") {
      console.log(`[TaskID: ${this.taskId}] Route type is not Optimistic bridge, using default selection`);
      return true;
    }
    
    console.log(`[TaskID: ${this.taskId}]\n===== Attempting to select route type: Optimistic bridge =====`);
    
    try {
      // Define Optimistic bridge selector
      const optimisticBridgeSelector = `button:has(div:has-text("Optimistic bridge"))`;
      
      // Try to find and click Optimistic bridge option directly
      const bridgeOption = this.page.locator(optimisticBridgeSelector);
      const isOptionVisible = await bridgeOption.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isOptionVisible) {
        console.log(`[TaskID: ${this.taskId}] Found Optimistic bridge option, clicking...`);
        await this.takeScreenshot('before-select-optimistic-bridge');
        await bridgeOption.click();
        await this.wait(1000);
        await this.takeScreenshot('after-select-optimistic-bridge');
        console.log(`[TaskID: ${this.taskId}] Selected Optimistic bridge`);
        console.log(`[TaskID: ${this.taskId}] ===== Route type selection operation ended =====\n`);
        return true;
      }
      
      // If direct click fails, try clicking route type button first
      const routeTypeButton = this.page.locator(this.selectors.routeTypeButton);
      const isButtonVisible = await routeTypeButton.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isButtonVisible) {
        // Click route type button to open options
        console.log(`[TaskID: ${this.taskId}] Found route type button, clicking...`);
        await routeTypeButton.click();
        await this.wait(1000);
        
        // Try to select Optimistic bridge again
        const isOptionVisibleAfterClick = await bridgeOption.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (isOptionVisibleAfterClick) {
          console.log(`[TaskID: ${this.taskId}] Found Optimistic bridge option, clicking...`);
          await bridgeOption.click();
          await this.wait(1000);
          console.log(`[TaskID: ${this.taskId}] Selected Optimistic bridge`);
          console.log(`[TaskID: ${this.taskId}] ===== Route type selection operation ended =====\n`);
          return true;
        } else {
          console.log(`[TaskID: ${this.taskId}] Optimistic bridge option not found`);
          
          // Close selector
          await this.page.keyboard.press('Escape');
          console.log(`[TaskID: ${this.taskId}] ===== Route type selection operation ended =====\n`);
          return false;
        }
      }
      
      // If route type button not found
      console.log(`[TaskID: ${this.taskId}] Route type button or Optimistic bridge option not found`);
      console.log(`[TaskID: ${this.taskId}] ===== Route type selection operation ended =====\n`);
      return false;
      
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error selecting Optimistic bridge: ${error.message}`);
      console.log(`[TaskID: ${this.taskId}] ===== Route type selection operation ended =====\n`);
      return false;
    }
  }

  /**
   * Get Bridge preview information
   * @returns Bridge preview information object
   */
  async getBridgePreviewInfo(): Promise<any> {
    console.log(`[TaskID: ${this.taskId}]\n===== Getting Bridge preview information =====`);
    
    const previewInfo: any = {};
    
    try {
      // Get output amount
      const outputAmount = this.page.locator(this.selectors.outputAmount);
      if (await outputAmount.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await outputAmount.textContent();
        if (text) {
          previewInfo.outputAmount = text.trim();
          console.log(`[TaskID: ${this.taskId}] Output amount: ${previewInfo.outputAmount}`);
        }
      }
      
      // Get error message
      const errorMessage = this.page.locator(this.selectors.errorMessage);
      if (await errorMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await errorMessage.textContent();
        if (text) {
          previewInfo.error = text.trim();
          console.log(`[TaskID: ${this.taskId}] Error message: ${previewInfo.error}`);
        }
      }
      
      // Get warning message
      const warningMessage = this.page.locator(this.selectors.warningMessage);
      if (await warningMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await warningMessage.textContent();
        if (text) {
          previewInfo.warning = text.trim();
          console.log(`[TaskID: ${this.taskId}] Warning message: ${previewInfo.warning}`);
        }
      }
      
      // Get estimated duration
      const estimatedDuration = this.page.locator(this.selectors.estimatedDuration);
      if (await estimatedDuration.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await estimatedDuration.textContent();
        if (text) {
          // Try to extract duration information
          const match = text.match(/(\d+\s*(?:min|hour|day|second)s?)/i);
          if (match) {
            previewInfo.estimatedDuration = match[1];
            console.log(`[TaskID: ${this.taskId}] Estimated duration: ${previewInfo.estimatedDuration}`);
          }
        }
      }
      
      // Get slippage information
      const slippage = this.page.locator(this.selectors.slippage);
      if (await slippage.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await slippage.textContent();
        if (text) {
          // Try to extract slippage percentage
          const match = text.match(/(\d+(?:\.\d+)?%)/);
          if (match) {
            previewInfo.slippage = match[1];
            console.log(`[TaskID: ${this.taskId}] Slippage: ${previewInfo.slippage}`);
          }
        }
      }
      
      console.log(`[TaskID: ${this.taskId}] ===== Bridge preview information collection ended =====\n`);
      return previewInfo;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error getting Bridge preview information: ${error.message}`);
      console.log(`[TaskID: ${this.taskId}] ===== Bridge preview information collection ended =====\n`);
      return previewInfo;
    }
  }

  /**
   * Click Preview Route button
   * @returns Whether successfully clicked
   */
  async clickPreviewRouteButton(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}]\n===== Attempting to click Preview Route button ======`);
    try {
      // Find Preview Route button
      const previewButton = this.page.locator(this.selectors.previewRouteButton);
      const isVisible = await previewButton.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isVisible) {
        // Check if button is enabled
        const isEnabled = await previewButton.isEnabled();
        
        if (isEnabled) {
          console.log(`[TaskID: ${this.taskId}] Found enabled Preview Route button, clicking...`);
          await this.takeScreenshot("before-preview-route-click");
          
          await previewButton.click();
          await this.wait(2000);
          
          await this.takeScreenshot("after-preview-route-click");
          console.log(`[TaskID: ${this.taskId}] Clicked Preview Route button`);
          console.log(`[TaskID: ${this.taskId}] ===== Preview Route button click operation ended =====\n`);
          return true;
        } else {
          console.log(`[TaskID: ${this.taskId}] Preview Route button is disabled, may need to check form input validity`);
          console.log(`[TaskID: ${this.taskId}] ===== Preview Route button click operation ended =====\n`);
          return false;
        }
      } else {
        console.log(`[TaskID: ${this.taskId}] Preview Route button not found`);
        
        // Try to find possible alternative buttons
        const alternativeButtons = [
          this.page.locator('button:has-text("Continue")'),
          this.page.locator('button:has-text("Next")'),
          this.page.locator('button:has-text("Proceed")')
        ];
        
        for (const button of alternativeButtons) {
          if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log(`[TaskID: ${this.taskId}] Found alternative button, clicking...`);
            await this.takeScreenshot("before-alternative-preview-click");
            
            await button.click();
            await this.wait(2000);
            
            await this.takeScreenshot("after-alternative-preview-click");
            console.log(`[TaskID: ${this.taskId}] Clicked alternative button`);
            console.log(`[TaskID: ${this.taskId}] ===== Preview Route button click operation ended =====\n`);
            return true;
          }
        }
        
        console.log(`[TaskID: ${this.taskId}] No Preview Route button or alternative buttons found`);
        console.log(`[TaskID: ${this.taskId}] ===== Preview Route button click operation ended =====\n`);
        return false;
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error clicking Preview Route button: ${error.message}`);
      console.log(`[TaskID: ${this.taskId}] ===== Preview Route button click operation ended =====\n`);
      return false;
    }
  }
}