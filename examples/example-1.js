const { Spider } = require('../dist/spider');

async function main() {
  const spider = new Spider();
  spider.use(async (context, next) => {
    context.selectors.push('a');
    await next();
  });

  await spider.run({ uri: 'https://www.example.com' });
}

void main();
