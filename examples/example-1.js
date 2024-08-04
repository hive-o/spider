const { Spider } = require('../dist/spider');

async function main() {
  const spider = new Spider();

  spider.use((context) => {
    context.urls = ['https://xss-game.appspot.com/level1/frame'];
  });

  await spider.run();
}

void main();
