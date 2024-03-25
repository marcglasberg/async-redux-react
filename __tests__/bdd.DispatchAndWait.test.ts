import { expect } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { ActionStatus, ReduxAction, Store, UserException } from '../src';
import { delayMillis } from '../src/utils';

reporter(new FeatureFileReporter());

const feature = new Feature('DispatchAndWait');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('Waiting for a dispatchAndWait to end.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched with `dispatchAndWait(action)`.')
  .then('It returns a `Promise` that resolves when the action finishes.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    expect(store.state.count).toBe(1);
    await store.dispatchAndWait(new IncrementSync());
    expect(store.state.count).toBe(2);

    await store.dispatchAndWait(new IncrementAsync());
    expect(store.state.count).toBe(3);
  });

Bdd(feature)
  .scenario('Knowing when some action dispatched with `dispatchAndWait` is being processed.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched.')
  .then('We can check if the action is processing with `Store.isWaiting(actionType)`.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // ---

    // SYNC ACTION: isWaiting is always false.

    expect(store.isWaiting(IncrementSync)).toBe(false);
    expect(store.state.count).toBe(1);

    let actionSync = new IncrementSync();
    expect(actionSync.status.isDispatched).toBe(false);

    let promise1 = store.dispatchAndWait(actionSync);
    expect(actionSync.status.isDispatched).toBe(true);

    expect(store.isWaiting(IncrementSync)).toBe(false);
    expect(store.state.count).toBe(2);

    await promise1; // Since it's SYNC, it's already finished when dispatched.

    expect(store.isWaiting(IncrementSync)).toBe(false);
    expect(store.state.count).toBe(2);

    // ---

    // ASYNC ACTION: isWaiting is true while we wait for it to finish.

    expect(store.isWaiting(IncrementAsync)).toBe(false);
    expect(store.state.count).toBe(2);

    let actionAsync = new IncrementAsync();
    expect(actionAsync.status.isDispatched).toBe(false);

    let promise2 = store.dispatchAndWait(actionAsync);
    expect(actionAsync.status.isDispatched).toBe(true);

    expect(store.isWaiting(IncrementAsync)).toBe(true); // True!
    expect(store.state.count).toBe(2);

    await promise2; // Since it's ASYNC, it really waits until it finishes.

    expect(store.isWaiting(IncrementAsync)).toBe(false);
    expect(store.state.count).toBe(3);
  });

Bdd(feature)
  .scenario('Reading the ActionStatus of the action.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched.')
  .and('The action finishes without any errors.')
  .then('We can check the action status, which says the action completed OK (no errors).')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // SYNC ACTION

    let actionSync = new IncrementSync();
    let status: ActionStatus = actionSync.status;

    expect(status.isDispatched).toEqual(false);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(false);
    expect(status.isCompleted).toBeFalsy();
    expect(status.isCompletedOk).toBeFalsy();
    expect(status.isCompletedFailed).toBeFalsy();

    status = await store.dispatchAndWait(actionSync);

    expect(status).toBe(actionSync.status);
    expect(status.isDispatched).toEqual(true);
    expect(status.hasFinishedMethodBefore).toEqual(true);
    expect(status.hasFinishedMethodReduce).toEqual(true);
    expect(status.hasFinishedMethodAfter).toEqual(true); // After is like a "finally" block. It always runs.
    expect(status.isCompleted).toBeTruthy();
    expect(status.isCompletedOk).toBeTruthy();
    expect(status.isCompletedFailed).toBeFalsy();

    // ASYNC ACTION

    let actionAsync = new IncrementAsync();
    status = actionAsync.status;

    expect(status.isDispatched).toEqual(false);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(false);
    expect(status.isCompleted).toBeFalsy();
    expect(status.isCompletedOk).toBeFalsy();
    expect(status.isCompletedFailed).toBeFalsy();

    status = await store.dispatchAndWait(actionAsync);

    expect(status).toBe(actionAsync.status);
    expect(status.isDispatched).toEqual(true);
    expect(status.hasFinishedMethodBefore).toEqual(true);
    expect(status.hasFinishedMethodReduce).toEqual(true);
    expect(status.hasFinishedMethodAfter).toEqual(true); // After is like a "finally" block. It always runs.
    expect(status.isCompleted).toBeTruthy();
    expect(status.isCompletedOk).toBeTruthy();
    expect(status.isCompletedFailed).toBeFalsy();
  });

Bdd(feature)
  .scenario('Reading the ActionStatus of the action.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched.')
  .and('The action fails in the "before" method.')
  .then('We can check the action status, which says the action completed with errors.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // SYNC ACTION

    let actionSync = new IncrementSyncBeforeFails();
    let status: ActionStatus = actionSync.status;

    expect(status.isDispatched).toEqual(false);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(false);
    expect(status.isCompleted).toBeFalsy();

    status = await store.dispatchAndWait(actionSync);

    expect(status).toBe(actionSync.status);
    expect(status.isDispatched).toEqual(true);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(true); // After is like a "finally" block. It always runs.
    expect(status.isCompleted).toBeTruthy();
    expect(status.isCompletedOk).toBeFalsy();
    expect(status.isCompletedFailed).toBeTruthy();

    // ASYNC ACTION

    let actionAsync = new IncrementAsyncBeforeFails();
    status = actionAsync.status;

    expect(status.isDispatched).toEqual(false);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(false);
    expect(status.isCompleted).toBeFalsy();

    status = await store.dispatchAndWait(actionAsync);

    expect(status).toBe(actionAsync.status);
    expect(status.isDispatched).toEqual(true);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(true); // After is like a "finally" block. It always runs.
    expect(status.isCompleted).toBeTruthy();
    expect(status.isCompletedOk).toBeFalsy();
    expect(status.isCompletedFailed).toBeTruthy();
  });

Bdd(feature)
  .scenario('Reading the ActionStatus of the action.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched.')
  .and('The action fails in the "reduce" method.')
  .then('We can check the action status, which says the action completed with errors.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // SYNC ACTION

    let actionSync = new IncrementSyncReduceFails();
    let status: ActionStatus = actionSync.status;

    expect(status.isDispatched).toEqual(false);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(false);
    expect(status.isCompleted).toBeFalsy();

    status = await store.dispatchAndWait(actionSync);

    expect(status).toBe(actionSync.status);
    expect(status.isDispatched).toEqual(true);
    expect(status.hasFinishedMethodBefore).toEqual(true);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(true);
    expect(status.isCompleted).toBeTruthy();
    expect(status.isCompletedOk).toBeFalsy();
    expect(status.isCompletedFailed).toBeTruthy();

    // ASYNC ACTION

    let actionAsync = new IncrementAsyncReduceFails();
    status = actionAsync.status;

    expect(status.isDispatched).toEqual(false);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(false);
    expect(status.isCompleted).toBeFalsy();

    status = await store.dispatchAndWait(actionAsync);

    expect(status).toBe(actionAsync.status);
    expect(status.isDispatched).toEqual(true);
    expect(status.hasFinishedMethodBefore).toEqual(true);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(true);
    expect(status.isCompleted).toBeTruthy();
    expect(status.isCompletedOk).toBeFalsy();
    expect(status.isCompletedFailed).toBeTruthy();
  });

Bdd(feature)
  .scenario('Reading the ActionStatus of the action.')
  .given('A SYNC or ASYNC action.')
  .when('The action is dispatched.')
  .and('The action fails in the "after" method.')
  .then('We can check the action status, which says the action completed OK (no errors).')
  .note('The "after" method should never fail. If it does, the error will be swallowed.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // SYNC ACTION

    let actionSync = new IncrementSyncAfterFails();
    let status: ActionStatus = actionSync.status;

    expect(status.isDispatched).toEqual(false);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(false);
    expect(status.isCompleted).toBeFalsy();

    status = await store.dispatchAndWait(actionSync);

    expect(status).toBe(actionSync.status);
    expect(status.isDispatched).toEqual(true);
    expect(status.hasFinishedMethodBefore).toEqual(true);
    expect(status.hasFinishedMethodReduce).toEqual(true);
    expect(status.hasFinishedMethodAfter).toEqual(true);
    expect(status.isCompleted).toBeTruthy();
    expect(status.isCompletedOk).toBeTruthy(); // Errors in "after" are swallowed.
    expect(status.isCompletedFailed).toBeFalsy();

    // ASYNC ACTION

    let actionAsync = new IncrementAsyncAfterFails();
    status = actionAsync.status;

    expect(status.isDispatched).toEqual(false);
    expect(status.hasFinishedMethodBefore).toEqual(false);
    expect(status.hasFinishedMethodReduce).toEqual(false);
    expect(status.hasFinishedMethodAfter).toEqual(false);
    expect(status.isCompleted).toBeFalsy();

    status = await store.dispatchAndWait(actionAsync);

    expect(status).toBe(actionAsync.status);
    expect(status.isDispatched).toEqual(true);
    expect(status.hasFinishedMethodBefore).toEqual(true);
    expect(status.hasFinishedMethodReduce).toEqual(true);
    expect(status.hasFinishedMethodAfter).toEqual(true); // After is like a "finally" block. It always runs.
    expect(status.isCompleted).toBeTruthy();
    expect(status.isCompletedOk).toBeTruthy(); // Errors in "after" are swallowed.
    expect(status.isCompletedFailed).toBeFalsy();
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

class IncrementSyncBeforeFails extends ReduxAction<State> {

  before() {
    throw new UserException('Before failed');
  }

  reduce() {
    return new State(this.state.count + 1);
  }
}

class IncrementSyncReduceFails extends ReduxAction<State> {

  reduce() {
    throw new UserException('Reduce failed');
    return new State(this.state.count + 1);
  }
}

class IncrementSyncAfterFails extends ReduxAction<State> {

  reduce() {
    return new State(this.state.count + 1);
  }

  after() {
    throw new UserException('After failed');
  }
}

class IncrementAsync extends ReduxAction<State> {

  async reduce() {
    await delayMillis(50);
    return (state: State) => new State(state.count + 1);
  }
}

class IncrementAsyncBeforeFails extends ReduxAction<State> {

  async before() {
    throw new UserException('Before failed');
  }

  async reduce() {
    await delayMillis(50);
    return (state: State) => new State(state.count + 1);
  }
}

class IncrementAsyncReduceFails extends ReduxAction<State> {

  async reduce() {
    await delayMillis(50);
    throw new UserException('Reduce failed');
    return (state: State) => new State(state.count + 1);
  }
}

class IncrementAsyncAfterFails extends ReduxAction<State> {

  async reduce() {
    await delayMillis(50);
    return (state: State) => new State(state.count + 1);
  }

  async after() {
    throw new UserException('After failed');
  }
}

