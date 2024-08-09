import { Middleware } from '@hive-o/middleware';
import { BrowserContext, Navigation, Page, WeberBrowser } from '@hive-o/weber';
import * as DEBUG from 'debug';
import { isEmpty } from 'lodash';

import { SpiderContext } from './context';

export class Spider extends Middleware<SpiderContext> {
  private readonly debug = DEBUG('spider');

  public readonly navigation: Navigation;
  public readonly weberBrowser: WeberBrowser;

  constructor() {
    super();

    this.navigation = Navigation.instance();
    this.weberBrowser = WeberBrowser.instance();

    this.use(async (context, next) => {
      if (isEmpty(context.uri)) {
        throw new Error('context.uri is empty');
      }

      this.debug(`starting ${context.uri}`);
      context.selectors = ['[type="submit"]', 'button', '[on-click]'];
      context.depth = 2;
      await next();

      this.debug(`completed ${context.uri}`);
    });

    this.use(async (context, next) => {
      await next();

      this.debug(`launching browser`);
      await this.weberBrowser.launch();

      const browserContext = this.weberBrowser.context;
      await this.crawl(context.uri, browserContext);

      this.debug('closing weber browser');
      await this.weberBrowser.close();
    });
  }

  private async crawl(
    address: string,
    context: BrowserContext,
    currentDepth = 0
  ) {
    const debug = DEBUG('spider:crawl');

    debug(`crawling ${address}`);
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
    await this.recordNavigations(page, currentDepth);
  }

  private async recordNavigations(page: Page, currentDepth: number) {
    if (currentDepth >= (this.context.depth ?? Infinity)) {
      // Check depth limit
      return;
    }

    const debug = DEBUG('spider:record:navigations');
    const clickableSelector = this.context.selectors.join(',');
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
        debug(`${newUrl} already crawled`);
        this.navigation.set(newUrl);
        await page.goBack();
        continue;
      }

      debug(`saving new navigation: ${newUrl}`);
      this.navigation.set(newUrl);
      await this.recordNavigations(page, currentDepth + 1); // Increment depth
      await page.goBack();
    }
  }
}
