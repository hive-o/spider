import { ArtaxContext, Navigation } from '@hive-o/artax-common';

export interface SpiderContext extends ArtaxContext {
  depth?: number;
  navigation: Navigation;
  selectors?: string[];
}
