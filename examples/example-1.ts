import { Navigation } from '@hive-o/artax-common';

import { Spider } from '../dist/spider';

async function main() {
  const spider = new Spider();

  spider.use(async (context, next) => {
    context.selectors.push('a');
    await next();
  });

  await spider.run({
    navigation: Navigation.instance(),
    uri: 'https://www.example.com',
  });
}

void main();
