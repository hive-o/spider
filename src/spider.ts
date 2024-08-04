import { Middleware } from '@hive-o/middleware';
import { BrowserContext, Navigation, Page, WeberBrowser } from '@hive-o/weber';
import * as DEBUG from 'debug';
import { isEmpty } from 'lodash';

export class Spider extends Middleware<{ selector: string; urls: string[] }> {
  public readonly navigation: Navigation;
  public readonly weberBrowser: WeberBrowser;

  constructor() {
    super();

    this.navigation = Navigation.instance();
    this.weberBrowser = WeberBrowser.instance();

    this.use(async (context, cb) => {
      const debug = DEBUG('spider');

      debug(`starting`);
      await cb();

      debug(`running on ${context.urls.length} url(s)`);
      if (isEmpty(context.urls)) {
        throw new Error('context.urls is empty');
      }

      if (isEmpty(context.selector)) {
        context.selector = '';
      }

      context.selector += `[type="submit"], button, [on-click], a`;

      await this.weberBrowser.launch();
      const browserContext = this.weberBrowser.context;

      for (const address of context.urls) {
        await this.crawl(address, browserContext);
      }

      debug('closing weber browser');
      await this.weberBrowser.close();

      debug('completed');
    });
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
    const clickableSelector = this.context.selector;
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
}
