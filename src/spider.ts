import { ArtaxContext, Navigation } from '@hive-o/artax-common';
import { Middleware, Next } from '@hive-o/middleware';
import { BrowserContext, Page, WeberBrowser } from '@hive-o/weber';
import * as DEBUG from 'debug';
import { isEmpty } from 'lodash';

export class Spider extends Middleware {
  private _navigation: Navigation;

  public readonly weberBrowser: WeberBrowser;

  constructor(private readonly _timeout = 120000) {
    super();

    this.weberBrowser = WeberBrowser.instance();

    this._navigation = Navigation.instance();

    this.use(async (context, next) => {
      const debug = DEBUG('spider:init');

      if (isEmpty(context.uri)) {
        throw new Error('context.uri is empty');
      }

      debug(`starting ${context.uri}`);
      context.selectors = ['[type="submit"]', 'button', '[on-click]', 'a'];
      context.depth = 2;
      await next();

      debug(`completed ${context.uri}`);
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
    this._navigation.set(url);

    const page = await context.newPage();

    page.on('request', (request) => {
      const newUrl = new URL(request.url());

      debug(`request detected: ${request.url()}`);
      if (!this._navigation.has(newUrl)) {
        this._navigation.set(newUrl);

        // Recursively crawl new URLs found within the current page
        // if (currentDepth < (this.context.depth ?? Infinity)) {
        //   this.crawl(newUrl.toString(), context, currentDepth + 1);
        // }
      }
    });

    try {
      await page.goto(address);
      await this.recordNavigations(page, currentDepth);
    } catch (error) {
      await page.goBack();
    }
  }

  private async recordNavigations(page: Page, currentDepth: number) {
    const debug = DEBUG('spider:recordNavigations');

    const clickableSelector = this.context.selectors.join(',');
    const clickableElements = await page.$$(clickableSelector);

    debug(`detected clickable elements: ${clickableElements.length}`);
    for (const button of clickableElements) {
      await button.click();

      try {
        await page.waitForNavigation({ timeout: this._timeout });
      } catch (error) {
        console.warn('Navigation timeout:', error);
      }

      const newUrl = new URL(page.url());

      if (this._navigation.has(newUrl)) {
        debug(`${newUrl} already crawled`);
        this._navigation.set(newUrl);
        await page.goBack();
        continue;
      }

      debug(`saving new navigation: ${newUrl}`);
      this._navigation.set(newUrl);
      await this.recordNavigations(page, currentDepth + 1); // Increment depth
      await page.goBack();
    }
  }

  async run(
    contextOrNext?: ArtaxContext | Next,
    optionalNext?: Next
  ): Promise<this> {
    this.use(async (context, next) => {
      const debug = DEBUG('spider:browse');
      debug(`launching browser`);

      await this.weberBrowser.launch();

      const browserContext = this.weberBrowser.context;
      await this.crawl(context.uri, browserContext);
      await next();

      debug('closing weber browser');
      await this.weberBrowser.close();
    });

    return super.run(contextOrNext, optionalNext);
  }

  get navigation() {
    return this._navigation;
  }
}
