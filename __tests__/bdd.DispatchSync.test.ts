import { expect } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { Store, ReduxAction, StoreException } from '../src';
import { delayMillis } from '../src/utils';

reporter(new FeatureFileReporter());

const feature = new Feature('DispatchSync');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('DispatchSync only dispatches SYNC actions.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched with `dispatchSync(action)`.')
  .then('It throws a `StoreException` when the action is ASYNC.')
  .and('It fails synchronously.')
  .note('We have to separately test with async "before", async "reduce", and both "before" and "reduce" being async, because they fail in different ways.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // Works
    store.dispatchSync(new IncrementSync());

    // Fails synchronously with a `StoreException`.
    expect(() => store.dispatchSync(new IncrementAsyncBefore())).toThrowError(StoreException);
    expect(() => store.dispatchSync(new IncrementAsyncReduce())).toThrowError(StoreException);
    expect(() => store.dispatchSync(new IncrementAsyncBeforeReduce())).toThrowError(StoreException);
  });

class State {
  constructor(readonly count: number) {
  }
}

class IncrementSync extends ReduxAction<State> {

  reduce() {
    return new State(this.state.count + 1);
  }
}

class Increment extends ReduxAction<State> {

  constructor(public ifAbort: boolean) {
    super();
  }

  abortReduce(): boolean {
    return this.ifAbort!;
  }

  reduce() {
    return new State(this.state.count + 1);
  }
}

// Only the "before" method returns a promise.
class IncrementAsyncBefore extends ReduxAction<State> {

  async before() {
    await delayMillis(10);
  }

  reduce() {
    return new State(this.state.count + 1);
  }
}

// Only the "reduce" method returns a promise.
class IncrementAsyncReduce extends ReduxAction<State> {

  async reduce() {
    return (state: State) => new State(state.count + 1);
  }
}

// Both the "before" and "reduce" return promises.
class IncrementAsyncBeforeReduce extends ReduxAction<State> {

  async before() {
    await delayMillis(10);
  }

  async reduce() {
    return (state: State) => new State(state.count + 1);
  }
}

