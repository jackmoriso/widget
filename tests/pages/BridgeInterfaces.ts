// tests/pages/BridgeInterfaces.ts

/**
 * API Response Record Interface
 */
export interface ApiResponseRecord {
  endpoint?: string;     // API endpoint
  method?: string;       // HTTP method
  status?: number;       // Status code
  success: boolean;      // Whether successful
  data: any;            // Response data
  timestamp?: number;    // Response timestamp
  responseTime?: number; // Response time
}

/**
 * Bridge Operation Output Interface
 */
export interface BridgeOperationOutput {
  success: boolean;         // Whether operation was successful
  transactionHash?: string; // Transaction hash when successful
  error?: string;          // Error message when failed
  
  // Test status related fields
  testProgress?: 'untested' | 'routeTested' | 'SignTested'; // Test progress status
  routePass?: boolean;      // Whether route test passed
  
  // API response results - supports multiple API response records
  apiResponses?: {
    [key: string]: ApiResponseRecord; // Store multiple API responses, key is response ID or name
  };
  
  // Preview stage information
  preview?: {
    outputAmount?: string;  // Output amount
    error?: string;        // Error message
    warning?: string;      // Warning message
    estimatedDuration?: string; // Estimated duration
    slippage?: string;     // Slippage percentage
    priceImpact?: string;  // Price impact
    fee?: string;          // Fee
    gasfee?: string;       // Gas fee
    [key: string]: any;    // Other preview information
  };
  
  // Confirmation stage information
  confirmation?: {
    confirmationTime?: string; // Confirmation time
    gasUsed?: string;         // Gas used
    [key: string]: any;       // Other confirmation stage information
  };
  
  // Timing information
  timing?: {
    startTime: number;      // Start timestamp
    endTime: number;        // End timestamp
    duration: number;       // Duration (milliseconds)
    apiResponseTime?: number; // API response time (milliseconds)
    [key: string]: any;     // Other timing related information
  };
  
  // Screenshot paths
  screenshots?: string[];   // List of operation process screenshot paths
}

/**
 * Bridge Operation Input Interface
 */
export interface BridgeOperationInput {
  amount: string;           // Transfer amount
  fromChain: string;        // Source chain name
  fromToken: string;        // Source token symbol
  toChain: string;          // Target chain name
  toToken: string;          // Target token symbol
  routeType?: string;       // Route type, such as "Minitswap" or "Optimistic bridge"
  targetAddress?: string;   // Optional target address
}