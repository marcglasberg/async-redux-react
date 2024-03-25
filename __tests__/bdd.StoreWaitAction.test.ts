import { expect, test } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { ReduxAction, Store, StoreException } from '../src';
import { delayMillis } from "../src/utils";
import { TimeoutException } from "../src/StoreException";

reporter(new FeatureFileReporter());

const feature = new Feature('Wait action');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('waitCondition', async () => {
  // Returns a promise that resolves when the state is in the given condition.
  // Since the state is already in the condition, the promise resolves immediately.
  let store = new Store<State>({initialState: new State(1), logger: logger});
  await store.waitCondition((state: State) => state.count === 1);

  // The state is NEVER in the condition, but the timeout will end it.
  await expect(
    store.waitCondition((state: State) => state.count === 2, 10)
  )
    .rejects.toThrow(TimeoutException);

  // An ASYNC action will put the state in the condition, after a while.
  store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new IncrementActionAsync());
  await store.waitCondition((state: State) => state.count === 2);

  // A SYNC action will put the state in the condition, before the condition is created.
  store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new IncrementAction());
  expect(store.state.count).toBe(2);
  await store.waitCondition((state: State) => state.count === 2);

  // A Promise will dispatch a SYNC action that puts the state in the condition.
  store = new Store<State>({initialState: new State(1), logger: logger});
  Promise.resolve().then(() => store.dispatch(new IncrementAction()));
  expect(store.state.count).toBe(1);
  await store.waitCondition((state: State) => state.count === 2);
  expect(store.state.count).toBe(2);

  // A Promise will dispatch a SYNC action that puts the state in the condition, after a while.
  store = new Store<State>({initialState: new State(1), logger: logger});
  new Promise(resolve => setTimeout(resolve, 50)).then(() => store.dispatch(new IncrementAction()));
  expect(store.state.count).toBe(1);
  await store.waitCondition((state: State) => state.count === 2);
  expect(store.state.count).toBe(2);
});

test('waitAllActions', async () => {
  // Returns a promise that resolves when no actions are in progress.
  // Since no actions are currently in progress, the promise resolves immediately.
  // We are ACCEPTING promises resolved immediately.
  let store = new Store<State>({initialState: new State(1), logger: logger});
  await store.waitAllActions([], {completeImmediately: true});

  // Returns a promise that resolves when no actions are in progress.
  // Since no actions are currently in progress, the promise resolves immediately.
  // We are NOT accepting promises resolved immediately: should throw a StoreException.
  store = new Store<State>({initialState: new State(1), logger: logger});
  await expect(
    store.waitAllActions([])
  ).rejects.toThrow(StoreException);

  // Returns a promise that resolves when no actions are in progress.
  // There is an action in progress.
  store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new DelayedAction(1, 1));
  expect(store.state.count).toBe(1);
  await store.waitAllActions([]);
  expect(store.state.count).toBe(2);
});

test('waitActionType', async () => {
  // Returns a promise that resolves when the actions of the given type is NOT in progress.
  // Since no actions are currently in progress, the promise resolves immediately.
  let store = new Store<State>({initialState: new State(1), logger: logger});
  await store.waitActionType(DelayedAction, true);

  // Again, since no actions are currently in progress, the promise resolves immediately.
  // The timeout is irrelevant.
  store = new Store<State>({initialState: new State(1), logger: logger});
  await store.waitActionType(DelayedAction, true, 1);

  // An action of the given type is in progress.
  // But then the action ends.
  store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new DelayedAction(1, 10));
  await store.waitActionType(DelayedAction);

  // An action of the given type is in progress.
  // But the wait will timeout.
  store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new DelayedAction(1, 1000));
  await expect(
    store.waitActionType(DelayedAction, false, 1)
  ).rejects.toThrow(TimeoutException);
});

test('waitAnyActionTypeFinishes', async () => {
  // Returns a promise that resolves when ANY action of the given types finish after the
  // method is called. We start an action before calling the method, then call the method.
  // As soon as the action finishes, the promise resolves.
  let store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new DelayedAction(1, 10));
  let action = await store.waitAnyActionTypeFinishes([DelayedAction], {timeoutMillis: 2000});
  expect(action).toBeInstanceOf(DelayedAction);
  expect(action.status.isCompletedOk).toBe(true);

  // Returns a promise that resolves when ANY action of the given types finish after
  // the method is called. We start an action before calling the method, then call the method.
  // As soon as the action finishes, the promise resolves.
  store = new Store<State>({initialState: new State(1)});

  let error;
  try {
    await store.waitAnyActionTypeFinishes([DelayedAction], {timeoutMillis: 10});
  } catch (_error) {
    error = _error;
  }
  expect(error).toBeInstanceOf(TimeoutException);
});

test('waitActionCondition', async () => {
  // Returns a promise that resolves when the actions of the given type that are in progress
  // meet the given condition. Since no actions are currently in progress, and we're checking
  // to see if there are no actions in progress, the promise resolves immediately.
  let store = new Store<State>({initialState: new State(1), logger: logger});
  await store.waitActionCondition((actions, triggerAction) => actions.size === 0, {completeImmediately: true});
});

test('waitAllActionTypes', async () => {
  // Returns a promise that resolves when ALL actions of the given type are NOT in progress.
  // Since no actions are currently in progress, the promise resolves immediately.
  let store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new DelayedAction(1, 10));
  await store.waitAllActionTypes([DelayedAction, AnotherDelayedAction]);

  // An action of the given type is in progress.
  // But then the action ends.
  store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new DelayedAction(1, 10));
  await store.waitAllActionTypes([DelayedAction, AnotherDelayedAction]);

  // An action of the given type is in progress.
  // But the wait will timeout.
  store = new Store<State>({initialState: new State(1), logger: logger});
  store.dispatch(new DelayedAction(1, 1000));

  let error;
  try {
    await store.waitAllActionTypes([DelayedAction, AnotherDelayedAction], {timeoutMillis: 10});
  } catch (_error) {
    error = _error;
  }
  expect(error).toBeInstanceOf(TimeoutException);
});

Bdd(feature)
  .scenario('We dispatch async actions and wait for all to finish.')
  .given('Three ASYNC actions.')
  .when('The actions are dispatched in PARALLEL.')
  .and('We wait until NO ACTIONS are being dispatched.')
  .then('After we wait, all actions finished.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);

    store.dispatch(new DelayedAction(10, 50));
    store.dispatch(new AnotherDelayedAction(100, 100));
    store.dispatch(new DelayedAction(1000, 20));

    await store.waitAllActions([]);
    expect(store.state.count).toBe(1 + 10 + 100 + 1000);
  });

Bdd(feature)
  .scenario('We dispatch async actions and wait for some action TYPES to finish.')
  .given('Four ASYNC actions.')
  .and('The fourth takes longer than an others to finish.')
  .when('The actions are dispatched in PARALLEL.')
  .and('We wait until there the types of the faster 3 finished dispatching.')
  .then('After we wait, the 3 actions finished, and the fourth did not.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);

    store.dispatch(new DelayedAction(10, 50));
    store.dispatch(new AnotherDelayedAction(100, 100));
    store.dispatch(new YetAnotherDelayedAction(100000, 200));
    store.dispatch(new DelayedAction(1000, 10));

    expect(store.state.count).toBe(1);
    await store.waitAllActionTypes([DelayedAction, AnotherDelayedAction]);
    expect(store.state.count).toBe(1 + 10 + 100 + 1000);
  });

Bdd(feature)
  .scenario('We dispatch an async action and wait for its action TYPE to finish.')
  .given('An ASYNC actions.')
  .when('The action is dispatched.')
  .then('We wait until its type finished dispatching.')
  .run(async (_) => {
    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);

    store.dispatch(new AnotherDelayedAction(123, 100));
    store.dispatch(new DelayedAction(1000, 10));

    expect(store.state.count).toBe(1);
    await store.waitActionType(DelayedAction);
    expect(store.state.count).toBe(1001);
    await store.waitActionType(AnotherDelayedAction);
    expect(store.state.count).toBe(1124);
  });

Bdd(feature)
  .scenario('We dispatch async actions and wait for some of them to finish.')
  .given('Four ASYNC actions.')
  .and('The fourth takes longer than an others to finish.')
  .when('The actions are dispatched in PARALLEL.')
  .and('We wait until there the faster 3 finished dispatching.')
  .then('After we wait, the 3 actions finished, and the fourth did not.')
  .run(async (_) => {

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    expect(store.state.count).toBe(1);

    let action50 = new DelayedAction(10, 50);
    let action100 = new AnotherDelayedAction(100, 100);
    let action200 = new YetAnotherDelayedAction(100000, 200);
    let action10 = new DelayedAction(1000, 10)

    store.dispatch(action50);
    store.dispatch(action100);
    store.dispatch(action200);
    store.dispatch(action10);

    expect(store.state.count).toBe(1);
    await store.waitAllActions([action50, action100, action10]);
    expect(store.state.count).toBe(1 + 10 + 100 + 1000);
  });

class State {
  constructor(readonly count: number) {
  }

  toString() {
    return `State(${this.count})`;
  }
}

class IncrementAction extends ReduxAction<State> {
  reduce() {
    return new State(this.state.count + 1);
  }
}

class IncrementActionAsync extends ReduxAction<State> {
  async reduce() {
    await new Promise(resolve => setTimeout(resolve, 10));
    return (state: State) => new State(this.state.count + 1);
  }
}

class DelayedAction extends ReduxAction<State> {

  constructor(
    public increment: number,
    public delayMillis: number,
  ) {
    super();
  }

  async reduce() {
    await delayMillis(this.delayMillis);
    return (state: State) => new State(state.count + this.increment);
  }
}

class AnotherDelayedAction extends ReduxAction<State> {

  constructor(
    public increment: number,
    public delayMillis: number,
  ) {
    super();
  }

  async reduce() {
    await delayMillis(this.delayMillis);
    return (state: State) => new State(state.count + this.increment);
  }
}

class YetAnotherDelayedAction extends ReduxAction<State> {

  constructor(
    public increment: number,
    public delayMillis: number,
  ) {
    super();
  }

  async reduce() {
    await delayMillis(this.delayMillis);
    return (state: State) => new State(state.count + this.increment);
  }
}

