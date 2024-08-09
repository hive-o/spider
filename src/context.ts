import { ArtaxContext } from '@hive-o/artax-common';

export interface SpiderContext extends ArtaxContext {
  depth: number;
  selectors: string[];
}
