import { BrowserContext, Navigation, Page, WeberBrowser } from '@hive-o/weber';

export class Spider {
  public readonly navigation: Navigation;
  public readonly weber_browser: WeberBrowser;

  constructor() {
    this.navigation = Navigation.instance();
    this.weber_browser = WeberBrowser.instance();
  }

  private async crawl(address: string, context: BrowserContext) {
    const url = new URL(address);
    this.navigation.set(url);

    const page = await context.newPage();

    page.on('request', (request) => {
      const newUrl = new URL(request.url());

      if (!this.navigation.has(newUrl)) {
        this.navigation.set(newUrl);
      }
    });

    await page.goto(address);
    await this.record_navigations(page);
  }

  private async record_navigations(page: Page) {
    const clickable_selector = `[type="submit"], button, [on-click], a`;
    const clickable_els = await page.$$(clickable_selector);

    for (const button of clickable_els) {
      await button.click();

      try {
        await page.waitForNavigation({ timeout: 10000 });
      } catch (error) {
        console.warn('Navigation timeout:', error);
      }

      const new_url = new URL(page.url());

      if (this.navigation.has(new_url)) {
        this.navigation.set(new_url);
        await page.goBack();
        continue;
      }

      this.navigation.set(new_url);
      await this.record_navigations(page);
      await page.goBack();
    }
  }

  async start(initial_urls: string[]) {
    await this.weber_browser.launch();
    const context = this.weber_browser.context;

    for (const address of initial_urls) {
      await this.crawl(address, context);
    }

    await this.weber_browser.close();
  }
}
