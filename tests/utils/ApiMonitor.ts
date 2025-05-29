// tests/utils/ApiMonitor.ts (improved version with partial path matching)
import { Page } from '@playwright/test';

/**
 * API Response Result Interface
 */
export interface ApiResponseResult {
  success: boolean;     // Whether response was successfully retrieved
  data: any;           // Parsed response content (JSON)
  responseTime: number; // Response time (milliseconds)
  error?: string;      // Error message if failed
  rawResponse?: any;    // Raw response object
  url?: string;        // Captured URL
  status?: number;     // HTTP status code
  method?: string;     // HTTP method
  requestId?: string;  // Request ID, for correlating request and response
  timedOut?: boolean;  // Whether ended due to timeout
}

/**
 * Monitor Options Interface
 */
export interface MonitorOptions {
  oneTime?: boolean;        // Whether it's one-time monitoring, auto-cancel after capture
  verbose?: boolean;        // Whether to output detailed logs
  timeout?: number;         // Timeout duration (milliseconds)
  silentTimeout?: boolean;  // Whether to handle timeout silently (no error thrown)
  partialMatch?: boolean;   // New: Whether to use partial matching instead of exact matching
}

/**
 * Promise Controller Interface
 */
interface PromiseController {
  promise: Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId?: NodeJS.Timeout; // Timeout timer ID
  isResolved: boolean;        // Mark if Promise is resolved
  isRejected: boolean;        // Mark if Promise is rejected
}

/**
 * API Monitor Class - Used for monitoring and waiting for API requests, optimized version: supports partial path matching
 */
export class ApiMonitor {
  private page: Page;
  private taskId: string;
  private monitorPromises: Map<string, PromiseController> = new Map();
  private monitorStartTimes: Map<string, number> = new Map();
  private monitorPaths: Map<string, string> = new Map(); // Store paths corresponding to monitors
  private monitorOptions: Map<string, MonitorOptions> = new Map(); // Store monitor options
  private capturedRequests: Map<string, Array<{url: string, method: string, timestamp: number, rpc?: any, body?: any}>> = new Map();
  private capturedResponses: Map<string, Array<{url: string, status: number, timestamp: number, rpc?: any, body?: any}>> = new Map();
  private monitorMethods: Map<string, string> = new Map(); // Store RPC methods

  constructor(page: Page, taskId: string = '0') {
    this.page = page;
    this.taskId = taskId;
    
    // Initialize capture records
    this.capturedRequests.set('all', []);
    this.capturedResponses.set('all', []);
    
    // Set up global request listener
    this.setupGlobalRequestListener();
    
    // Clean up all monitors before page closes
    this.page.on('close', () => {
      this.cancelAllMonitors();
    });
  }

  /**
   * Path matching helper method - Match based on configuration for exact or partial matching
   * @param targetPath Target path (from request)
   * @param monitorPath Monitor path (configured path)
   * @param options Monitor options
   * @returns Whether matches
   */
  private pathMatches(targetPath: string, monitorPath: string, options: MonitorOptions): boolean {
    // Check for null or undefined
    if (!targetPath || !monitorPath) return false;
    
    // If partial matching enabled, check if target path contains monitor path
    if (options.partialMatch) {
      return targetPath.includes(monitorPath);
    }
    
    // Otherwise use exact matching
    return targetPath === monitorPath;
  }

  /**
   * Set up global request listener, supporting partial path matching
   */
  private setupGlobalRequestListener(): void {
    // Monitor all requests
    this.page.on('request', request => {
      const method = request.method();
      const url = request.url();
      const timestamp = Date.now();
      
      // Record all requests but don't print logs
      const allRequests = this.capturedRequests.get('all') || [];
      allRequests.push({ url, method, timestamp });
      this.capturedRequests.set('all', allRequests);
      
      // Special handling for POST requests, might be RPC calls
      if (method === 'POST') {
        const postData = request.postData();
        if (postData) {
          try {
            const jsonBody = JSON.parse(postData);
            
            // RPC request special handling - Check jsonrpc field or method field
            const isRpcRequest = jsonBody.jsonrpc === '2.0' || 
                              (jsonBody.method && typeof jsonBody.params === 'object');
            
            if (isRpcRequest) {
              // Loop through all monitors, check if matches RPC method and parameter path
              for (const [monitorId, paramPath] of this.monitorPaths.entries()) {
                const options = this.monitorOptions.get(monitorId) || {};
                const expectedMethod = this.monitorMethods.get(monitorId);
                
                // Check if matches RPC method
                const methodMatches = expectedMethod && jsonBody.method === expectedMethod;
                
                // Use new partial matching method to check parameter path
                const pathMatches = paramPath && jsonBody.params && 
                                   (jsonBody.params.path ? this.pathMatches(jsonBody.params.path, paramPath, options) : false);
                
                if (methodMatches && pathMatches) {
                  // Record detailed request information for this monitor
                  const monitorRequests = this.capturedRequests.get(monitorId) || [];
                  monitorRequests.push({ 
                    url, 
                    method, 
                    timestamp,
                    body: jsonBody,
                    rpc: jsonBody
                  });
                  this.capturedRequests.set(monitorId, monitorRequests);
                  
                  // Only print logs for monitored requests
                  if (options.verbose) {
                    console.log(`[TaskID: ${this.taskId}] Detected matching RPC request: ${method} ${url}`);
                    console.log(`[TaskID: ${this.taskId}] RPC method: ${jsonBody.method}, Parameter path: ${jsonBody.params.path}, Match mode: ${options.partialMatch ? 'partial match' : 'exact match'}`);
                  }
                }
              }
            } else {
              // Regular API request handling
              for (const [monitorId, path] of this.monitorPaths.entries()) {
                const options = this.monitorOptions.get(monitorId) || {};
                
                // Use new partial matching method to check URL
                if (this.pathMatches(url, path, options)) {
                  // Record detailed request information for this monitor
                  const monitorRequests = this.capturedRequests.get(monitorId) || [];
                  monitorRequests.push({ 
                    url, 
                    method, 
                    timestamp,
                    body: jsonBody
                  });
                  this.capturedRequests.set(monitorId, monitorRequests);
                  
                  // Only print logs for monitored requests
                  if (options.verbose) {
                    console.log(`[TaskID: ${this.taskId}] Detected matching request: ${method} ${url} Matching path: ${path}, Match mode: ${options.partialMatch ? 'partial match' : 'exact match'}`);
                  }
                }
              }
            }
          } catch (e) {
            // Not JSON format, ignore
          }
        }
      } else {
        // Non-POST requests only check URL path
        for (const [monitorId, path] of this.monitorPaths.entries()) {
          const options = this.monitorOptions.get(monitorId) || {};
          
          // Use new partial matching method to check URL
          if (this.pathMatches(url, path, options)) {
            // Record detailed request information for this monitor
            const monitorRequests = this.capturedRequests.get(monitorId) || [];
            monitorRequests.push({ url, method, timestamp });
            this.capturedRequests.set(monitorId, monitorRequests);
            
            // Only print logs for monitored requests
            if (options.verbose) {
              console.log(`[TaskID: ${this.taskId}] Detected matching request: ${method} ${url} Matching path: ${path}, Match mode: ${options.partialMatch ? 'partial match' : 'exact match'}`);
            }
          }
        }
      }
    });
    // Monitor all responses
    this.page.on('response', async response => {
      const url = response.url();
      const status = response.status();
      const method = response.request().method();
      const timestamp = Date.now();
      
      // Record all responses but don't print logs
      const allResponses = this.capturedResponses.get('all') || [];
      allResponses.push({ url, status, timestamp });
      this.capturedResponses.set('all', allResponses);
      
      // Special handling for POST responses, might be RPC calls
      if (method === 'POST') {
        try {
          // Get request body data to check RPC method and parameters
          const request = response.request();
          let requestBody;
          try {
            const postData = request.postData();
            if (postData) {
              requestBody = JSON.parse(postData);
            }
          } catch (e) {
            // Not JSON or can't parse, continue checking response body
          }
          
          // Try to parse response as JSON
          let responseBody;
          try {
            responseBody = await response.json();
          } catch (e) {
            // Try to get text
            try {
              const text = await response.text();
              if (text && text.trim()) {
                try {
                  responseBody = JSON.parse(text);
                } catch (e2) {
                  responseBody = text;
                }
              }
            } catch (e2) {
              // Ignore
            }
          }
          
          if (responseBody) {
            // Check if it's RPC response - has id field
            const isRpcResponse = typeof responseBody === 'object' && 
                                responseBody !== null && 
                                typeof responseBody.id !== 'undefined';
            
            if (isRpcResponse && requestBody) {
              // Loop through all monitors, check if matches RPC method and parameter path
              for (const [monitorId, paramPath] of this.monitorPaths.entries()) {
                const options = this.monitorOptions.get(monitorId) || {};
                const expectedMethod = this.monitorMethods.get(monitorId);
                
                // Check if request matches our monitored RPC call
                const methodMatches = expectedMethod && requestBody.method === expectedMethod;
                
                // Use new partial matching method to check parameter path
                const pathMatches = paramPath && requestBody.params && 
                                  (requestBody.params.path ? this.pathMatches(requestBody.params.path, paramPath, options) : false);
                
                const idMatches = responseBody.id === requestBody.id;
                
                if (methodMatches && pathMatches && idMatches) {
                  // Record detailed response information for this monitor
                  const monitorResponses = this.capturedResponses.get(monitorId) || [];
                  monitorResponses.push({ 
                    url, 
                    status, 
                    timestamp,
                    body: responseBody,
                    rpc: {
                      request: requestBody,
                      response: responseBody
                    }
                  });
                  this.capturedResponses.set(monitorId, monitorResponses);
                  
                  // Only print logs for monitored responses
                  if (options.verbose) {
                    console.log(`[TaskID: ${this.taskId}] Detected matching RPC response: ${status} ${url}`);
                    console.log(`[TaskID: ${this.taskId}] RPC method: ${requestBody.method}, Parameter path: ${requestBody.params.path}, Match mode: ${options.partialMatch ? 'partial match' : 'exact match'}`);
                    if (options.verbose) {
                      //console.log(`[TaskID: ${this.taskId}] RPC response content:\n${JSON.stringify(responseBody, null, 2)}`);
                    }
                  }
                  
                  // If one-time monitoring, mark Promise as resolved and resolve Promise
                  const controller = this.monitorPromises.get(monitorId);
                  if (options.oneTime && controller && !controller.isResolved && !controller.isRejected) {
                    controller.isResolved = true; // Mark as resolved
                    controller.resolve(response);
                  }
                }
              }
            } else {
              // Regular response handling
              for (const [monitorId, path] of this.monitorPaths.entries()) {
                const options = this.monitorOptions.get(monitorId) || {};
                
                // Use new partial matching method to check URL
                if (this.pathMatches(url, path, options)) {
                  // Record detailed response information for this monitor
                  const monitorResponses = this.capturedResponses.get(monitorId) || [];
                  monitorResponses.push({ 
                    url, 
                    status, 
                    timestamp,
                    body: responseBody
                  });
                  this.capturedResponses.set(monitorId, monitorResponses);
                  
                  // Only print logs for monitored responses
                  if (options.verbose) {
                    console.log(`[TaskID: ${this.taskId}] Detected matching response: ${status} ${url} Matching path: ${path}, Match mode: ${options.partialMatch ? 'partial match' : 'exact match'}`);
                    if (options.verbose && typeof responseBody === 'object') {
                      console.log(`[TaskID: ${this.taskId}] Response content:\n${JSON.stringify(responseBody, null, 2)}`);
                    }
                  }
                  
                  // If one-time monitoring, mark Promise as resolved and resolve Promise
                  const controller = this.monitorPromises.get(monitorId);
                  if (options.oneTime && controller && !controller.isResolved && !controller.isRejected) {
                    controller.isResolved = true; // Mark as resolved
                    controller.resolve(response);
                  }
                }
              }
            }
          }
        } catch (error) {
          // Handle errors during response analysis, ignore and continue
        }
      } else {
        // Non-POST responses, only check based on URL path
        for (const [monitorId, path] of this.monitorPaths.entries()) {
          const options = this.monitorOptions.get(monitorId) || {};
          
          // Use new partial matching method to check URL
          if (this.pathMatches(url, path, options)) {
            // Record detailed response information for this monitor
            const monitorResponses = this.capturedResponses.get(monitorId) || [];
            monitorResponses.push({ url, status, timestamp });
            this.capturedResponses.set(monitorId, monitorResponses);
            
            // Only print logs for monitored responses
            if (options.verbose) {
              console.log(`[TaskID: ${this.taskId}] Detected matching response: ${status} ${url} Matching path: ${path}, Match mode: ${options.partialMatch ? 'partial match' : 'exact match'}`);
            }
            
            // If one-time monitoring, mark Promise as resolved and resolve Promise
            const controller = this.monitorPromises.get(monitorId);
            if (options.oneTime && controller && !controller.isResolved && !controller.isRejected) {
              controller.isResolved = true; // Mark as resolved
              controller.resolve(response);
            }
          }
        }
      }
    });
  }
  /**
   * Create Promise Controller
   */
  private createPromiseController(): PromiseController {
    let resolveFunction: (value: any) => void;
    let rejectFunction: (reason?: any) => void;
    
    const promise = new Promise((resolve, reject) => {
      resolveFunction = resolve;
      rejectFunction = reject;
    });
    
    return {
      promise,
      resolve: resolveFunction!,
      reject: rejectFunction!,
      isResolved: false,
      isRejected: false
    };
  }

  /**
   * Start monitoring all HTTP requests
   * @param monitorId Monitor ID, used for retrieving results later
   * @param options Monitor options, can specify one-time monitoring etc.
   * @returns Monitor ID
   */
  startMonitoringAll(
    monitorId: string = `all_monitor_${Date.now()}`, 
    options: MonitorOptions = {}
  ): string {
    const defaultOptions: MonitorOptions = {
      oneTime: false,
      verbose: false,
      timeout: 30000,
      silentTimeout: false,  // Default don't handle timeout silently
      partialMatch: false    // Default use exact matching
    };
    
    const monitorOptions = { ...defaultOptions, ...options };
    console.log(`[TaskID: ${this.taskId}] Starting to monitor all HTTP requests (ID: ${monitorId})${monitorOptions.oneTime ? ', one-time monitoring' : ''}`);
    
    // Record start time and options
    this.monitorStartTimes.set(monitorId, Date.now());
    this.monitorOptions.set(monitorId, monitorOptions);
    
    // Create request and response record collections for this monitor
    this.capturedRequests.set(monitorId, []);
    this.capturedResponses.set(monitorId, []);
    
    // Create Promise Controller
    const controller = this.createPromiseController();
    this.monitorPromises.set(monitorId, controller);
    
    // Set timeout auto-cancel
    if (monitorOptions.timeout) {
      controller.timeoutId = setTimeout(() => {
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          // Decide whether to print detailed timeout logs based on silentTimeout option
          if (!monitorOptions.silentTimeout) {
            console.log(`[TaskID: ${this.taskId}] Monitor ${monitorId} timed out (${monitorOptions.timeout}ms)`);
          }
          
          // Use special timeout error object
          const timeoutError = new Error(`Monitor timed out (${monitorOptions.timeout}ms)`);
          // Add special mark indicating this is timeout error
          (timeoutError as any).isTimeout = true;
          
          // Mark as rejected and reject Promise
          currentController.isRejected = true;
          currentController.reject(timeoutError);
          
          // Note: Don't clean up monitor here, unified cleanup in waitForResponse method
        }
      }, monitorOptions.timeout);
    }
    
    // Return monitor ID for later tracking
    return monitorId;
  }

  /**
   * Monitor specific path HTTP requests
   * @param path API path to monitor, like '/v2/fungible/route'
   * @param method Optional HTTP method filter, like 'POST' (default monitor all methods)
   * @param monitorId Monitor ID, used for retrieving results later
   * @param options Monitor options, can specify one-time monitoring etc.
   * @returns Monitor ID
   */
  startMonitoringSpecificPath(
    path: string, 
    method: string = '', 
    monitorId: string = `path_monitor_${Date.now()}`,
    options: MonitorOptions = {}
  ): string {
    const defaultOptions: MonitorOptions = {
      oneTime: false,
      verbose: false,
      timeout: 30000,
      silentTimeout: false,  // Default don't handle timeout silently
      partialMatch: false    // Default use exact matching
    };
    
    const monitorOptions = { ...defaultOptions, ...options };
    console.log(`[TaskID: ${this.taskId}] Starting to specifically monitor${method ? ` ${method}` : ''} ${path} path requests (ID: ${monitorId})${monitorOptions.oneTime ? ', one-time monitoring' : ''}${monitorOptions.partialMatch ? ', partial match mode' : ', exact match mode'}`);
    
    // Record start time, monitor path and options
    this.monitorStartTimes.set(monitorId, Date.now());
    this.monitorPaths.set(monitorId, path);
    this.monitorOptions.set(monitorId, monitorOptions);
    
    // Create request and response record collections for this monitor
    this.capturedRequests.set(monitorId, []);
    this.capturedResponses.set(monitorId, []);
    
    // Create Promise Controller
    const controller = this.createPromiseController();
    this.monitorPromises.set(monitorId, controller);
    
    // Set timeout auto-cancel
    if (monitorOptions.timeout) {
      controller.timeoutId = setTimeout(() => {
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          // Decide whether to print detailed timeout logs based on silentTimeout option
          if (!monitorOptions.silentTimeout) {
            console.log(`[TaskID: ${this.taskId}] Monitor ${monitorId} timed out (${monitorOptions.timeout}ms)`);
          }
          
          // Use special timeout error object
          const timeoutError = new Error(`Monitor timed out (${monitorOptions.timeout}ms)`);
          // Add special mark indicating this is timeout error
          (timeoutError as any).isTimeout = true;
          
          // Mark as rejected and reject Promise
          currentController.isRejected = true;
          currentController.reject(timeoutError);
          
          // Note: Don't clean up monitor here, unified cleanup in waitForResponse method
        }
      }, monitorOptions.timeout);
    }
    
    // If one-time monitoring, set up Playwright's waitForResponse to assist monitoring
    if (monitorOptions.oneTime) {
      this.page.waitForResponse(
        (resp) => {
          const url = resp.url();
          const reqMethod = resp.request().method();
          
          // Check if URL matches target path, and whether meets method requirement
          // Use new partial matching method
          const isTargetPath = this.pathMatches(url, path, monitorOptions);
          const isMethodMatch = !method || reqMethod === method;
          
          // Return true if conditions met
          return isTargetPath && isMethodMatch;
        },
        { timeout: monitorOptions.timeout }
      ).then(response => {
        // Successfully captured response, resolve Promise
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          currentController.isResolved = true;
          currentController.resolve(response);
        }
      }).catch(error => {
        // Failed to capture response
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          // Check if it's timeout error
          const isTimeout = error.message && (
            error.message.includes('timeout') ||
            error.message.includes('timed out')
          );
          
          if (isTimeout) {
            // Use special timeout error object
            const timeoutError = new Error(`Monitor timed out (${monitorOptions.timeout}ms): ${error.message}`);
            // Add special mark indicating this is timeout error
            (timeoutError as any).isTimeout = true;
            
            currentController.isRejected = true;
            currentController.reject(timeoutError);
          } else {
            currentController.isRejected = true;
            currentController.reject(error);
          }
        }
      });
    }
    
    // Return monitor ID for later tracking
    return monitorId;
  }
  /**
   * Monitor specific RPC method calls, supports partial path matching
   * @param methodName RPC method name (e.g., "abci_query")
   * @param paramPath Parameter path (e.g., "/cosmos.tx.v1beta1.Service/Simulate" or just "Simulate")
   * @param monitorId Monitor ID
   * @param options Monitor options, can specify one-time monitoring etc.
   * @returns Monitor ID
   */
  startMonitoringRpcMethod(
    methodName: string, 
    paramPath: string, 
    monitorId: string = `rpc_monitor_${Date.now()}`,
    options: MonitorOptions = {}
  ): string {
    const defaultOptions: MonitorOptions = {
      oneTime: false,
      verbose: false,
      timeout: 30000,
      silentTimeout: false,  // Default don't handle timeout silently
      partialMatch: false    // Default use exact matching
    };
    
    const monitorOptions = { ...defaultOptions, ...options };
    console.log(`[TaskID: ${this.taskId}] Starting to monitor RPC method: ${methodName} and parameter path: ${paramPath} (ID: ${monitorId})${monitorOptions.oneTime ? ', one-time monitoring' : ''}${monitorOptions.partialMatch ? ', partial match mode' : ', exact match mode'}`);
    
    // Save RPC specific information, not just path
    this.monitorStartTimes.set(monitorId, Date.now());
    this.monitorPaths.set(monitorId, paramPath);
    this.monitorOptions.set(monitorId, monitorOptions);
    
    // Save additional RPC related information
    this.monitorMethods = this.monitorMethods || new Map();
    this.monitorMethods.set(monitorId, methodName);
    
    // Create request and response record collections for this monitor
    this.capturedRequests.set(monitorId, []);
    this.capturedResponses.set(monitorId, []);
    
    // Create Promise Controller
    const controller = this.createPromiseController();
    this.monitorPromises.set(monitorId, controller);
    
    // Set timeout auto-cancel
    if (monitorOptions.timeout) {
      controller.timeoutId = setTimeout(() => {
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          // Decide whether to print detailed timeout logs based on silentTimeout option
          if (!monitorOptions.silentTimeout) {
            console.log(`[TaskID: ${this.taskId}] Monitor ${monitorId} timed out (${monitorOptions.timeout}ms)`);
          }
          
          // Use special timeout error object
          const timeoutError = new Error(`Monitor timed out (${monitorOptions.timeout}ms)`);
          // Add special mark indicating this is timeout error
          (timeoutError as any).isTimeout = true;
          
          // Mark as rejected and reject Promise
          currentController.isRejected = true;
          currentController.reject(timeoutError);
        }
      }, monitorOptions.timeout);
    }
    
    // If one-time monitoring, set up Playwright's waitForResponse to assist monitoring
    if (monitorOptions.oneTime) {
      this.page.waitForResponse(
        async (resp) => {
          try {
            // Check if it's POST response
            if (resp.request().method() !== 'POST') {
              return false;
            }
            
            // Get request body data to check RPC method and parameters
            const request = resp.request();
            let requestBody;
            try {
              const postData = request.postData();
              if (!postData) return false;
              
              requestBody = JSON.parse(postData);
            } catch (e) {
              return false; // Not JSON or can't parse
            }
            
            // Check if matches RPC method
            if (requestBody.method !== methodName) {
              return false;
            }
            
            // Use new partial matching method to check parameter path
            if (!requestBody.params || !requestBody.params.path) {
              return false;
            }
            
            const pathMatches = this.pathMatches(requestBody.params.path, paramPath, monitorOptions);
            if (!pathMatches) {
              return false;
            }
            
            // Get response JSON
            let jsonResponse;
            try {
              jsonResponse = await resp.json();
            } catch (e) {
              return false; // Response not JSON
            }
            
            // Ensure response contains ID, and matches request ID
            if (!jsonResponse || typeof jsonResponse.id === 'undefined') {
              return false;
            }
            
            if (jsonResponse.id !== requestBody.id) {
              return false;
            }
            
            // All conditions match, this is the response we're looking for
            if (monitorOptions.verbose) {
              console.log(`[TaskID: ${this.taskId}] Matched RPC response: method=${methodName}, path=${requestBody.params.path}, id=${jsonResponse.id}, match mode: ${monitorOptions.partialMatch ? 'partial match' : 'exact match'}`);
            }
            
            return true;
          } catch (error) {
            return false;
          }
        },
        { timeout: monitorOptions.timeout }
      ).then(response => {
        // Successfully captured response, resolve Promise
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          currentController.isResolved = true;
          currentController.resolve(response);
        }
      }).catch(error => {
        // Failed to capture response
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          // Check if it's timeout error
          const isTimeout = error.message && (
            error.message.includes('timeout') ||
            error.message.includes('timed out')
          );
          
          if (isTimeout) {
            // Use special timeout error object
            const timeoutError = new Error(`Monitor timed out (${monitorOptions.timeout}ms): ${error.message}`);
            // Add special mark indicating this is timeout error
            (timeoutError as any).isTimeout = true;
            
            currentController.isRejected = true;
            currentController.reject(timeoutError);
          } else {
            currentController.isRejected = true;
            currentController.reject(error);
          }
        }
      });
    }
    
    // Return monitor ID for later tracking
    return monitorId;
  }

  /**
   * Wait for response captured by previously set monitor
   * @param monitorId Monitor ID
   * @param timeout Wait timeout (milliseconds)
   * @returns Object containing response result
   */
  async waitForResponse(monitorId: string, timeout: number = 30000): Promise<ApiResponseResult> {
    console.log(`[TaskID: ${this.taskId}] Waiting for monitor ${monitorId} response...`);
    
    // Check if monitor exists
    if (!this.monitorPromises.has(monitorId)) {
      return {
        success: false,
        data: null,
        responseTime: 0,
        error: `Monitor ${monitorId} does not exist`
      };
    }
    
    // Get monitor controller and start time
    const controller = this.monitorPromises.get(monitorId)!;
    const startTime = this.monitorStartTimes.get(monitorId) || Date.now();
    const options = this.monitorOptions.get(monitorId) || {};
    
    // Get monitored RPC method and parameter path (if any)
    const methodName = this.monitorMethods ? this.monitorMethods.get(monitorId) : undefined;
    const paramPath = this.monitorPaths.get(monitorId);
    
    // If RPC monitoring, print more detailed logs
    if (methodName && paramPath) {
      console.log(`[TaskID: ${this.taskId}] Waiting for RPC call: method=${methodName}, path=${paramPath}, match mode: ${options.partialMatch ? 'partial match' : 'exact match'}`);
    }
    
    try {
      // Set timeout
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => {
          // Use special timeout error object
          const timeoutError = new Error(`Waiting for response timed out (${timeout}ms)`);
          // Add special mark indicating this is timeout error
          (timeoutError as any).isTimeout = true;
          
          reject(timeoutError);
        }, timeout);
      });
      
      // Wait for response or timeout
      let response: any;
      
      if (!options.oneTime) {
        // For non-one-time monitoring, use waitForResponse function
        const responsePromise = this.page.waitForResponse(
          async (resp) => {
            try {
              const url = resp.url();
              const reqMethod = resp.request().method();
              
              // If RPC monitoring, need special handling
              if (methodName && paramPath && reqMethod === 'POST') {
                // Get request body data to check RPC method and parameters
                const request = resp.request();
                let requestBody;
                try {
                  const postData = request.postData();
                  if (!postData) return false;
                  
                  requestBody = JSON.parse(postData);
                } catch (e) {
                  return false; // Not JSON or can't parse
                }
                
                // Check if matches RPC method
                if (requestBody.method !== methodName) {
                  return false;
                }
                
                // Use new partial matching method to check parameter path
                if (!requestBody.params || !requestBody.params.path) {
                  return false;
                }
                
                const pathMatches = this.pathMatches(requestBody.params.path, paramPath, options);
                if (!pathMatches) {
                  return false;
                }
                
                // Get response JSON
                let jsonResponse;
                try {
                  jsonResponse = await resp.json();
                } catch (e) {
                  return false; // Response not JSON
                }
                
                // Ensure response contains ID, and matches request ID
                if (!jsonResponse || typeof jsonResponse.id === 'undefined') {
                  return false;
                }
                
                if (jsonResponse.id !== requestBody.id) {
                  return false;
                }
                
                // All conditions match, this is the response we're looking for
                if (options.verbose) {
                  console.log(`[TaskID: ${this.taskId}] Matched RPC response: method=${methodName}, path=${requestBody.params.path}, id=${jsonResponse.id}, match mode: ${options.partialMatch ? 'partial match' : 'exact match'}`);
                }
                
                return true;
              } else {
                // Regular monitoring, use URL matching
                return paramPath ? this.pathMatches(url, paramPath, options) : false;
              }
            } catch (error) {
              return false;
            }
          },
          { timeout }
        );
        
        response = await Promise.race([responsePromise, timeoutPromise]);
      } else {
        // For one-time monitoring, use already created Promise
        response = await Promise.race([controller.promise, timeoutPromise]);
      }
      
      // Calculate response time
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Get response details
      const url = response.url();
      const status = response.status();
      const reqMethod = response.request().method();
      
      console.log(`[TaskID: ${this.taskId}] Successfully captured response:`);
      console.log(`  URL: ${url}`);
      console.log(`  Status code: ${status}`);
      console.log(`  Response time: ${responseTime}ms`);
      
      // Try to parse response JSON
      let responseData = null;
      let requestId = undefined;
      
      try {
        // If POST request, might be RPC response
        if (reqMethod === 'POST') {
          // Try to get request body
          let requestBody = null;
          try {
            const postData = response.request().postData();
            if (postData) {
              requestBody = JSON.parse(postData);
            }
          } catch (e) {
            // Ignore parse error
          }
          
          // Try to parse as JSON first
          try {
            responseData = await response.json();
            console.log(`[TaskID: ${this.taskId}] Successfully parsed JSON response`);
            
            // Check if it's RPC response
            if (responseData && typeof responseData.id !== 'undefined' && requestBody) {
              console.log(`[TaskID: ${this.taskId}] Successfully identified RPC response`);
              requestId = responseData.id;
              
              if (options.verbose) {
                // Print detailed response content
                const jsonStr = JSON.stringify(responseData, null, 2);
                // If response too long, only print first 500 characters
                if (jsonStr.length > 500) {
                  //console.log(`[TaskID: ${this.taskId}] RPC response content:\n${jsonStr.substring(0, 500)}...(content truncated)`);
                } else {
                  //console.log(`[TaskID: ${this.taskId}] RPC response content:\n${jsonStr}`);
                }
              }
            }
          } catch (e) {
            // Try to get text response
            responseData = await response.text();
            
            if (options.verbose) {
              // If response too long, only print first 500 characters
              if (responseData.length > 500) {
                console.log(`[TaskID: ${this.taskId}] Response content (text):\n${responseData.substring(0, 500)}...(content truncated)`);
              } else {
                console.log(`[TaskID: ${this.taskId}] Response content (text):\n${responseData}`);
              }
            }
          }
        } else {
          // Non-POST request, try to parse as JSON or text
          try {
            responseData = await response.json();
          } catch (e) {
            responseData = await response.text();
          }
        }
      } catch (e) {
        console.log(`[TaskID: ${this.taskId}] Error parsing response content: ${e}`);
      }
      
      // Success then blocking cleanup monitor
      this.cleanupMonitor(monitorId);
      
      // Return result
      return {
        success: true,
        data: responseData,
        responseTime,
        url,
        status,
        method: reqMethod,
        requestId,
        rawResponse: response,
        timedOut: false
      };
    } catch (error: any) {
      // Calculate time waited
      const endTime = Date.now();
      const waitedTime = endTime - startTime;
      
      // Check if it's timeout error
      const isTimeout = (error.isTimeout === true) || 
                      (error.message && (
                        error.message.includes('timeout') || 
                        error.message.includes('timed out')
                      ));
      
      const errorMessage = error.message || 'Unknown error';
      if (isTimeout) {
        // For timeout error, provide graceful handling
        if (!options.silentTimeout) {
          console.log(`[TaskID: ${this.taskId}] Waiting for response timed out: ${errorMessage}`);
        }
      } else {
        console.log(`[TaskID: ${this.taskId}] Error waiting for response: ${errorMessage}`);
      }
      
      // Error then also blocking cleanup monitor
      this.cleanupMonitor(monitorId);
      
      // Return result with timeout flag
      return {
        success: false,
        data: null,
        responseTime: waitedTime,
        error: errorMessage,
        timedOut: isTimeout  // Mark whether ended due to timeout
      };
    }
  }
  /**
   * Clean up monitor resources - Blocking method
   */
  private cleanupMonitor(monitorId: string): void {
    console.log(`[TaskID: ${this.taskId}] Cleaning up monitor: ${monitorId}`);
    
    // Cancel timeout timer
    const controller = this.monitorPromises.get(monitorId);
    if (controller && controller.timeoutId !== undefined) {
      clearTimeout(controller.timeoutId);
    }
    
    this.monitorPromises.delete(monitorId);
    this.monitorStartTimes.delete(monitorId);
    this.monitorPaths.delete(monitorId);
    this.monitorOptions.delete(monitorId);
    
    // Clean up RPC method record
    if (this.monitorMethods) {
      this.monitorMethods.delete(monitorId);
    }
    
    // Keep capture records for debugging, don't delete
  }

  /**
   * Cancel specific monitor - Blocking method
   */
  cancelMonitor(monitorId: string): void {
    if (this.monitorPromises.has(monitorId)) {
      console.log(`[TaskID: ${this.taskId}] Canceling monitor: ${monitorId}`);
      this.cleanupMonitor(monitorId);
    }
  }

  /**
   * Cancel all monitors - Blocking method
   */
  cancelAllMonitors(): void {
    console.log(`[TaskID: ${this.taskId}] Canceling all monitors`);
    for (const monitorId of this.monitorPromises.keys()) {
      this.cleanupMonitor(monitorId);
    }
  }

  /**
   * Get current active monitor count
   */
  getActiveMonitorsCount(): number {
    return this.monitorPromises.size;
  }

  /**
   * Get all current active monitor IDs
   */
  getActiveMonitorIds(): string[] {
    return Array.from(this.monitorPromises.keys());
  }

  /**
   * Get all captured network traffic
   */
  getAllTraffic(): { requests: any[], responses: any[] } {
    return {
      requests: this.capturedRequests.get('all') || [],
      responses: this.capturedResponses.get('all') || []
    };
  }
  
  /**
   * Get network traffic captured by specific monitor
   * @param monitorId Monitor ID
   */
  getMonitorTraffic(monitorId: string): { requests: any[], responses: any[] } {
    return {
      requests: this.capturedRequests.get(monitorId) || [],
      responses: this.capturedResponses.get(monitorId) || []
    };
  }

  /**
   * Clear captured traffic data
   * @param monitorId Optional monitor ID, if not provided then clear all data
   */
  clearTrafficData(monitorId?: string): void {
    if (monitorId) {
      console.log(`[TaskID: ${this.taskId}] Clearing traffic data for monitor ${monitorId}`);
      this.capturedRequests.set(monitorId, []);
      this.capturedResponses.set(monitorId, []);
    } else {
      console.log(`[TaskID: ${this.taskId}] Clearing all traffic data`);
      for (const id of this.capturedRequests.keys()) {
        this.capturedRequests.set(id, []);
      }
      for (const id of this.capturedResponses.keys()) {
        this.capturedResponses.set(id, []);
      }
    }
  }
  
  /**
   * Check if there are active monitors
   */
  hasActiveMonitors(): boolean {
    return this.monitorPromises.size > 0;
  }

  /**
   * Monitor broadcast transaction RPC methods - Specially handle broadcast_tx_sync etc. RPC calls without path
   * @param methodName RPC method name (e.g., "broadcast_tx_sync")
   * @param monitorId Monitor ID
   * @param options Monitor options
   * @returns Monitor ID
   */
  startMonitoringBroadcastRPC(
    methodName: string,
    monitorId: string = `broadcast_monitor_${Date.now()}`,
    options: MonitorOptions = {}
  ): string {
    const defaultOptions: MonitorOptions = {
      oneTime: true,
      verbose: true,
      timeout: 30000,
      silentTimeout: false
    };
    
    const monitorOptions = { ...defaultOptions, ...options };
    console.log(`[TaskID: ${this.taskId}] Starting to monitor broadcast transaction RPC method: ${methodName} (ID: ${monitorId})${monitorOptions.oneTime ? ', one-time monitoring' : ''}`);
    
    // Save RPC specific information
    this.monitorStartTimes.set(monitorId, Date.now());
    // Use null to indicate no need to match path
    this.monitorPaths.set(monitorId, '');
    this.monitorOptions.set(monitorId, monitorOptions);
    
    // Save RPC method name
    this.monitorMethods = this.monitorMethods || new Map();
    this.monitorMethods.set(monitorId, methodName);
    
    // Create request and response record collections
    this.capturedRequests.set(monitorId, []);
    this.capturedResponses.set(monitorId, []);
    
    // Create Promise Controller
    const controller = this.createPromiseController();
    this.monitorPromises.set(monitorId, controller);
    
    // Set timeout auto-cancel
    if (monitorOptions.timeout) {
      controller.timeoutId = setTimeout(() => {
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          if (!monitorOptions.silentTimeout) {
            console.log(`[TaskID: ${this.taskId}] Monitor ${monitorId} timed out (${monitorOptions.timeout}ms)`);
          }
          
          const timeoutError = new Error(`Monitor timed out (${monitorOptions.timeout}ms)`);
          (timeoutError as any).isTimeout = true;
          
          currentController.isRejected = true;
          currentController.reject(timeoutError);
        }
      }, monitorOptions.timeout);
    }
    
    // If one-time monitoring, use Playwright's waitForResponse
    if (monitorOptions.oneTime) {
      this.page.waitForResponse(
        async (resp) => {
          try {
            // Check if it's POST response
            if (resp.request().method() !== 'POST') {
              return false;
            }
            
            // Get request body data
            const request = resp.request();
            let requestBody;
            try {
              const postData = request.postData();
              if (!postData) return false;
              
              requestBody = JSON.parse(postData);
            } catch (e) {
              return false; // Not JSON or can't parse
            }
            
            // Check if matches RPC method
            if (requestBody.method !== methodName) {
              return false;
            }
            
            // Get response JSON
            let jsonResponse;
            try {
              jsonResponse = await resp.json();
            } catch (e) {
              return false; // Response not JSON
            }
            
            // Ensure response contains ID, and matches request ID
            if (!jsonResponse || typeof jsonResponse.id === 'undefined') {
              return false;
            }
            
            if (jsonResponse.id !== requestBody.id) {
              return false;
            }
            
            // All conditions match, this is the response we're looking for
            if (monitorOptions.verbose) {
              console.log(`[TaskID: ${this.taskId}] Matched RPC response: method=${methodName}, id=${jsonResponse.id}`);
              console.log(`[TaskID: ${this.taskId}] Response result: ${JSON.stringify(jsonResponse.result)}`);
            }
            
            return true;
          } catch (error) {
            return false;
          }
        },
        { timeout: monitorOptions.timeout }
      ).then(response => {
        // Successfully captured response, resolve Promise
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          currentController.isResolved = true;
          currentController.resolve(response);
        }
      }).catch(error => {
        // Failed to capture response
        const currentController = this.monitorPromises.get(monitorId);
        if (currentController && !currentController.isResolved && !currentController.isRejected) {
          // Check if it's timeout error
          const isTimeout = error.message && (
            error.message.includes('timeout') ||
            error.message.includes('timed out')
          );
          
          if (isTimeout) {
            // Use special timeout error object
            const timeoutError = new Error(`Monitor timed out (${monitorOptions.timeout}ms): ${error.message}`);
            // Add special mark indicating this is timeout error
            (timeoutError as any).isTimeout = true;
            
            currentController.isRejected = true;
            currentController.reject(timeoutError);
          } else {
            currentController.isRejected = true;
            currentController.reject(error);
          }
        }
      });
    }
    
    return monitorId;
  }

  /**
   * Process broadcast transaction response - Extract transaction hash and check success status
   * @param result Monitor returned API response result
   * @returns Processing result, including transaction hash and whether successful
   */
  processBroadcastResponse(result: ApiResponseResult): { 
    success: boolean; 
    hash?: string; 
    error?: string;
  } {
    console.log(`[TaskID: ${this.taskId}] Processing broadcast transaction response...`);
    
    // If failed to get response
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to get response"
      };
    }
    
    try {
      // Extract and verify JSON-RPC result
      const responseData = result.data;
      
      if (!responseData.result) {
        return {
          success: false,
          error: "No result field in response"
        };
      }
      
      // Check transaction result code
      const code = responseData.result.code;
      console.log(`[TaskID: ${this.taskId}] Transaction return code: ${code}`);
      
      if (code === 0) {
        // Transaction successful, extract hash
        const hash = responseData.result.hash;
        if (hash) {
          console.log(`[TaskID: ${this.taskId}] Successfully extracted transaction hash: ${hash}`);
          return {
            success: true,
            hash: hash
          };
        } else {
          console.log(`[TaskID: ${this.taskId}] Transaction successful but hash not found`);
          return {
            success: true
          };
        }
      } else {
        // Transaction failed
        const log = responseData.result.log || "Unknown error";
        console.log(`[TaskID: ${this.taskId}] Transaction failed: ${log}`);
        return {
          success: false,
          error: `Transaction failed (code=${code}): ${log}`
        };
      }
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Error processing broadcast transaction response: ${error.message}`);
      return {
        success: false,
        error: `Error processing transaction response: ${error.message}`
      };
    }
  }
}
