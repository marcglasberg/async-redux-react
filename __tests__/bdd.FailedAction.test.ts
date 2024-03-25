import { expect } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { ReduxAction, Store, UserException } from '../src';
import { delayMillis } from '../src/utils';

reporter(new FeatureFileReporter());

const feature = new Feature('Failed action');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('Checking if a SYNC action has failed.')
  .given('A SYNC action.')
  .when('The action is dispatched twice with `dispatch(action)`.')
  .and('The action fails the first time, but not the second time.')
  .then('We can check that the action failed the first time, but not the second.')
  .and('We can get the action exception the first time, but null the second time.')
  .and('We can clear the failing flag.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // When the SYNC action fails, the failed flag is set.
    expect(store.isFailed(SyncActionThatFails)).toBe(false);
    let actionFail = new SyncActionThatFails(true);
    expect(actionFail.status.originalError).toEqual(null);
    expect(actionFail.status.wrappedError).toEqual(null);
    store.dispatch(actionFail);
    expect(store.isFailed(SyncActionThatFails)).toBe(true);
    expect(store.exceptionFor(SyncActionThatFails)).toEqual(new UserException('Yes, it failed.'));
    expect(actionFail.status.originalError).toEqual(new UserException('Yes, it failed.'));
    expect(actionFail.status.wrappedError).toEqual(new UserException('Yes, it failed.'));

    // When the same action is dispatched and does not fail, the failed flag is cleared.
    let actionSuccess = new SyncActionThatFails(false);
    expect(actionSuccess.status.originalError).toEqual(null);
    expect(actionSuccess.status.wrappedError).toEqual(null);
    store.dispatch(actionSuccess);
    expect(store.isFailed(SyncActionThatFails)).toBe(false);
    expect(store.exceptionFor(SyncActionThatFails)).toBe(null);
    expect(actionSuccess.status.originalError).toBe(null);
    expect(actionSuccess.status.wrappedError).toBe(null);

    // -----------

    // Test clearing the exception.

    // Fail it again.
    store.dispatch(new SyncActionThatFails(true));
    expect(store.isFailed(SyncActionThatFails)).toBe(true);
    expect(store.exceptionFor(SyncActionThatFails)).toEqual(new UserException('Yes, it failed.'));

    // We clear the exception for ANOTHER action. It doesn't clear anything.
    store.clearExceptionFor(AsyncActionThatFails);
    expect(store.isFailed(SyncActionThatFails)).toBe(true);
    expect(store.exceptionFor(SyncActionThatFails)).toEqual(new UserException('Yes, it failed.'));

    // We clear the exception for the correct action. Now it's NOT failing anymore.
    store.clearExceptionFor(SyncActionThatFails);
    expect(store.isFailed(SyncActionThatFails)).toBe(false);
    expect(store.exceptionFor(SyncActionThatFails)).toEqual(null);

  })

Bdd(feature)
  .scenario('Checking if an ASYNC action has failed.')
  .given('An ASYNC action.')
  .when('The action is dispatched twice with `dispatch(action)`.')
  .and('The action fails the first time, but not the second time.')
  .then('We can check that the action failed the first time, but not the second.')
  .and('We can get the action exception the first time, but null the second time.')
  .and('We can clear the failing flag.')
  .run(async (_) => {

    const store = new Store<State>({
      initialState: new State(1),
      logger: logger
    });

    // Initially, flag tells us it's NOT failing.
    expect(store.isFailed(AsyncActionThatFails)).toBe(false);
    let actionFail = new AsyncActionThatFails(true);
    expect(actionFail.status.originalError).toEqual(null);
    expect(actionFail.status.wrappedError).toEqual(null);

    // The action is dispatched, but it's ASYNC. We wait for it.
    await store.dispatchAndWait(actionFail);

    // Now it's failed.
    expect(store.isFailed(AsyncActionThatFails)).toBe(true);
    expect(store.exceptionFor(AsyncActionThatFails)).toEqual(new UserException('Yes, it failed.'));
    expect(actionFail.status.originalError).toEqual(new UserException('Yes, it failed.'));
    expect(actionFail.status.wrappedError).toEqual(new UserException('Yes, it failed.'));

    // -----------

    // We clear the exception, so that it's NOT failing.
    store.clearExceptionFor(AsyncActionThatFails);
    expect(store.isFailed(AsyncActionThatFails)).toBe(false);
    actionFail = new AsyncActionThatFails(true);
    expect(actionFail.status.originalError).toEqual(null);
    expect(actionFail.status.wrappedError).toEqual(null);

    // -----------

    // The action is dispatched, but it's ASYNC.
    store.dispatch(actionFail);

    // So, there was no time to fail.
    expect(store.isFailed(AsyncActionThatFails)).toBe(false);
    expect(actionFail.status.originalError).toEqual(null);
    expect(actionFail.status.wrappedError).toEqual(null);

    // We wait until it really finishes.
    await delayMillis(50);

    // Now it's failed.
    expect(store.isFailed(AsyncActionThatFails)).toBe(true);
    expect(store.exceptionFor(AsyncActionThatFails)).toEqual(new UserException('Yes, it failed.'));
    expect(actionFail.status.originalError).toEqual(new UserException('Yes, it failed.'));
    expect(actionFail.status.wrappedError).toEqual(new UserException('Yes, it failed.'));

    // -----------

    // We dispatch the same action type again.
    actionFail = new AsyncActionThatFails(true);
    store.dispatch(actionFail);

    // This act of dispatching it cleared the flag.
    expect(store.isFailed(AsyncActionThatFails)).toBe(false);
    expect(actionFail.status.originalError).toEqual(null);
    expect(actionFail.status.wrappedError).toEqual(null);

    // We wait until it really finishes, again.
    await delayMillis(500);

    // Not it's failed, again.
    expect(store.isFailed(AsyncActionThatFails)).toBe(true);
    expect(store.exceptionFor(AsyncActionThatFails)).toEqual(new UserException('Yes, it failed.'));
    expect(actionFail.status.originalError).toEqual(new UserException('Yes, it failed.'));
    expect(actionFail.status.wrappedError).toEqual(new UserException('Yes, it failed.'));
  })

class State {
  constructor(readonly count: number) {
  }
}

class SyncActionThatFails extends ReduxAction<State> {

  constructor(readonly ifFails: boolean) {
    super();
  }

  reduce() {
    if (this.ifFails) throw new UserException('Yes, it failed.');
    return null;
  }
}

class AsyncActionThatFails extends ReduxAction<State> {

  constructor(readonly ifFails: boolean) {
    super();
  }

  async reduce() {
    await delayMillis(1);
    if (this.ifFails) throw new UserException('Yes, it failed.');
    return null;
  }
}
