// tests/pages/BasePage.ts
import { Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';

/**
 * Base Page Class - Contains common page operations and helper methods
 */
export class BasePage {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly baseUrl: string;
  readonly taskId: string;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
    
    // Get baseUrl from environment variable, use default if not set
    this.baseUrl = process.env.TEST_URL || 'https://initia-widget-playground.vercel.app/';
    this.taskId = process.env.TASKID || '0';
    console.log(`[TaskID: ${this.taskId}] BasePage initialized, Base URL: ${this.baseUrl}`);
  }

  /**
   * Navigate to application homepage
   */
  async navigateToHomePage(url?: string): Promise<void> {
    // Use provided URL if available, otherwise use baseUrl
    const targetUrl = url || this.baseUrl;
    console.log(`[TaskID: ${this.taskId}] Navigating to homepage: ${targetUrl}`);
    
    await this.page.goto(targetUrl, { 
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });
    
    await this.page.waitForLoadState('networkidle', { timeout: 20000 })
      .catch(() => console.log(`[TaskID: ${this.taskId}] Network not completely idle, continuing test`));
    
    // Take screenshot
    await this.takeScreenshot('home-page');
    
    const pageTitle = await this.page.title();
    console.log(`[TaskID: ${this.taskId}] Page loaded, title: ${pageTitle}`);
  }

  /**
   * Create screenshot with task ID
   */
  async takeScreenshot(name: string): Promise<void> {
    try {
      if (!fs.existsSync('./screenshots')) {
        fs.mkdirSync('./screenshots', { recursive: true });
      }
      
      // Add task ID to filename
      const fileName = name.includes(`task-${this.taskId}`) 
        ? `${name}.png` 
        : `${name}-task-${this.taskId}.png`;
      
      await this.page.screenshot({ path: `./screenshots/${fileName}` });
      console.log(`[TaskID: ${this.taskId}] Screenshot saved: ./screenshots/${fileName}`);
    } catch (error: any) {
      console.log(`[TaskID: ${this.taskId}] Failed to create screenshot: ${error.message}`);
    }
  }
  
  /**
   * Wait for element to be visible
   */
  async waitForVisible(selector: string, timeout: number = 10000): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      await element.waitFor({ state: 'visible', timeout });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Wait for page to load
   */
  async waitForPageLoad(timeout: number = 10000): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout })
      .catch(() => console.log(`[TaskID: ${this.taskId}] Page load timeout, continuing execution`));
      
    await this.page.waitForLoadState('networkidle', { timeout: 5000 })
      .catch(() => console.log(`[TaskID: ${this.taskId}] Network not completely idle, continuing execution`));
  }
  
  /**
   * Print debug information
   */
  async printDebugInfo(message?: string): Promise<void> {
    if (message) {
      console.log(`[TaskID: ${this.taskId}] [Debug] ${message}`);
    }
    
    console.log(`[TaskID: ${this.taskId}] [Debug] Current URL: ${this.page.url()}`);
    
    try {
      const title = await this.page.title();
      console.log(`[TaskID: ${this.taskId}] [Debug] Page Title: ${title}`);
    } catch (error) {
      console.log(`[TaskID: ${this.taskId}] [Debug] Unable to get page title`);
    }
  }
  
  /**
   * Wait timeout
   */
  async wait(ms: number): Promise<void> {
    return this.page.waitForTimeout(ms);
  }
}