import { expect, test } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { ReduxAction, Store } from '../src';
import { delayMillis } from "../src/utils";

reporter(new FeatureFileReporter());

const feature = new Feature('Non reentrant actions');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('Sync action non-reentrant does not call itself.')
  .given('A SYNC action that calls itself.')
  .and('The action is non-reentrant.')
  .when('The action is dispatched.')
  .then('It runs once.')
  .and('Does not result in a stack overflow.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);
    store.dispatch(new NonReentrantSyncActionCallsItself());
    expect(store.state.count).toBe(2);
  });

Bdd(feature)
  .scenario('Async action non-reentrant does not call itself.')
  .given('An ASYNC action that calls itself.')
  .and('The action is non-reentrant.')
  .when('The action is dispatched.')
  .then('It runs once.')
  .and('Does not result in a stack overflow.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);
    store.dispatch(new NonReentrantAsyncActionCallsItself());
    expect(store.state.count).toBe(2);
  });


Bdd(feature)
  .scenario('Async action non-reentrant does start before an action of the same type finished.')
  .given('An ASYNC action takes some time to finish.')
  .and('The action is non-reentrant.')
  .when('The action is dispatched.')
  .and('Another action of the same type is dispatched before the previous one finished.')
  .then('It runs only once.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // We start with count 1.
    expect(store.state.count).toBe(1);
    expect(store.isWaiting(NonReentrantAsyncAction)).toBe(false);

    // We dispatch an action that will wait for 100 millis and increment 10.
    store.dispatch(new NonReentrantAsyncAction(10, 100));
    expect(store.isWaiting(NonReentrantAsyncAction)).toBe(true);

    // So far, we still have count 1.
    expect(store.state.count).toBe(1);

    // We wait a little bit and dispatch ANOTHER action that will wait for 10 millis and increment 50.
    await delayMillis(10);
    store.dispatch(new NonReentrantAsyncAction(50, 10));
    expect(store.isWaiting(NonReentrantAsyncAction)).toBe(true);

    // We wait for all actions to finish dispatching.
    await store.waitAllActions([]);
    expect(store.isWaiting(NonReentrantAsyncAction)).toBe(false);

    // The only action that ran was the first one, which incremented by 10 (1+10 = 11).
    // The second action was aborted.
    expect(store.state.count).toBe(11);
  });

class State {
  constructor(readonly count: number) {
  }

  toString() {
    return `State(${this.count})`;
  }
}

class NonReentrantSyncActionCallsItself extends ReduxAction<State> {

  nonReentrant = true;

  reduce() {
    this.dispatch(new NonReentrantSyncActionCallsItself());
    return new State(this.state.count + 1);
  }
}

class NonReentrantAsyncActionCallsItself extends ReduxAction<State> {

  nonReentrant = true;

  async reduce() {
    this.dispatch(new NonReentrantSyncActionCallsItself());
    return (state: State) => new State(state.count + 1);
  }
}

class NonReentrantAsyncAction extends ReduxAction<State> {

  constructor(
    public increment: number,
    public delayMillis: number,
  ) {
    super();
  }

  nonReentrant = true;

  async reduce() {
    await delayMillis(this.delayMillis);
    return (state: State) => new State(state.count + this.increment);
  }
}

