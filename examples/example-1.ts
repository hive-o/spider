import { Spider } from '../dist/spider';

async function main() {
  const spider = new Spider();

  spider.use(async (context, next) => {
    context.depth = 3;
    await next();
  });

  await spider.run({
    uri: 'https://www.example.com',
  });
}

void main();
