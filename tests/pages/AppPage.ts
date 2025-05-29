// tests/pages/AppPage.ts
import { Page, BrowserContext } from '@playwright/test';

import { BasePage } from './BasePage';
import { WalletPage } from './WalletPage';
import { BridgeNavigationPage } from './BridgeNavigationPage';
import { BridgeFormPage } from './BridgeFormPage';
import { BridgeRoutePage } from './BridgeRoutePage';
import { TransactionPage } from './TransactionPage';
import { TransactionApprovePage } from './TransactionApprovePage';
import { BridgeOperationOutput, BridgeOperationInput, ApiResponseRecord } from './BridgeInterfaces';
import { ApiMonitor, ApiResponseResult } from '../utils/ApiMonitor';
import { ApiResponseHandler } from '../utils/ApiResponseHandler';

/**
 * Application Main Page Class - Integrates all functionality
 */
export class AppPage {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly basePage: BasePage;
  readonly walletPage: WalletPage;
  readonly bridgeNavPage: BridgeNavigationPage;
  readonly bridgeFormPage: BridgeFormPage;
  readonly bridgeRoutePage: BridgeRoutePage;
  readonly transactionPage: TransactionPage;
  readonly transactionApprovePage: TransactionApprovePage;

  readonly taskId: string;
  readonly apiMonitor: ApiMonitor;
  readonly apiResponseHandler: ApiResponseHandler;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
    this.basePage = new BasePage(page, context);
    this.walletPage = new WalletPage(page, context);
    this.bridgeNavPage = new BridgeNavigationPage(page, context);
    this.bridgeFormPage = new BridgeFormPage(page, context);
    this.bridgeRoutePage = new BridgeRoutePage(page, context);
    this.transactionPage = new TransactionPage(page, context);
    this.transactionApprovePage = new TransactionApprovePage(page, context);
    this.taskId = process.env.TASKID || '0';
    this.apiMonitor = new ApiMonitor(page, this.taskId);
    this.apiResponseHandler = new ApiResponseHandler(this.taskId);
    console.log(`[TaskID: ${this.taskId}] AppPage initialized, Base URL: ${this.basePage.baseUrl}`);
  }

  /**
   * Navigate to application homepage
   */
  async navigateToHomePage(url?: string): Promise<void> {
    await this.basePage.navigateToHomePage(url);
  }

  /**
   * Connect wallet
   */
  async connectWallet(): Promise<void> {
    await this.walletPage.connectWallet();
  }

  /**
   * Verify if wallet is connected
   */
  async verifyWalletConnected(): Promise<boolean> {
    return await this.walletPage.verifyWalletConnected();
  }

  /**
   * Navigate to Bridge/Swap interface
   */
  async navigateToBridgeUI(): Promise<boolean> {
    const walletUIStarted = await this.walletPage.launchWalletUI();
    if (!walletUIStarted) {
      console.log(`[TaskID: ${this.taskId}] Failed to launch WalletUI, cannot navigate to Bridge/Swap interface`);
      return false;
    }
    
    return await this.bridgeNavPage.navigateToBridgeUI();
  }

  /**
   * Click FROM select button
   */
  async clickFromSelectButton(): Promise<void> {
    await this.bridgeFormPage.clickFromSelectButton();
  }

  /**
   * Click TO select button
   */
  async clickToSelectButton(): Promise<void> {
    await this.bridgeFormPage.clickToSelectButton();
  }

  /**
   * Click home button
   */
  async clickHomeButton(): Promise<void> {
    await this.bridgeNavPage.clickHomeButton();
  }

  /**
   * Create screenshot
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.basePage.takeScreenshot(name);
  }
    
  /**
   * Execute complete Bridge operation flow
   * @param amount Transfer amount
   * @param fromChain Source chain name (e.g., "interwoven")
   * @param fromToken Source token symbol (e.g., "USDC")
   * @param toChain Target chain name (e.g., "interwoven")
   * @param toToken Target token symbol (e.g., "INIT")
   * @param routeType Route type, like "Minitswap" or "Optimistic bridge", if multiple options
   * @param targetAddress Optional target address, if needed
   */
  async performBridgeOperation(
    amount: string, 
    fromChain: string = "interwoven", 
    fromToken: string = "USDC", 
    toChain: string = "interwoven", 
    toToken: string = "INIT",
    routeType: string = "Minitswap",
    targetAddress?: string
  ): Promise<BridgeOperationOutput> {
    console.log(`[TaskID: ${this.taskId}] Starting Bridge operation: ${amount} ${fromChain}/${fromToken} -> ${toChain}/${toToken} (Route type: ${routeType})`);
    
    // Create result object
    const result: BridgeOperationOutput = {
      success: false,
      testProgress: 'untested', // Initialize test status as untested
      timing: {
        startTime: Date.now(),
        endTime: 0,
        duration: 0
      },
      screenshots: [],
      apiResponses: {} // Initialize API response record object
    };
    try {
      // Record current screenshot
      await this.takeScreenshot('bridge-operation-start');
      if (result.screenshots) {
        result.screenshots.push(`screenshots/bridge-operation-start-task-${this.taskId}.png`);
      }
      this.apiMonitor.cancelAllMonitors();

      // 1. Set up wallet connection
      if (!await this.setupWalletConnection(result)) {
        // If wallet connection fails, return result directly
        return this.finalizeResult(result, { 
          success: false,
          testProgress: 'untested'
        });
      }
      
      // 2. Navigate to Bridge interface and configure transaction parameters
      if (!await this.setupBridgeTransaction(result, fromChain, fromToken, toChain, toToken)) {
        // If configuration fails, return result directly
        return this.finalizeResult(result, { 
          success: false,
          testProgress: 'untested'
        });
      }
      
      // 3. Enter amount and monitor Route API response
      if (!await this.processAmountAndMonitorRoute(result, amount)) {
        // If Route API returns "no routes found" or other errors, return result directly
        return this.finalizeResult(result, {
          success: false,
          testProgress: 'routeTested',
          routePass: false
        });
      }
      
      // 4. Select route type and get preview information, Only used for optimistic bridge
      await this.selectRouteAndGetPreview(result, routeType);
      
      // 5. Preview and submit route
      if (!await this.previewAndSubmitRoute(result)) {
        // If preview and submit fails, return result directly
        return this.finalizeResult(result, {
          success: false,
          testProgress: 'routeTested',
          routePass: false
        });
      }
      
      // 6. Handle transaction confirmation
      if(!await this.handleTransactionConfirmation(result)) {  
        // If transaction confirmation fails, return result directly
        return this.finalizeResult(result, {
          success: false,
          testProgress: 'SignTested',
          routePass: true
        });
      }
      
      console.log(`[TaskID: ${this.taskId}] Bridge operation flow completed`);
      
      // Set operation as successful
      return this.finalizeResult(result, { 
        success: true,
        testProgress: 'SignTested',
        routePass: true
      });
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error during Bridge operation: ${error.message}`);
      result.error = error.message;
      
      // Record error screenshot
      await this.takeScreenshot('bridge-operation-error');
      if (result.screenshots) {
        result.screenshots.push(`screenshots/bridge-operation-error-task-${this.taskId}.png`);
      }
      
      // Based on current test progress determine status
      let options: any = { success: false };
      if (result.testProgress) {
        options.testProgress = result.testProgress;
      }
      if (result.routePass !== undefined) {
        options.routePass = result.routePass;
      }
      
      return this.finalizeResult(result, options);
    }
  }

  /**
   * Set up wallet connection
   */
  private async setupWalletConnection(result: BridgeOperationOutput): Promise<boolean> {
    // Check if WalletUI needs to be launched
    let walletConnected = await this.verifyWalletConnected();
    
    // If wallet not connected, try to connect first
    if (!walletConnected) {
      console.log(`[TaskID: ${this.taskId}] Wallet not connected, attempting to connect wallet`);
      await this.connectWallet();
      walletConnected = await this.verifyWalletConnected();
      
      if (!walletConnected) {
        console.log(`[TaskID: ${this.taskId}] Wallet connection failed, operation aborted`);
        result.error = "Wallet connection failed";
        return false;
      }
    } else {
      console.log(`[TaskID: ${this.taskId}] Wallet already connected, continuing operation`);
    }
    
    // Launch WalletUI
    await this.walletPage.launchWalletUI();
    return true;
  }

  /**
   * Set up Bridge transaction
   */
  async setupBridgeTransaction(
    result: BridgeOperationOutput,
    fromChain: string,
    fromToken: string,
    toChain: string,
    toToken: string
  ): Promise<boolean> {
    // Navigate to Bridge interface
    const navigatedToBridge = await this.navigateToBridgeUI();
    if (!navigatedToBridge) {
      console.log(`[TaskID: ${this.taskId}] Unable to navigate to Bridge interface, operation aborted`);
      result.error = "Unable to navigate to Bridge interface";
      return false;
    }

    // ===== Wait for Loading page to disappear =====
    console.log(`[TaskID: ${this.taskId}] Waiting for Bridge page to finish loading...`);
    await this.bridgeNavPage.waitForBridgePageLoading();
    
    // ===== Confirm form elements are ready =====
    const formReady = await this.bridgeNavPage.checkFormElementsReady();
    if (!formReady) {
      console.log(`[TaskID: ${this.taskId}] Form elements not ready, will wait longer...`);
      // Wait additional time
      await this.basePage.wait(5000);
    }
    
    // Record screenshot of loaded page
    await this.takeScreenshot('bridge-page-loaded');
    if (result.screenshots) {
      result.screenshots.push(`screenshots/bridge-page-loaded-task-${this.taskId}.png`);
    }

    // Configure FROM options
    console.log(`[TaskID: ${this.taskId}] Starting FROM options configuration...`);
    // Use unified method, true indicates FROM
    await this.bridgeFormPage.clickSelectButton("from");
    await this.basePage.wait(1000);
    
    const fromSelected = await this.bridgeFormPage.selectChainAndToken(fromChain, fromToken);
    if (!fromSelected) {
      console.log(`[TaskID: ${this.taskId}] Unable to complete FROM options configuration, attempting to continue`);
      // Close potentially open selection menu
      await this.page.keyboard.press('Escape');
      await this.basePage.wait(1000);
    }
    
    // Configure TO options
    console.log(`[TaskID: ${this.taskId}] Starting TO options configuration...`);
    // Use unified method, false indicates TO
    await this.bridgeFormPage.clickSelectButton("to");
    await this.basePage.wait(1000);
    
    const toSelected = await this.bridgeFormPage.selectChainAndToken(toChain, toToken);
    if (!toSelected) {
      console.log(`[TaskID: ${this.taskId}] Unable to complete TO options configuration, attempting to continue`);
      // Close potentially open selection menu
      await this.page.keyboard.press('Escape');
      await this.basePage.wait(1000);
    }
    
    return true;
  }
  /**
   * Handle amount input and monitor Route API response - Enhanced version with modular processing
   */
  private async processAmountAndMonitorRoute(
    result: BridgeOperationOutput,
    amount: string
  ): Promise<boolean> {
    // Set up monitoring to intercept Route API requests, using silent timeout mode
    const monitorId = await this.apiMonitor.startMonitoringSpecificPath('route', 'POST', undefined, {
      oneTime: true,
      timeout: 5000,
      silentTimeout: true,  // Silent mode, don't record timeout errors
      partialMatch: true    // Enable partial matching
    });
    
    // Input amount
    console.log(`[TaskID: ${this.taskId}] Starting amount input and monitoring Route API response...`);
    const amountEntered = await this.bridgeFormPage.enterAmount(amount);
    if (!amountEntered) {
      console.log(`[TaskID: ${this.taskId}] Unable to input amount, but will attempt to continue operation`);
    }
    
    // Wait for API response, using shorter timeout since we'll fall back to checking UI if no response
    console.log(`[TaskID: ${this.taskId}] Waiting for Route API response...`);
    const apiResult = await this.apiMonitor.waitForResponse(monitorId, 5000);
    console.log(`[TaskID: ${this.taskId}] Route API status:`, apiResult.status);
    console.log(`[TaskID: ${this.taskId}] Route API response data:`, apiResult.data);
    console.log(`[TaskID: ${this.taskId}] Route API success:`, apiResult.success);

    // If there is API response then process it, using modular API handler
    if (apiResult && apiResult.success ) {
      // Use API response handler to process response
      const shouldAbort = this.apiResponseHandler.handleRouteApiResponse(result, apiResult);
      
      if (shouldAbort) {
        console.log(`[TaskID: ${this.taskId}] Route API response handler suggests aborting operation`);
        return false;
      }
    } else {
      // No API response or response error, fall back to checking UI
      return await this.checkUIStateForRouteValidity(result);
    }
    
    return true;
  }

  /**
   * Check UI state to determine route validity - New modular method
   */
  private async checkUIStateForRouteValidity(result: BridgeOperationOutput): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] No Route API response detected (might be using cache) or response error, checking UI interface state...`);
    
    // Take screenshot to record current state
    await this.takeScreenshot("route-ui-check");
    
    // Get information from UI
    const uiInfo = await this.bridgeFormPage.getBridgePreviewInfo();
    
    // Print detailed preview information for debugging
    /*
    console.log(`[TaskID: ${this.taskId}] UI interface preview information:`);
    for (const [key, value] of Object.entries(uiInfo)) {
      console.log(`[TaskID: ${this.taskId}] - ${key}: ${value}`);
    }*/
    
    // Check for error messages
    if (uiInfo.error) {
      console.log(`[TaskID: ${this.taskId}] Checking UI interface for errors: ${uiInfo.error}`);
      
      // Update result object
      result.error = uiInfo.error;
      result.testProgress = "routeTested";
      result.routePass = false;
      
      // Include UI information in result
      result.preview = { ...uiInfo };
      
      console.log(`[TaskID: ${this.taskId}] checkUIStateForRouteValidity: Found error message, route test failed, operation ended`);
      return false;
    }
    
    // Use JavaScript to check if Preview Route button is disabled
    const previewRouteButtonStatus = await this.page.evaluate(() => {
      const previewButton = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent && btn.textContent.includes('Preview Route')
      );
      
      if (!previewButton) {
        return { found: false, enabled: false };
      }
      
      return { 
        found: true, 
        enabled: !previewButton.disabled,
        classes: previewButton.className,
        text: previewButton.textContent || ''
      };
    });
    
    console.log(`[TaskID: ${this.taskId}] Preview Route button status:`);
    console.log(`[TaskID: ${this.taskId}] - Button found: ${previewRouteButtonStatus.found}`);
    console.log(`[TaskID: ${this.taskId}] - Button enabled: ${previewRouteButtonStatus.enabled}`);
    console.log(`[TaskID: ${this.taskId}] - Button classes: ${previewRouteButtonStatus.classes}`);
    console.log(`[TaskID: ${this.taskId}] - Button text: ${previewRouteButtonStatus.text}`);
    
    if (!previewRouteButtonStatus.found || !previewRouteButtonStatus.enabled) {
      console.log(`[TaskID: ${this.taskId}] Preview Route button ${previewRouteButtonStatus.found ? 'is disabled' : 'not found'}, route determined as failed`);
      
      // Update result object
      result.error = previewRouteButtonStatus.found 
        ? "Preview Route button is disabled" 
        : "Preview Route button not found";
      result.testProgress = "routeTested";
      result.routePass = false;
      
      // Include UI information in result
      result.preview = { ...uiInfo };
      
      console.log(`[TaskID: ${this.taskId}] Button status check failed, route test failed, operation ended`);
      return false;
    }
    
    // If we get here, no errors detected in UI and button is enabled, determine route as valid
    console.log(`[TaskID: ${this.taskId}] No UI errors detected, Preview Route button is enabled, route determined as valid`);
    result.testProgress = "routeTested";
    result.routePass = true;
    
    // Include UI information in result
    result.preview = { ...uiInfo };
    
    return true;
  }
  /**
   * Select route type and get preview information
   */
  private async selectRouteAndGetPreview(
    result: BridgeOperationOutput,
    routeType: string
  ): Promise<void> {
    // Select route type (if multiple options available)
    await this.bridgeFormPage.selectRouteType(routeType);
    
    // Record form completion screenshot
    await this.takeScreenshot('bridge-form-filled');
    if (result.screenshots) {
      result.screenshots.push(`screenshots/bridge-form-filled-task-${this.taskId}.png`);
    }
    
    // Get UI preview information
    const uiPreviewInfo = await this.bridgeFormPage.getBridgePreviewInfo();
    
    // Merge UI preview information
    result.preview = { ...uiPreviewInfo, ...result.preview };
  }

  /**
   * Preview and submit route - Enhanced version, get Gas Fee and verify API response
   */
  private async previewAndSubmitRoute(result: BridgeOperationOutput): Promise<boolean> {
    // Set up monitoring to intercept Msgs API requests
    console.log(`[TaskID: ${this.taskId}] Starting to monitor Msgs API requests...`);
    const msgsMonitorId = await this.apiMonitor.startMonitoringSpecificPath('msgs', 'POST', undefined, {
      oneTime: true,
      timeout: 5000,
      silentTimeout: true,  // Silent mode, don't record timeout errors
      partialMatch: true    // Enable partial matching
    });
      
    // Click Preview Route button
    const clickedPreviewRoute = await this.bridgeFormPage.clickPreviewRouteButton();
    if (!clickedPreviewRoute) {
      console.log(`[TaskID: ${this.taskId}] Unable to click Preview Route button, operation aborted`);
      result.error = "Unable to click Preview Route button";
      return false;
    }

    // Handle Keplr wallet confirmation
    console.log(`[TaskID: ${this.taskId}] Handling Keplr wallet confirmation...`);
    await this.transactionPage.handleKeplrConfirmation();
    console.log(`[TaskID: ${this.taskId}] Keplr wallet confirmation completed`);

    // Wait for Msgs API response
    console.log(`[TaskID: ${this.taskId}] Waiting for Msgs API response...`);
    const msgsApiResult = await this.apiMonitor.waitForResponse(msgsMonitorId, 10000);
    console.log(`[TaskID: ${this.taskId}] Msgs API status:`, msgsApiResult.status);
    console.log(`[TaskID: ${this.taskId}] Msgs API response data:\n${JSON.stringify(msgsApiResult.data, null, 2)}`);
    console.log(`[TaskID: ${this.taskId}] Msgs API response time:`, msgsApiResult.responseTime);
    console.log(`[TaskID: ${this.taskId}] Msgs API success:`, msgsApiResult.success);

    // If there is API response then process it, using modular API handler
    if (msgsApiResult && msgsApiResult.success ) {
      // Use API response handler to process response
      const shouldAbort = this.apiResponseHandler.handleMsgsApiResponse(result, msgsApiResult);
      
      if (shouldAbort) {
        console.log(`[TaskID: ${this.taskId}] MSGS API response handler suggests aborting operation`);
        return false;
      }
      else {
        // Handle successful API response
        console.log(`[TaskID: ${this.taskId}] MSGS API response processing successful`);
      }
    } 
    
    
    // Record route preview page screenshot
    await this.takeScreenshot('route-preview-page');
    if (result.screenshots) {
      result.screenshots.push(`screenshots/route-preview-page-task-${this.taskId}.png`);
    }

    // ===== Monitor simulate RPC request =====
    console.log(`[TaskID: ${this.taskId}] Starting to monitor transaction simulation RPC request...`);

    // Use partialMatch: true to enable partial path matching
    const simulateMonitorId = await this.apiMonitor.startMonitoringRpcMethod(
      "abci_query", 
      "Simulate", // Just use "Simulate" instead of the full path
      `simulate_monitor_${Date.now()}`,
      { 
        oneTime: true, 
        timeout: 15000, 
        verbose: true,
        partialMatch: true // Enable partial matching
      }
    );
    
    // Click Submit button
    const clickedSubmit = await this.bridgeRoutePage.clickSubmitButton();
    if (!clickedSubmit) {
      console.log(`[TaskID: ${this.taskId}] Unable to click Submit button, operation aborted`);
      result.error = "Unable to click Submit button";
      return false;
    }

    // Handle Keplr wallet confirmation
    console.log(`[TaskID: ${this.taskId}] Handling Keplr wallet confirmation...`);
    await this.transactionPage.handleKeplrConfirmation();
    console.log(`[TaskID: ${this.taskId}] Keplr wallet confirmation completed`);

    // Wait for transaction simulation RPC response
    console.log(`[TaskID: ${this.taskId}] Waiting for transaction simulation RPC response...`);
    const simulateResult = await this.apiMonitor.waitForResponse(simulateMonitorId, 15000);
    console.log(`[TaskID: ${this.taskId}] Transaction simulation RPC status:`, simulateResult.status);
    //console.log(`[TaskID: ${this.taskId}] Transaction simulation RPC response data:\n${JSON.stringify(simulateResult.data, null, 2)}`);
    //console.log(`[TaskID: ${this.taskId}] Transaction simulation RPC response time:`, simulateResult.responseTime);
    console.log(`[TaskID: ${this.taskId}] Transaction simulation RPC success:`, simulateResult.success);

    
    // Handle transaction simulation RPC response
    if (simulateResult && simulateResult.success) {
      // Handle simulation results
      const isSimulateError = await this.handleSimulateRpcResponse(result, simulateResult);
      
      // If simulation returns error, abort operation
      if (isSimulateError) {
        // Set test status - route passed but signature test failed
        result.testProgress = "SignTested";
        result.routePass = true; 
        result.success = false;
        
        console.log(`[TaskID: ${this.taskId}] Transaction simulation failed, operation aborted`);
        return false;
      }
    } else {
      console.log(`[TaskID: ${this.taskId}] No transaction simulation RPC response captured, continuing execution...`);
    }
    console.log(`[TaskID: ${this.taskId}] Transaction simulation RPC response processing completed`);
    
    return true;
  }
  /**
   * Handle transaction simulation RPC response
   * @param result Operation result object
   * @param rpcResult RPC monitor returned result
   * @returns Whether error exists (true indicates error)
   */
  private async handleSimulateRpcResponse(
    result: BridgeOperationOutput, 
    rpcResult: any
  ): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Processing transaction simulation RPC response...`);
    
    try {
      // Record RPC response
      if (!result.apiResponses) {
        result.apiResponses = {};
      }
      
      result.apiResponses['simulate'] = {
        endpoint: '/cosmos.tx.v1beta1.Service/Simulate',
        method: 'POST',
        status: rpcResult.status || 0,
        success: rpcResult.success || false,
        data: rpcResult.data || null,
        timestamp: Date.now(),
        responseTime: rpcResult.responseTime || 0
      };
      
      // Check if RPC response data exists
      if (!rpcResult.data) {
        console.log(`[TaskID: ${this.taskId}] Transaction simulation RPC response has no data`);
        return false;
      }
      
      // Parse RPC response data
      const responseData = rpcResult.data;
      
      // Check for error messages - check top level errors first
      if (responseData.error) {
        const errorMessage = typeof responseData.error === 'object' ? 
          JSON.stringify(responseData.error) : responseData.error.toString();
        console.log(`[TaskID: ${this.taskId}] Transaction simulation RPC response contains top level error: ${errorMessage}`);
        result.error = `Transaction simulation failed: ${errorMessage}`;
        return true;
      }
      
      // Check result section - get result portion
      let simulateResult = null;
      
      // Check different structure possibilities
      if (responseData.result) {
        // Try to parse result portion
        if (typeof responseData.result === 'string') {
          try {
            // Some APIs return Base64 encoded results
            if (responseData.result.match(/^[A-Za-z0-9+/=]+$/)) {
              // Try to decode Base64
              const decodedResult = atob(responseData.result);
              try {
                simulateResult = JSON.parse(decodedResult);
              } catch (e) {
                simulateResult = decodedResult;
              }
            } else {
              // Try to parse JSON string directly
              simulateResult = JSON.parse(responseData.result);
            }
          } catch (e) {
            simulateResult = responseData.result;
          }
        } else {
          simulateResult = responseData.result;
        }
      } else if (responseData.response && responseData.response.result) {
        // Alternative possible structure
        simulateResult = responseData.response.result;
      }
      
      // Check parsed result for errors
      if (simulateResult) {
        // Check for non-zero code cases
        if (simulateResult.code !== undefined && simulateResult.code !== 0) {
          const errorMessage = simulateResult.raw_log || simulateResult.message || `Code: ${simulateResult.code}`;
          console.log(`[TaskID: ${this.taskId}] Transaction simulation returned non-zero Code: ${simulateResult.code}, Error: ${errorMessage}`);
          result.error = `Transaction simulation failed: ${errorMessage}`;
          return true;
        }
        
        // Check for error or fail keywords
        const resultString = JSON.stringify(simulateResult).toLowerCase();
        if (resultString.includes('error') || resultString.includes('fail')) {
          console.log(`[TaskID: ${this.taskId}] Transaction simulation result contains error or fail keywords`);
          
          // Try to extract specific error message
          let errorMessage = "Unknown error";
          
          // Extract error message from raw_log or log field
          if (simulateResult.raw_log) {
            errorMessage = simulateResult.raw_log;
          } else if (simulateResult.log) {
            errorMessage = simulateResult.log;
          } else {
            // If no specific error fields found, extract part containing error
            const errorMatch = resultString.match(/error[^}]*}/i);
            if (errorMatch) {
              errorMessage = errorMatch[0];
            }
          }
          
          console.log(`[TaskID: ${this.taskId}] Extracted error message: ${errorMessage}`);
          result.error = `Transaction simulation failed: ${errorMessage}`;
          return true;
        }
      }
      
      // No errors detected
      console.log(`[TaskID: ${this.taskId}] Transaction simulation successful, no errors detected`);
      return false;
      
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error processing transaction simulation RPC response: ${error.message}`);
      result.error = `Error processing simulation response: ${error.message}`;
      return true;
    }
  }

  /**
   * Handle transaction confirmation
   */
  private async handleTransactionConfirmation(result: BridgeOperationOutput): Promise<boolean> {
    try {
      // Get Gas Fee information
      console.log(`[TaskID: ${this.taskId}] Starting to extract Gas Fee information...`);
      await this.page.waitForTimeout(2000); // Wait 2 seconds to ensure page is loaded
      await this.transactionApprovePage.extractGasFeeInfo(result)
        .catch((error) => {
          console.log(`[TaskID: ${this.taskId}] Failed to extract Gas Fee information: ${error.message}`);
          result.error = `Failed to extract Gas Fee information: ${error.message}`;
          //return false; not a big issue
        });
      console.log(`[TaskID: ${this.taskId}] Gas Fee information extraction completed`);
      
      // Update test progress
      result.testProgress = "SignTested";
      result.routePass = true; // Route passed

      // Check if Approve button is enabled
      const isApproveButtonEnabled = await this.transactionApprovePage.isApproveButtonEnabled();
      if (!isApproveButtonEnabled) {
        console.log(`[TaskID: ${this.taskId}] Approve button is disabled, operation aborted`);
        result.error = "Approve button is disabled"; 
        const errorMessage = await this.transactionApprovePage.checkForErrorMessage();
        if (errorMessage) {
          console.log(`[TaskID: ${this.taskId}] Detected error message: ${errorMessage}`);
          result.error = result.error + ', reason might be: '+ errorMessage;
        }
        result.success = false;
        return false;
      }

      // ===== Monitor broadcast transaction RPC =====
      console.log(`[TaskID: ${this.taskId}] Starting to monitor transaction broadcast RPC...`);
      const broadcastMonitorId = this.apiMonitor.startMonitoringBroadcastRPC(
        "broadcast_tx_sync", 
        `broadcast_monitor_${Date.now()}`,
        { 
          oneTime: true, 
          timeout: 15000,
          verbose: true
        }
      );

      // Click Approve button
      const clickedApprove = await this.transactionApprovePage.clickApproveButton();
      if (!clickedApprove) {
        console.log(`[TaskID: ${this.taskId}] Unable to click Approve button, attempting to handle possible popups`);
        
        // Try to handle possible popups
        const handledModal = await this.transactionApprovePage.handlePossibleModals();
        if (!handledModal) {
          console.log(`[TaskID: ${this.taskId}] No confirmation button found and unable to handle popups, operation might fail`);
        }
      }
      
      // Handle Keplr wallet confirmation
      const confirmedInKeplr = await this.transactionPage.handleKeplrConfirmation();
      if (!confirmedInKeplr) {
        console.log(`[TaskID: ${this.taskId}] Failed to confirm in Keplr wallet, waiting for possible result page`);
        // Continue execution, as popup might auto-close in some cases
      }
      
      // ===== Wait for broadcast transaction RPC response =====
      console.log(`[TaskID: ${this.taskId}] Waiting for transaction broadcast RPC response...`);
      const broadcastResult = await this.apiMonitor.waitForResponse(broadcastMonitorId, 15000);
      console.log(`[TaskID: ${this.taskId}] Transaction broadcast RPC status:`, broadcastResult.status);
      console.log(`[TaskID: ${this.taskId}] Transaction broadcast RPC response data:\n${JSON.stringify(broadcastResult.data, null, 2)}`);
      console.log(`[TaskID: ${this.taskId}] Transaction broadcast RPC response time:`, broadcastResult.responseTime);
      console.log(`[TaskID: ${this.taskId}] Transaction broadcast RPC success:`, broadcastResult.success);
      
      // Handle broadcast result
      if (broadcastResult.success) {
        console.log(`[TaskID: ${this.taskId}] Successfully captured broadcast transaction response`);
        const txResult = this.apiMonitor.processBroadcastResponse(broadcastResult);
        
        if (txResult.success) {
          console.log(`[TaskID: ${this.taskId}] Transaction broadcast successful`);
          
          // Save transaction hash
          if (txResult.hash) {
            result.transactionHash = txResult.hash;
            console.log(`[TaskID: ${this.taskId}] Transaction hash: ${txResult.hash}`);
          }
          
          // Update result
          result.success = true;
        } else {
          console.log(`[TaskID: ${this.taskId}] Transaction broadcast failed: ${txResult.error}`);
          result.error = txResult.error;
          result.success = false;
          return false;
        }
      } else {
        console.log(`[TaskID: ${this.taskId}] No transaction broadcast response captured: ${broadcastResult.error || 'Unknown error'}`);
        
        if (broadcastResult.timedOut) {
          console.log(`[TaskID: ${this.taskId}] Transaction broadcast monitoring timed out, continuing to check UI state`);
        }
      }

      return true;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error in transaction confirmation: ${error.message}`);
      result.error = `Transaction confirmation failed: ${error.message}`;
      return false;
    }
  }
  
  /**
   * Finalize result object, add timing information and ensure test status consistency
   * @param result Operation result object
   * @param options Optional result status settings
   * @returns Completed operation result object
   */
  private finalizeResult(
    result: BridgeOperationOutput,
    options?: {
      success?: boolean;
      testProgress?: 'untested' | 'routeTested' | 'SignTested';
      routePass?: boolean;
    }
  ): BridgeOperationOutput {
    // Ensure timing object exists
    if (!result.timing) {
      result.timing = {
        startTime: Date.now(),
        endTime: 0,
        duration: 0
      };
    }
    
    // Set time information, ensure startTime exists
    result.timing.startTime = result.timing.startTime || Date.now();
    result.timing.endTime = Date.now();
    result.timing.duration = result.timing.endTime - result.timing.startTime;
    
    // If options provided, directly set corresponding fields
    if (options) {
      // Directly set success field
      if (options.success !== undefined) {
        result.success = options.success;
      }
      
      // Directly set testProgress field
      if (options.testProgress !== undefined) {
        result.testProgress = options.testProgress;
      }
      
      // Directly set routePass field
      if (options.routePass !== undefined) {
        result.routePass = options.routePass;
      }
    }
    
    // Only in fields not explicitly set cases, ensure test status consistency
    
    // If there's error and success not explicitly set, set to false
    if (result.error && result.success === undefined) {
      result.success = false;
    }
    
    // If routePass is false and success not explicitly set, set to false
    if (result.routePass === false && result.success === undefined) {
      result.success = false;
    }
    
    // If testProgress not set, set default value based on conditions
    if (!result.testProgress) {
      if (result.error && result.error === "Wallet connection failed") {
        result.testProgress = 'untested';
      } else if (result.routePass !== undefined) {
        result.testProgress = 'routeTested';
      }
    }
    
    // Ensure success has value (default to true, to maintain original behavior)
    if (result.success === undefined) {
      result.success = true;
    }
    
    return result;
  }
  
  /**
   * Simplified Bridge test, suitable for testing
   */
  async simpleBridgeTest(): Promise<boolean> {
    console.log(`[TaskID: ${this.taskId}] Starting simplified Bridge test`);
    
    try {
      // 1. Navigate to Bridge interface
      const navigatedToBridge = await this.navigateToBridgeUI();
      if (!navigatedToBridge) {
        console.log(`[TaskID: ${this.taskId}] Unable to navigate to Bridge interface, test aborted`);
        return false;
      }
      
      // 2. Click FROM select button and press ESC to cancel
      await this.clickFromSelectButton();
      await this.basePage.wait(1000);
      await this.page.keyboard.press('Escape');
      await this.basePage.wait(1000);
      
      // 3. Click TO select button and press ESC to cancel
      await this.clickToSelectButton();
      await this.basePage.wait(1000);
      await this.page.keyboard.press('Escape');
      await this.basePage.wait(1000);
      
      // 4. Return to homepage
      await this.clickHomeButton();
      
      console.log(`[TaskID: ${this.taskId}] Simplified Bridge test completed`);
      return true;
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error in simplified Bridge test: ${error.message}`);
      return false;
    }
  }
}
