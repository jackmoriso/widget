// tests/utils/ApiResponseHandler.ts
import { ApiResponseRecord, BridgeOperationOutput } from '../pages/BridgeInterfaces';

/**
 * API Response Handler Class - Used for processing and recording API responses
 */
export class ApiResponseHandler {
  private taskId: string;
  
  constructor(taskId: string = '0') {
    this.taskId = taskId;
  }
  
  /**
   * Record API response
   * @param result Operation result object
   * @param apiResult API monitor returned result
   * @param responseKey Response unique identifier/name
   * @param endpoint API endpoint name
   */
  recordApiResponse(
    result: BridgeOperationOutput, 
    apiResult: any, 
    responseKey: string,
    endpoint: string = ''
  ): void {
    // Ensure apiResponses object is initialized
    if (!result.apiResponses) {
      result.apiResponses = {};
    }
    
    // Build API response record
    const responseRecord: ApiResponseRecord = {
      endpoint: endpoint,
      method: apiResult.method || 'POST',
      status: apiResult.status || 0,
      success: apiResult.success || false,
      data: apiResult.data || null,
      timestamp: Date.now(),
      responseTime: apiResult.responseTime || 0
    };
    
    // Record to result object
    result.apiResponses[responseKey] = responseRecord;
    
    // Output log
    console.log(`[TaskID: ${this.taskId}] Recorded API response: ${responseKey}, Endpoint: ${endpoint}, Status: ${responseRecord.status}, Success: ${responseRecord.success}`);
  }
  
  /**
   * Check if "no routes found" error exists
   * @param apiResult API monitor returned result
   * @returns Whether "no routes found" error exists
   */
  hasNoRoutesFoundError(apiResult: any): boolean {
    if (!apiResult) return false;
    
    // Check if it's specific error case - 404 status code and "no routes found" message
    const hasNoRoutesError = 
      (apiResult.status === 404 || !apiResult.success) && 
      apiResult.data && (
        (typeof apiResult.data === 'object' && 
         (apiResult.data.message === "no routes found" || 
          (apiResult.data.code === 5 && apiResult.data.message === "no routes found"))) ||
        (typeof apiResult.data === 'string' && 
         apiResult.data.includes("no routes found"))
      );
    
    if (hasNoRoutesError) {
      console.log(`[TaskID: ${this.taskId}] Detected Route API error: no routes found`);
    }
    
    return hasNoRoutesError;
  }
  
  /**
   * Handle Route API response
   * @param result Operation result object
   * @param apiResult API monitor returned result
   * @returns Whether operation should be aborted
   */
  handleRouteApiResponse(
    result: BridgeOperationOutput, 
    apiResult: any
  ): boolean {
    // Record API response
    this.recordApiResponse(result, apiResult, 'route', '/v2/fungible/route');
    
    // Check status code - Any non-201 considered error
    if (apiResult.status !== 201) {
      console.log(`[TaskID: ${this.taskId}] Route API returned non-201 status code: ${apiResult.status}`);
      
      // Extract error message
      let errorMessage = "";
      
      // Try to get error message from response
      if (apiResult.data) {
        try {
          // If string, might need parsing
          if (typeof apiResult.data === 'string') {
            try {
              const parsedData = JSON.parse(apiResult.data);
              errorMessage = JSON.stringify(parsedData);
            } catch (e) {
              // If not JSON string, use original string directly
              errorMessage = apiResult.data;
            }
          } 
          // If object, convert to string directly
          else if (typeof apiResult.data === 'object') {
            errorMessage = JSON.stringify(apiResult.data);
          }
        } catch (e) {
          errorMessage = `Unable to parse error response: ${e}`;
        }
      }
      
      // If no specific error message extracted, use generic error
      if (!errorMessage) {
        errorMessage = `Route API request failed, status code: ${apiResult.status}`;
      }
      
      // Check if it's "no routes found" type error
      if (this.hasNoRoutesFoundError(apiResult)) {
        errorMessage = "no routes found";
      }
      
      // Update result object
      result.error = errorMessage;
      result.testProgress = "routeTested";
      result.routePass = false;
      
      // Return true indicating should abort operation
      return true;
    }
    
    // Even if status code is 201, also check if content contains error message
    if (apiResult.data && typeof apiResult.data === 'object') {
      const dataStr = JSON.stringify(apiResult.data);
      if (dataStr.includes("error") || dataStr.includes("Error")) {
        console.log(`[TaskID: ${this.taskId}] Route API response contains error message`);
        
        // Update result object
        result.error = JSON.stringify(apiResult.data);
        result.testProgress = "routeTested";
        result.routePass = false;
        
        return true;
      }
    }
    
    // If no error, update test status to route tested and passed
    result.testProgress = "routeTested";
    result.routePass = true;
    
    // Return false indicating can continue operation
    return false;
  }

  /**
   * Handle Messages API response
   * @param result Operation result object
   * @param apiResult API monitor returned result
   * @returns Whether operation should be aborted
   */
  handleMsgsApiResponse(
    result: BridgeOperationOutput, 
    apiResult: any
  ): boolean {
    // Record API response
    this.recordApiResponse(result, apiResult, 'msgs', '/v2/fungible/msgs');
    
    // Check status code - Any non-201 considered error
    if (apiResult.status !== 201) {
      console.log(`[TaskID: ${this.taskId}] Messages API returned non-201 status code: ${apiResult.status}`);
      
      // Extract error message
      let errorMessage = "";
      
      // Try to get error message from response
      if (apiResult.data) {
        try {
          // If string, might need parsing
          if (typeof apiResult.data === 'string') {
            try {
              const parsedData = JSON.parse(apiResult.data);
              errorMessage = JSON.stringify(parsedData);
            } catch (e) {
              // If not JSON string, use original string directly
              errorMessage = apiResult.data;
            }
          } 
          // If object, convert to string directly
          else if (typeof apiResult.data === 'object') {
            errorMessage = JSON.stringify(apiResult.data);
          }
        } catch (e) {
          errorMessage = `Unable to parse error response: ${e}`;
        }
      }
      
      // If no specific error message extracted, use generic error
      if (!errorMessage) {
        errorMessage = `Messages API request failed, status code: ${apiResult.status}`;
      }
      
      // Update result object
      result.error = errorMessage;
      console.log(`[TaskID: ${this.taskId}] Messages API error: ${errorMessage}`);
      
      // Return true indicating should abort operation
      return true;
    }
    
    // Even if status code is 201, also check if content contains error message
    if (apiResult.data && typeof apiResult.data === 'object') {
      const dataStr = JSON.stringify(apiResult.data);
      if (dataStr.includes("error") || dataStr.includes("Error")) {
        console.log(`[TaskID: ${this.taskId}] Messages API response contains error message`);
        
        // Update result object
        result.error = JSON.stringify(apiResult.data);
        
        return true;
      }
    }
    
    // Handle successful case, extract useful information
    if (apiResult.success && apiResult.data) {
      try {
        const data = apiResult.data;
        
        // Ensure preview object initialized
        if (!result.preview) result.preview = {};
        
        // Extract fee information
        if (data.fee) {
          result.preview.fee = typeof data.fee === 'object' ? 
            JSON.stringify(data.fee) : String(data.fee);
        }
        
        // Extract estimated duration
        if (data.estimatedDuration) {
          result.preview.estimatedDuration = String(data.estimatedDuration);
        }
        
        // Extract txs related information, if exists
        if (data.txs && data.txs.length > 0) {
          // Extract chain_id information
          const chainId = data.txs[0]?.cosmos_tx?.chain_id;
          if (chainId) {
            result.preview.chainId = chainId;
          }
          
          // Extract path information
          const path = data.txs[0]?.cosmos_tx?.path;
          if (path && Array.isArray(path)) {
            result.preview.path = path.join(' -> ');
          }
          
          // Extract signer address
          const signerAddress = data.txs[0]?.cosmos_tx?.signer_address;
          if (signerAddress) {
            result.preview.signerAddress = signerAddress;
          }
          
          // Extract message count
          const msgsCount = data.txs[0]?.cosmos_tx?.msgs?.length;
          if (msgsCount) {
            result.preview.msgsCount = msgsCount;
          }
        }
        
        console.log(`[TaskID: ${this.taskId}] Successfully extracted Messages API information`);
      } catch (error) {
        // Correctly handle unknown type error
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`[TaskID: ${this.taskId}] Error processing messages API response: ${errorMessage}`);
      }
    }
    
    // Return false indicating can continue operation
    return false;
  }
}