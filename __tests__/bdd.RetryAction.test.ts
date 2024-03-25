import { expect, test } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { ReduxAction, Store, StoreException, UserException } from '../src';
import { delayMillis } from "../src/utils";

reporter(new FeatureFileReporter());

const feature = new Feature('Retry action');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('Action retries a few times and succeeds.')
  .given('An action that retries up to 10 times.')
  .and('The action fails with a user exception the first 4 times.')
  .when('The action is dispatched.')
  .then('It does change the state.')
  .run(async (_) => {

    let errorInErrorObserver: any;

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
      errorObserver: (error: any, action: ReduxAction<State>, store: Store<State>) => {
        errorInErrorObserver = error;
        return false;
      },
    });

    expect(store.state.count).toBe(1);
    let action = new SyncActionThatRetriesAndSucceeds();
    await store.dispatchAndWait(action);
    expect(action.attempts).toBe(5);
    expect(action.log).toBe('012345');

    // Should fail because the action is SYNC.
    // Only ASYNC actions can retry.
    expect(store.state.count).toBe(1);
    expect(action.status.isCompletedOk).toBe(false);
    expect(action.status.originalError).toBeInstanceOf(StoreException);

    // Waits for the exception to be caught by the errorObserver.
    await delayMillis(1);
    expect(errorInErrorObserver).toBeInstanceOf(StoreException);
  });

Bdd(feature)
  .scenario('Action retries a few times and succeeds.')
  .given('An action that retries up to 10 times.')
  .and('The action fails with a user exception the first 4 times.')
  .when('The action is dispatched.')
  .then('It does change the state.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);
    let action = new AsyncActionThatRetriesAndSucceeds();
    await store.dispatchAndWait(action);
    expect(action.attempts).toBe(5);
    expect(action.log).toBe('012345');
    expect(store.state.count).toBe(2);
    expect(action.status.isCompletedOk).toBe(true);
  });

Bdd(feature)
  .scenario('Action retries unlimited tries until it succeeds.')
  .given('An action marked with "UnlimitedRetries".')
  .and('The action fails with a user exception the first 6 times.')
  .when('The action is dispatched.')
  .then('It does change the state.')
  .note('Without the "UnlimitedRetries" it would fail because the default is 3 retries.')
  .run(async (_) => {
    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);
    let action = new ActionThatRetriesUnlimitedAndFails();
    await store.dispatchAndWait(action);
    expect(action.status.isCompletedOk).toBe(true);
    expect(store.state.count).toBe(2);
    expect(action.attempts).toBe(7);
    expect(action.log).toBe('01234567');
  });

Bdd(feature)
  .scenario('Action retries a few times and fails.')
  .given('An action that retries up to 3 times.')
  .and('The action fails with a user exception the first 4 times.')
  .when('The action is dispatched.')
  .then('It does NOT change the state.')
  .run(async (_) => {
    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);
    let action = new ActionThatRetriesAndFails();
    await store.dispatchAndWait(action);
    expect(store.state.count).toBe(1);
    expect(action.attempts).toBe(4);
    expect(action.log).toBe('0123');
    expect(action.status.isCompletedFailed).toBe(true);
  });

Bdd(feature)
  .scenario('Sync action becomes ASYNC of it retries, even if it succeeds the first time.')
  .given('A SYNC action that retries up to 10 times.')
  .when('The action is dispatched and succeeds the first time.')
  .then('It cannot be dispatched SYNC anymore.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);
    let action = new ActionThatRetriesButSucceedsTheFirstTry();
    await store.dispatchAndWait(action);
    expect(action.attempts).toBe(0);
    expect(action.log).toBe('0');
    expect(store.state.count).toBe(2);
    expect(action.status.isCompletedOk).toBe(true);

    // The action cannot be dispatched SYNC anymore.
    expect(() => store.dispatchSync(action)).toThrow(StoreException);
  });

class State {
  count: number;

  constructor(count: number) {
    this.count = count;
  }

  toString(): string {
    return `State(${this.count})`;
  }
}

class SyncActionThatRetriesAndSucceeds extends ReduxAction<State> {

  log: string = '';

  retry = {
    initialDelay: 10,
    maxRetries: 10,
  }

  reduce() {
    this.log += this.attempts.toString();
    if (this.attempts <= 4) throw new UserException(`Failed: ${this.attempts}`);
    return new State(this.state.count + 1);
  }
}

class AsyncActionThatRetriesAndSucceeds extends ReduxAction<State> {

  log: string = '';

  retry = {
    initialDelay: 10,
    maxRetries: 10,
  }

  async reduce() {
    this.log += this.attempts.toString();
    if (this.attempts <= 4) throw new UserException(`Failed: ${this.attempts}`);
    return (state: State) => new State(state.count + 1);
  }
}

class ActionThatRetriesAndFails extends ReduxAction<State> {
  log: string = '';

  retry = {initialDelay: 10}

  async reduce() {
    this.log += this.attempts.toString();
    if (this.attempts <= 4) throw new UserException(`Failed: ${this.attempts}`);
    return (state: State) => new State(this.state.count + 1);
  }
}

class ActionThatRetriesButSucceedsTheFirstTry extends ReduxAction<State> {

  log: string = '';

  retry = {
    initialDelay: 10,
    maxRetries: 10,
  }

  async reduce() {
    this.log += this.attempts.toString();
    return (state: State) => new State(this.state.count + 1);
  }
}

class ActionThatRetriesUnlimitedAndFails extends ReduxAction<State> {

  log: string = '';

  retry = {
    initialDelay: 10,
    maxRetries: -1,
  }

  async reduce() {
    this.log += this.attempts.toString();
    if (this.attempts <= 6) throw new UserException(`Failed: ${this.attempts}`);
    return (state: State) => new State(this.state.count + 1);
  }
}
