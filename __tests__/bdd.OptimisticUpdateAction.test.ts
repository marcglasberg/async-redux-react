import { expect } from '@jest/globals';
import { Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';

reporter(new FeatureFileReporter());

const feature = new Feature('Optimistic update actions');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(1).toBe(1);
  // TODO: Test mixin: OptimisticUpdate
});

