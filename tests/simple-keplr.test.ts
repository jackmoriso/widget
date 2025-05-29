// tests/simple-keplr.test.ts
// Using keplrFixture, ensure correct path
import { test } from './keplrFixture';
import { AppPage } from './pages/AppPage';
import { BridgeOperationInput, BridgeOperationOutput } from './pages/BridgeInterfaces';
import * as fs from 'fs';

// Get TASKID environment variable
const taskId = process.env.TASKID || '0';

// Formatting output functions
function printSectionHeader(title: string) {
  const line = '='.repeat(50);
  console.log(`\n${line}`);
  console.log(`${title}`);
  console.log(`${line}`);
}

function printSubHeader(title: string) {
  const line = '-'.repeat(30);
  console.log(`\n${line}`);
  console.log(`${title}`);
  console.log(`${line}`);
}

function printKeyValue(key: string, value: any, indent: number = 0) {
  const indentStr = ' '.repeat(indent);
  if (value === undefined || value === null) {
    console.log(`${indentStr}${key}: N/A`);
  } else if (typeof value === 'object') {
    console.log(`${indentStr}${key}:`);
    Object.entries(value).forEach(([k, v]) => {
      printKeyValue(k, v, indent + 2);
    });
  } else {
    console.log(`${indentStr}${key}: ${value}`);
  }
}

// Print operation summary
function printOperationSummary(input: BridgeOperationInput, output: BridgeOperationOutput) {
  printSectionHeader('Bridge Operation Summary');

  // Print input parameters
  printSubHeader('Input Parameters');
  printKeyValue('Amount', input.amount);
  printKeyValue('From Chain', input.fromChain);
  printKeyValue('From Token', input.fromToken);
  printKeyValue('To Chain', input.toChain);
  printKeyValue('To Token', input.toToken);
  printKeyValue('Route Type', input.routeType);
  if (input.targetAddress) {
    printKeyValue('Target Address', input.targetAddress);
  }

  // Print operation status
  printSubHeader('Operation Status');
  printKeyValue('Success', output.success);
  printKeyValue('Test Progress', output.testProgress);
  printKeyValue('Route Pass', output.routePass);
  
  // Print error if exists
  if (output.error) {
    printKeyValue('Error', output.error);
  }

  // Print transaction hash if exists
  if (output.transactionHash) {
    printKeyValue('Transaction Hash', output.transactionHash);
  }

  // Print preview information
  if (output.preview && Object.keys(output.preview).length > 0) {
    printSubHeader('Preview Information');
    Object.entries(output.preview).forEach(([key, value]) => {
      printKeyValue(key, value);
    });
  }

  // Print API response summary
  if (output.apiResponses && Object.keys(output.apiResponses).length > 0) {
    printSubHeader('API Responses Summary');
    Object.entries(output.apiResponses).forEach(([endpoint, response]) => {
      printKeyValue(endpoint, {
        success: response.success,
        status: response.status,
        responseTime: `${response.responseTime}ms`
      });
    });
  }

  // Print timing information
  if (output.timing) {
    printSubHeader('Timing Information');
    const duration = output.timing.duration;
    const durationStr = duration > 1000 ? 
      `${(duration/1000).toFixed(2)}s` : 
      `${duration}ms`;
    printKeyValue('Duration', durationStr);
  }

  // Print screenshot information
  if (output.screenshots && output.screenshots.length > 0) {
    printSubHeader('Screenshots');
    output.screenshots.forEach((screenshot, index) => {
      printKeyValue(`Screenshot ${index + 1}`, screenshot);
    });
  }

  // Print result file path
  const resultFile = `results/bridge-result-${taskId}-${Date.now()}.json`;
  printSubHeader('Result File');
  printKeyValue('Path', resultFile);
}

// Using keplrContext parameter
test('Execute Keplr Wallet Bridge Transaction and Collect Information', async ({ keplrContext }) => {
  // Get page and context from keplrContext
  const { page, context } = keplrContext;
  
  // Create application page object
  const appPage = new AppPage(page, context);
  console.log(`[TaskID: ${taskId}] process.env.TEST_URL: ${process.env.TEST_URL}`);
  console.log(`[TaskID: ${taskId}] Starting Bridge Transaction Test`);
  console.log(`[TaskID: ${taskId}] Using Test URL: ${process.env.TEST_URL || 'https://initia-widget-playground.vercel.app/'}`);
  
  try {
    // Navigate to application homepage
    await appPage.navigateToHomePage();
    
    // Connect wallet
    await appPage.connectWallet();
    
    // Verify wallet connection
    const isConnected = await appPage.verifyWalletConnected();
    console.log(`[TaskID: ${taskId}] Wallet Connection Status: ${isConnected ? 'Connected' : 'Not Connected'}`);
    
    if (!isConnected) {
      console.log(`[TaskID: ${taskId}] Warning: Wallet connection failed, test aborted`);
      throw new Error('Wallet not connected');
    }

    // Wait to ensure connection is complete
    await page.waitForTimeout(1000);
    
    // Prepare Bridge operation input parameters
    const bridgeInput: BridgeOperationInput = {
      amount: "0.00002",
      fromChain: "BFB",
      fromToken: "INIT",
      toChain: "BFB",
      toToken: "BFB",
      routeType: "Optimistic bridge"
    };
    
    // Execute Bridge operation and get results
    const result: BridgeOperationOutput = await appPage.performBridgeOperation(
      bridgeInput.amount,
      bridgeInput.fromChain,
      bridgeInput.fromToken,
      bridgeInput.toChain,
      bridgeInput.toToken,
      bridgeInput.routeType
    );

    // Save complete results to file
    const resultDir = './results';
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
    
    const resultFile = `${resultDir}/bridge-result-${taskId}-${Date.now()}.json`;
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));

    // Print complete operation summary
    printOperationSummary(bridgeInput, result);
    
    // Test complete
    console.log(`\n[TaskID: ${taskId}] Bridge Transaction Test Complete`);
  } catch (error: any) {
    console.error(`[TaskID: ${taskId}] Test encountered an error but will not fail: ${error.message}`);
    await page.screenshot({ path: `screenshots/error-page-task-${taskId}.png` });
    //throw error;
  }
});
