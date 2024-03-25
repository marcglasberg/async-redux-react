import { expect } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { ReduxAction, Store } from '../src';
import { delayMillis } from '../src/utils';

reporter(new FeatureFileReporter());

const feature = new Feature('Dispatch');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('Waiting for a dispatch to end.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched with `dispatch(action)`.')
  .then('The SYNC action changes the state synchronously.')
  .and('The ASYNC action changes the state asynchronously.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // The SYNC action changes the state synchronously.
    expect(store.state.count).toBe(1);
    store.dispatch(new IncrementSync());
    expect(store.state.count).toBe(2);

    // The ASYNC action does NOT change the state synchronously.
    store.dispatch(new IncrementAsync());
    expect(store.state.count).toBe(2);

    // But the ASYNC action changes the state asynchronously.
    await delayMillis(50);
    expect(store.state.count).toBe(3);
  });

Bdd(feature)
  .scenario('Knowing when some action dispatched with `dispatch` is being processed.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched.')
  .then('We can check if the action is processing with `Store.isWaiting(action)`.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // -----------

    // SYNC ACTION: isWaiting is always false.

    expect(store.isWaiting(IncrementSync)).toBe(false);
    expect(store.state.count).toBe(1);

    let actionSync = new IncrementSync();
    expect(actionSync.status.isDispatched).toBe(false);

    store.dispatch(actionSync);
    expect(actionSync.status.isDispatched).toBe(true);

    // Since it's SYNC, it's already finished when dispatched.
    expect(store.isWaiting(IncrementSync)).toBe(false);
    expect(store.state.count).toBe(2);

    // -----------

    // ASYNC ACTION: isWaiting is true while we wait for it to finish.

    expect(store.isWaiting(IncrementAsync)).toBe(false);
    expect(store.state.count).toBe(2);

    let actionAsync = new IncrementAsync();
    expect(actionAsync.status.isDispatched).toBe(false);

    store.dispatch(actionAsync);
    expect(actionAsync.status.isDispatched).toBe(true);

    expect(store.isWaiting(IncrementAsync)).toBe(true); // True!
    expect(store.state.count).toBe(2);

    await delayMillis(50); // Since it's ASYNC, it really waits until it finishes.

    expect(store.isWaiting(IncrementAsync)).toBe(false);
    expect(store.state.count).toBe(3);
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

class IncrementAsync extends ReduxAction<State> {

  async reduce() {
    await delayMillis(1);
    return (state: State) => new State(state.count + 1);
  }
}
