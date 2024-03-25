import { expect, test } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { Store, ReduxAction } from '../src';

reporter(new FeatureFileReporter());

const feature = new Feature('Abort dispatch of actions');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('The action can abort its own dispatch.')
  .given('An action that returns true (or false) in its abortDispatch method.')
  .when('The action is dispatched (with dispatch, or dispatchSync, or dispatchAndWait).')
  .then('It is aborted (or is not aborted, respectively).')
  .note('We have to test dispatch/dispatchSync/dispatchAndWait separately, because they abort in different ways.')
  .run(async (_) => {

    // Dispatch

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

    // DispatchSync

    store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Doesn't abort, so it increments.
    store.dispatchSync(new Increment(false));
    expect(store.state.count).toBe(2);

    // Aborts, so it doesn't change.
    store.dispatchSync(new Increment(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so it increments again.
    store.dispatchSync(new Increment(false));
    expect(store.state.count).toBe(3);

    // DispatchAndWait

    store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Doesn't abort, so it increments.
    await store.dispatchAndWait(new Increment(false));
    expect(store.state.count).toBe(2);

    // Aborts, so it doesn't change.
    await store.dispatchAndWait(new Increment(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so it increments again.
    await store.dispatchAndWait(new Increment(false));
    expect(store.state.count).toBe(3);
  });

Bdd(feature)
  .scenario('When an action is mocked, its mock decides if it is aborted.')
  .given('An action that returns true (or false) in its abortDispatch method.')
  .and('The action is mocked with an action that does the opposite.')
  .when('The action is dispatched (with dispatch, or dispatchSync, or dispatchAndWait).')
  .then('It is not aborted (or is aborted, respectively).')
  .note('It should now abort when its abortDispatch method return false, which is the opposite of the normal behavior.')
  .note('We have to test dispatch/dispatchSync/dispatchAndWait separately, because they abort in different ways.')
  .run(async (_) => {

    // DISPATCH

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Sets up a mock that returns the opposite of the action's abortDispatch method.
    store.mocks.add(Increment, (action) => new Increment(!action.ifAbort));

    // Doesn't abort, so the mock aborts and doesn't increment.
    store.dispatch(new Increment(false));
    expect(store.state.count).toBe(1);

    // Aborts, so the mock doesn't abort and increments.
    store.dispatch(new Increment(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so the mock aborts and, again, doesn't increment.
    store.dispatch(new Increment(false));
    expect(store.state.count).toBe(2);

    // DISPATCHSYNC

    store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Sets up a mock that returns the opposite of the action's abortDispatch method.
    store.mocks.add(Increment, (action) => new Increment(!action.ifAbort));

    // Doesn't abort, so the mock aborts and doesn't increment.
    store.dispatchSync(new Increment(false));
    expect(store.state.count).toBe(1);

    // Aborts, so the mock doesn't abort and increments.
    store.dispatchSync(new Increment(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so the mock aborts and, again, doesn't increment.
    store.dispatchSync(new Increment(false));
    expect(store.state.count).toBe(2);

    // DISPATCHANDWAIT

    store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    // Sets up a mock that returns the opposite of the action's abortDispatch method.
    store.mocks.add(Increment, (action) => new Increment(!action.ifAbort));

    // Doesn't abort, so the mock aborts and doesn't increment.
    await store.dispatchAndWait(new Increment(false));
    expect(store.state.count).toBe(1);

    // Aborts, so the mock doesn't abort and increments.
    await store.dispatchAndWait(new Increment(true));
    expect(store.state.count).toBe(2);

    // Doesn't abort, so the mock aborts and, again, doesn't increment.
    await store.dispatchAndWait(new Increment(false));
    expect(store.state.count).toBe(2);
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

  abortDispatch(): boolean {
    return this.ifAbort!;
  }

  reduce() {
    return new State(this.state.count + 1);
  }
}

