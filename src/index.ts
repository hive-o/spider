import { BrowserContext, Navigation, Page, WeberBrowser } from '@hive-o/weber';
import * as DEBUG from 'debug';

export class Spider {
  public readonly navigation: Navigation;
  public readonly weberBrowser: WeberBrowser;

  constructor() {
    this.navigation = Navigation.instance();
    this.weberBrowser = WeberBrowser.instance();
  }

  private async crawl(address: string, context: BrowserContext) {
    const debug = DEBUG('spider:crawl');

    debug(`starting ${address}`);
    const url = new URL(address);
    this.navigation.set(url);

    const page = await context.newPage();

    page.on('request', (request) => {
      const newUrl = new URL(request.url());

      debug(`request detected: ${request.url()}`);
      if (!this.navigation.has(newUrl)) {
        this.navigation.set(newUrl);
      }
    });

    await page.goto(address);
    await this.recordNavigations(page);
  }

  private async recordNavigations(page: Page) {
    const debug = DEBUG('spider:record:navigations');
    const clickableSelector = `[type="submit"], button, [on-click], a`;
    const clickableElements = await page.$$(clickableSelector);

    debug(`detected clickable elements: ${clickableElements.length}`);
    for (const button of clickableElements) {
      await button.click();

      try {
        await page.waitForNavigation({ timeout: 10000 });
      } catch (error) {
        console.warn('Navigation timeout:', error);
      }

      const newUrl = new URL(page.url());

      if (this.navigation.has(newUrl)) {
        this.navigation.set(newUrl);
        await page.goBack();
        continue;
      }

      this.navigation.set(newUrl);
      await this.recordNavigations(page);
      await page.goBack();
    }
  }

  async start(initial_urls: string[]) {
    await this.weberBrowser.launch();
    const context = this.weberBrowser.context;

    for (const address of initial_urls) {
      await this.crawl(address, context);
    }

    await this.weberBrowser.close();
  }
}
