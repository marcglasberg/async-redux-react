import { expect, test } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { Store, ReduxAction } from '../src';
import { delayMillis } from "../src/utils";

reporter(new FeatureFileReporter());

const feature = new Feature('Abort reduce of actions');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('A SYNC action can prevent its own reduce method from changing the state.')
  .given('A SYNC action that returns true (or false) in its abortReduce method.')
  .when('The action is dispatched.')
  .then('The reduce method is aborted (or is not aborted, respectively).')
  .note('We only have to test dispatch, because its the same abort code as dispatchSync/dispatchAndWait.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Doesn't abort, so it increments.
    store.dispatch(new Increment(false));
    expect(store.state.count).toBe(2);

    // Aborts, so it doesn't change.
    store.dispatch(new Increment(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so it increments again.
    store.dispatch(new Increment(false));
    expect(store.state.count).toBe(3);
  });

Bdd(feature)
  .scenario('An ASYNC action can prevent its own reduce method from changing the state.')
  .given('An ASYNC action that returns true (or false) in its abortReduce method.')
  .and('The action is ASYNC because its "before" methos is async, or because its "reduce" method is asnyc.')
  .when('The action is dispatched.')
  .then('The reduce method is aborted (or is not aborted, respectively).')
  .note('We have to separately test with async "before", async "reduce", and both "before" and "reduce" being async, because they abort in different ways.')
  .run(async (_) => {

    // BEFORE ASYNC

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Doesn't abort, so it increments.
    await store.dispatchAndWait(new IncrementAsyncBefore(false));
    expect(store.state.count).toBe(2);

    // Aborts, so it doesn't change.
    await store.dispatchAndWait(new IncrementAsyncBefore(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so it increments again.
    await store.dispatchAndWait(new IncrementAsyncBefore(false));
    expect(store.state.count).toBe(3);

    // REDUCE ASYNC

    store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Doesn't abort, so it increments.
    await store.dispatchAndWait(new IncrementAsyncReduce(false));
    expect(store.state.count).toBe(2);

    // Aborts, so it doesn't change.
    await store.dispatchAndWait(new IncrementAsyncReduce(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so it increments again.
    await store.dispatchAndWait(new IncrementAsyncReduce(false));
    expect(store.state.count).toBe(3);

    // BEFORE AND REDUCE ASYNC

    store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Doesn't abort, so it increments.
    await store.dispatchAndWait(new IncrementAsyncBeforeReduce(false));
    expect(store.state.count).toBe(2);

    // Aborts, so it doesn't change.
    await store.dispatchAndWait(new IncrementAsyncBeforeReduce(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so it increments again.
    await store.dispatchAndWait(new IncrementAsyncBeforeReduce(false));
    expect(store.state.count).toBe(3);
  });

class State {
  constructor(readonly count: number) {
  }

  toString() {
    return `State(${this.count})`;
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

  constructor(public ifAbort: boolean) {
    super();
  }

  async before() {
    await delayMillis(10);
  }

  abortReduce(): boolean {
    return this.ifAbort!;
  }

  reduce() {
    return new State(this.state.count + 1);
  }
}

// Only the "reduce" method returns a promise.
class IncrementAsyncReduce extends ReduxAction<State> {

  constructor(public ifAbort: boolean) {
    super();
  }

  abortReduce(): boolean {
    return this.ifAbort!;
  }

  async reduce() {
    return (state: State) => new State(state.count + 1);
  }
}

// Both the "before" and "reduce" return promises.
class IncrementAsyncBeforeReduce extends ReduxAction<State> {

  constructor(public ifAbort: boolean) {
    super();
  }

  async before() {
    await delayMillis(10);
  }

  abortReduce(): boolean {
    return this.ifAbort!;
  }

  async reduce() {
    return (state: State) => new State(state.count + 1);
  }
}

