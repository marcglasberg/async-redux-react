import React, { useContext, useEffect, useRef, useState } from 'react';
import { UserException } from './UserException';
import { ActionStatus, ReduxAction } from './ReduxAction';
import { StoreException } from './StoreException';
import { Store, StoreContext, StoreContextType } from "./Store";

/**
 * Returns a part of the store state:
 *
 * ```ts
 * const name = useSelect((state: State) => state.user.name);
 * ```
 *
 * The component will rebuild only when the `name` changes, ignoring the
 * change in other parts of the state.
 *
 * Note: You can use `useSelect` and `useSelector` interchangeably.
 * Prefer `useSelect` because it's shorter.
 */
export function useSelect<St, T>(selector: (state: St) => T): T {

  // This ref will persist for the full lifetime of the component.
  let ref = useRef<RefState<St, T>>();

  // The initial value is the value selected from the current state in the store.
  let store: Store<St> = _useStoreFromContext<St>();
  const [value, setValue] = useState(() => selector(store.state));

  // Only once when the component mounts.
  useEffect(() => {

    // We save in the ref:
    // - The selector
    // - The currently selected value
    // - The setValue function
    //
    // Whenever the state changes, the store will:
    // 1. Retrieve all refs
    // 2. Apply each selector to the current state to calculate the selected value.
    // 3. And compare the selected value with the last selected value.
    // 4. If it changed, it calls setValue.
    ref.current = new RefState<St, T>([selector, value, setValue]);

    // Save the new ref.
    store._refStateHooks.add(ref);

    return () => {
      // When the component unmounts, delete the ref.
      store._refStateHooks.delete(ref);
    };

  }, []);

  return value;
}

/**
 * Returns a part of the store state:
 *
 * ```ts
 * const name = useSelector((state: State) => state.user.name);
 * ```
 *
 * The component will rebuild only when the `name` changes, ignoring the
 * change in other parts of the state.
 *
 * Note: You can use `useSelect` and `useSelector` interchangeably.
 * Prefer `useSelect` because it's shorter.
 */
export function useSelector<St, T>(selector: (state: St) => T): T {
  return useSelect(selector);
}

/**
 * Returns the whole store state:
 *
 * ```ts
 * const state = useAllState<State>();
 * const name = state.user.name;
 * ```
 *
 * While that's convenient, the above code will rebuild the component for all state changes,
 * no matter if the name changed or not. For this reason, prefer `useSelector`:
 *
 * ```ts
 * const name = useSelector((state: State) => state.user.name);
 * ```
 *
 * Now it will rebuild only when the name changes.
 */
export function useAllState<St>(): St {
  return useSelect<St, St>((state) => state);
}

/**
 * You can get the store to use all dispatch and wait methods:
 *
 * - `dispatch` - Dispatches the action to the Redux store, to potentially change the state.
 * - `dispatchAndWait` - Dispatches an action and returns a promise that resolves when the action finishes.
 * - `dispatchSync` - Same as the regular dispatch, except it throws an error if the action is ASYNC.
 * - `waitCondition` - Waits until the state is in a given condition.
 * - `waitActionCondition` - Waits until the actions in progress meet a given condition.
 * - `waitAllActions` - Waits until the given actions are NOT in progress, or no actions are in progress.
 * - `waitActionType` - Waits until an action of a given type is NOT in progress.
 * - `waitAllActionTypes` - Waits until all actions of the given type are NOT in progress.
 * - `waitAnyActionTypeFinishes` - Waits until ANY action of the given types finish dispatching.
 *
 * Example:
 *
 * ```js
 * const store = useStore();
 * store.dispatch(new MyAction());
 * await store.dispatchAndWait(new MyAction());
 * store.dispatchSync(new MyAction());
 * await waitCondition((state) => state.user.name === "Bill");
 * await waitAllActionTypes(['BuyStock', 'SellStock']);
 * ```
 *
 * IMPORTANT:
 * The store `state` and other store methods are NOT available when you get the store with `useStore`.
 * - To get the state: `useSelect`
 * - To wait for actions: `useIsWaiting`
 * - To deal with exceptions: `useIsFailed`, `useExceptionFor` and `clearExceptionFor`
 *
 * See also:
 * - `useDispatch()` - Hook equivalent to `useStore().dispatch`
 * - `useDispatchAndWait` - Hook equivalent to `useStore().dispatchAndWait`
 * - `useDispatchSync` - Hook equivalent to `useStore().dispatchSync`
 */
export function useStore(): StoreDispatchers<any> {
  let store = _useStoreFromContext<any>();
  return new StoreDispatchers(store as Store<any>);
}

/**
 * @deprecated Use `useDispatch`. Note you also have `useDispatchAndWait` and `useDispatchSync`.
 */
export function useDispatcher(): (action: ReduxAction<any>) => void {
  return useDispatch();
}

/**
 * Dispatches the action to the Redux store, to potentially change the state:
 *
 * ```ts
 * const dispatch = useDispatch();
 * dispatch(MyAction());
 * ```
 *
 * This also works:
 *
 * ```ts
 * const store = useStore();
 * dispatch(MyAction());
 * ```
 */
export function useDispatch(): (action: ReduxAction<any>) => void {
  let store = _useStoreFromContext<any>();
  return store.dispatch.bind(store);
}

/**
 * Dispatches an action and returns a promise that resolves when the action finishes.
 * While the state change from the action's reducer will have been applied when the promise
 * resolves, other independent processes that the action may have started may still be in
 * progress.
 *
 * Usage: `await store.dispatchAndWait(new MyAction())`.
 */
export function useDispatchAndWait(): (action: ReduxAction<any>) => Promise<ActionStatus> {
  let store = _useStoreFromContext<any>();
  return store.dispatchAndWait.bind(store);
}

/**
 * Dispatches the given action to the Redux store, to potentially change the state.
 *
 * This is exactly the same as the regular `dispatch`, except for the fact it
 * will throw a `StoreException` if the action is ASYNC. Note an action is ASYNC
 * if any of its `reduce()` or `before()` methods return a Promise.
 *
 * The only use for `dispatchSync` is when you need to guarantee (in runtime) that your
 * action is SYNC, which means the state gets changed right after the dispatch call.
 */
export function useDispatchSync(): (action: ReduxAction<any>) => void {
  let store = _useStoreFromContext<any>();
  return store.dispatchSync.bind(store);
}

export function useIsWaiting(type: { new(...args: any[]): ReduxAction<any> }): boolean {
  return _useStoreSelector<any, boolean>((store) => store.isWaiting(type));
}

export function useIsFailed(type: { new(...args: any[]): ReduxAction<any> }): boolean {
  return _useStoreSelector<any, boolean>((store) => store.isFailed(type));
}

export function useExceptionFor(type: { new(...args: any[]): ReduxAction<any> }): UserException | null {
  return _useStoreSelector<any, UserException | null>((store) => store.exceptionFor(type));
}

/**
 * Removes the exact given action `type` from the list of action types that failed.
 * Note it clears the EXACT given type. Subtypes are not considered.
 *
 * Even if you never call this method explicitly, just dispatching an action already clears that action type
 * from the list of failing action types. But you can call this method explicitly if you want to clear the
 * action type before it's used again.
 *
 * Usage:
 * ```ts
 * const clearExceptionFor = useClearExceptionFor();
 * clearExceptionFor(MyAction);
 * clearExceptionFor(AnotherAction);
 * ```
 */
export function useClearExceptionFor(): (type: { new(...args: any[]): ReduxAction<any> }) => void {
  const store = _useStoreFromContext<any>();
  return (type: { new(...args: any[]): ReduxAction<any> }) => {
    store.clearExceptionFor(type);
  };
}

function _useStoreSelector<St, T>(selector: (store: Store<St>) => T): T {

  // This ref will persist for the full lifetime of the component.
  let ref = useRef<RefStore<St, T>>();

  // The initial value is the value selected from the current state in the store.
  let store: Store<St> = _useStoreFromContext<St>();
  const [value, setValue] = useState(() => selector(store));

  // Only once when the component mounts.
  useEffect(() => {

    // We save in the ref:
    // - The selector
    // - The currently selected value
    // - The setValue function
    //
    // Whenever the state changes, the store will:
    // 1. Retrieve all refs
    // 2. Apply each selector to the current state to calculate the selected value.
    // 3. And compare the selected value with the last selected value.
    // 4. If it changed, it calls setValue.
    ref.current = new RefStore<St, T>([selector, value, setValue]);

    // Save the new ref.
    store._refStoreHooks.add(ref);

    return () => {
      // When the component unmounts, delete the ref.
      store._refStoreHooks.delete(ref);
    };

  }, []);

  return value;
}

function _useStoreFromContext<St>(): Store<St> {
  const context = useContext<StoreContextType<St>>(StoreContext) as StoreContextType<St>;
  if (context === undefined) {
    throw new StoreException('useStore must be used within a StoreProvider');
  }
  return context.store as Store<St>;
}

/**
 * Helper class that allows us to write:
 *
 * ```js
 * const store = useStore();
 * store.dispatch(new MyAction());
 * store.dispatchSync(new MyAction());
 * await store.dispatchAndWait(new MyAction());
 * ```
 */
class StoreDispatchers<St> {

  constructor(public store: Store<St>) {
  }

  /**
   * Dispatches the action to the Redux store, to potentially change the state.
   */
  dispatch(action: ReduxAction<any>): void {
    return this.store.dispatch(action);
  }

  /**
   * Dispatches an action and returns a promise that resolves when the action finishes.
   * While the state change from the action's reducer will have been applied when the promise
   * resolves, other independent processes that the action may have started may still be in
   * progress.
   *
   * Usage: `await store.dispatchAndWait(new MyAction())`.
   */
  dispatchAndWait(action: ReduxAction<any>): Promise<ActionStatus> {
    return this.store.dispatchAndWait(action);
  }

  /**
   * Dispatches the given action to the Redux store, to potentially change the state.
   *
   * This is exactly the same as the regular `dispatch`, except for the fact it
   * will throw a `StoreException` if the action is ASYNC. Note an action is ASYNC
   * if any of its `reduce()` or `before()` methods return a Promise.
   *
   * The only use for `dispatchSync` is when you need to guarantee (in runtime) that your
   * action is SYNC, which means the state gets changed right after the dispatch call.
   */
  dispatchSync(action: ReduxAction<any>): void {
    return this.store.dispatchSync(action);
  }

  /**
   * Returns a promise which will resolve when the given state `condition` is true.
   * If the condition is already true when the method is called, the promise resolves immediately.
   *
   * You may also provide a `timeoutMillis`, which by default is 10 minutes. If you want, you
   * can modify `TimeoutException.defaultTimeoutMillis` to change the default timeout.
   * To disable the timeout, make it 0 or -1.
   *
   * This method is useful in tests, and it returns the action which changed
   * the store state into the condition, in case you need it:
   *
   * ```typescript
   * let action = await store.waitCondition((state) => state.name == "Bill");
   * expect(action instanceof ChangeNameAction).toBe(true);
   *
   * This method is also eventually useful in production code, in which case you
   * should avoid waiting for conditions that may take a very long time to complete,
   * as checking the condition is an overhead to every state change.
   *
   * Examples:
   *
   * // Dispatches an actions that changes the state, then await for the state change:
   * expect(store.state.name, 'John')
   * dispatch(new ChangeNameAction("Bill"));
   * let action = await store.waitCondition((state) => state.name == "Bill");
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(store.state.name, 'Bill');
   *
   * // Dispatches actions and wait until no actions are in progress.
   * dispatch(new BuyStock('IBM'));
   * dispatch(new BuyStock('TSLA'));
   * await waitAllActions([]);
   * expect(state.stocks, ['IBM', 'TSLA']);
   *
   * // Dispatches two actions in PARALLEL and wait for their TYPES:
   * expect(store.state.portfolio, ['TSLA']);
   * dispatch(new BuyAction('IBM'));
   * dispatch(new SellAction('TSLA'));
   * await store.waitAllActionTypes([BuyAction, SellAction]);
   * expect(store.state.portfolio, ['IBM']);
   *
   * // Dispatches actions in PARALLEL and wait until no actions are in progress.
   * dispatch(new BuyAction('IBM'));
   * dispatch(new BuyAction('TSLA'));
   * await store.waitAllActions([]);
   * expect(store.state.portfolio.includes('IBM', 'TSLA')).toBe(false);
   *
   * // Dispatches two actions in PARALLEL and wait for them:
   * let action1 = new BuyAction('IBM');
   * let action2 = new SellAction('TSLA');
   * dispatch(action1);
   * dispatch(action2);
   * await store.waitAllActions([action1, action2]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Dispatches two actions in SERIES and wait for them:
   * await dispatchAndWait(new BuyAction('IBM'));
   * await dispatchAndWait(new SellAction('TSLA'));
   * expect(store.state.portfolio.includes('IBM', 'TSLA')).toBe(false);
   *
   * // Wait until some action of a given type is dispatched.
   * dispatch(new DoALotOfStuffAction());
   * let action = store.waitActionType(ChangeNameAction);
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(action.status.isCompleteOk).toBe(true);
   * expect(store.state.name, 'Bill');
   *
   * // Wait until some action of the given types is dispatched.
   * dispatch(new ProcessStocksAction());
   * let action = store.waitAnyActionTypeFinishes([BuyAction, SellAction]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   *
   * See also:
   * `waitCondition` - Waits until the state is in a given condition.
   * `waitActionCondition` - Waits until the actions in progress meet a given condition.
   * `waitAllActions` - Waits until the given actions are NOT in progress, or no actions are in progress.
   * `waitActionType` - Waits until an action of a given type is NOT in progress.
   * `waitAllActionTypes` - Waits until all actions of the given type are NOT in progress.
   * `waitAnyActionTypeFinishes` - Waits until ANY action of the given types finish dispatching.
   */
  waitCondition(
    condition: (state: St) => boolean,
    timeoutMillis: number | null = null
  ): Promise<St> {
    return this.store.waitCondition(condition, timeoutMillis);
  }

  /**
   * Returns a Promise that resolves when some actions meet the given `condition`.
   *
   * If `completeImmediately` is false (the default), this method will throw an error if the
   * condition was already true when the method was called. Otherwise, the promise will complete
   * immediately and throw no error.
   *
   * The `condition` is a function that takes the set of actions "in progress", as well as an
   * action that just entered the set (by being dispatched) or left the set (by finishing
   * dispatching). The function should return `true` when the condition is met, and `false`
   * otherwise. For example:
   *
   * ```ts
   * let action = await store.waitActionCondition((actionsInProgress, triggerAction) => { ... });
   * ```
   *
   * Important: Your condition function should NOT modify the set of actions.
   *
   * You get back the set of the actions being dispatched that met the condition, as well as
   * the action that triggered the condition by being added or removed from the set.
   *
   * Note: The condition is only checked when some action is dispatched or finishes dispatching.
   * It's not checked every time action statuses change.
   *
   * You may also provide a `timeoutMillis`, which by default is 10 minutes.
   * To disable the timeout, make it 0 or -1.
   * If you want, you can modify `TimeoutException.defaultTimeoutMillis` to change the default timeout.
   *
   * Examples:
   *
   * ```ts
   * // Dispatches an actions that changes the state, then await for the state change:
   * expect(store.state.name).toBe('John');
   * dispatch(new ChangeNameAction("Bill"));
   * let action = await store.waitCondition((state) => state.name == "Bill");
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Dispatches actions and wait until no actions are in progress.
   * dispatch(new BuyStock('IBM'));
   * dispatch(new BuyStock('TSLA'));
   * await waitAllActions();
   * expect(state.stocks).toBe(['IBM', 'TSLA']);
   *
   * // Dispatches two actions in PARALLEL and wait for their TYPES:
   * expect(store.state.portfolio).toBe(['TSLA']);
   * dispatch(new BuyAction('IBM'));
   * dispatch(new SellAction('TSLA'));
   * await store.waitAllActionTypes([BuyAction, SellAction]);
   * expect(store.state.portfolio).toBe(['IBM']);
   *
   * // Dispatches actions in PARALLEL and wait until no actions are in progress.
   * dispatch(new BuyAction('IBM'));
   * dispatch(new BuyAction('TSLA'));
   * await store.waitAllActions();
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(true);
   *
   * // Dispatches two actions in PARALLEL and wait for them:
   * let action1 = new BuyAction('IBM');
   * let action2 = new SellAction('TSLA');
   * dispatch(action1);
   * dispatch(action2);
   * await store.waitAllActions([action1, action2]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Dispatches two actions in SERIES and wait for them:
   * await dispatchAndWait(new BuyAction('IBM'));
   * await dispatchAndWait(new SellAction('TSLA'));
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Wait until some action of a given type is dispatched.
   * dispatch(new DoALotOfStuffAction());
   * let action = await store.waitActionType(ChangeNameAction);
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(action.status.isCompleteOk).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Wait until some action of the given types is dispatched.
   * dispatch(new ProcessStocksAction());
   * let action = await store.waitAnyActionTypeFinishes([BuyAction, SellAction]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   *  ```
   *
   * See also:
   * `waitCondition` - Waits until the state is in a given condition.
   * `waitActionCondition` - Waits until the actions in progress meet a given condition.
   * `waitAllActions` - Waits until the given actions are NOT in progress, or no actions are in progress.
   * `waitActionType` - Waits until an action of a given type is NOT in progress.
   * `waitAllActionTypes` - Waits until all actions of the given type are NOT in progress.
   * `waitAnyActionTypeFinishes` - Waits until ANY action of the given types finish dispatching.
   *
   * You should only use this method in tests.
   */
  async waitActionCondition(
    //
    /// The condition receives the current actions in progress, and the action that triggered the condition.
    condition:
      (
        actions: Set<ReduxAction<St>>,
        triggerAction: ReduxAction<St> | null
      ) => boolean,
    {
      // If `completeImmediately` is `false` (the default), this method will throw an error if the
      // condition is already true when the method is called. Otherwise, the promise will complete
      // immediately and throw no error.
      completeImmediately = false,
      //
      // The maximum time to wait for the condition to be met. The default is 10 minutes.
      // To disable the timeout, make it 0 or -1.
      timeoutMillis = null,
    }: {
      completeImmediately?: boolean,
      timeoutMillis?: number | null
    } = {})
    : Promise<{ actions: Set<ReduxAction<St>>, triggerAction: ReduxAction<St> | null }> {

    return this.store.waitActionCondition(
      condition, {
        completeImmediately: completeImmediately,
        timeoutMillis: timeoutMillis
      });
  }

  /**
   * Returns a promise that resolves when ALL given actions finished dispatching.
   *
   * If `completeImmediately` is false (the default), this method will throw an error if none
   * of the given actions are in progress when the method is called. Otherwise, the promise will
   * complete immediately and throw no error.
   *
   * However, if you don't provide any actions (empty list or `null`), the promise will complete
   * when ALL current actions in progress finish dispatching. In other words, when no actions are
   * currently in progress. In this case, if [completeImmediately] is `false`, the method will
   * throw an error if no actions are in progress when the method is called.
   *
   * Note: Waiting until no actions are in progress should only be done in test, never in
   * production, as it's very easy to create a deadlock. However, waiting for specific actions to
   * finish is safe in production, as long as you're waiting for actions you just dispatched.
   *
   * You may also provide a [timeoutMillis], which by default is 10 minutes.
   * To disable the timeout, make it 0 or -1.
   * If you want, you can modify `TimeoutException.defaultTimeoutMillis` to change the default timeout.
   *
   * Examples:
   *
   * ```ts
   * // Dispatches an actions that changes the state, then await for the state change:
   * expect(store.state.name).toBe('John');
   * dispatch(new ChangeNameAction("Bill"));
   * let action = await store.waitCondition((state) => state.name == "Bill");
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Dispatches actions and wait until no actions are in progress.
   * dispatch(new BuyStock('IBM'));
   * dispatch(new BuyStock('TSLA'));
   * await waitAllActions();
   * expect(state.stocks).toBe(['IBM', 'TSLA']);
   *
   * // Dispatches two actions in PARALLEL and wait for their TYPES:
   * expect(store.state.portfolio).toBe(['TSLA']);
   * dispatch(new BuyAction('IBM'));
   * dispatch(new SellAction('TSLA'));
   * await store.waitAllActionTypes([BuyAction, SellAction]);
   * expect(store.state.portfolio).toBe(['IBM']);
   *
   * // Dispatches actions in PARALLEL and wait until no actions are in progress.
   * dispatch(new BuyAction('IBM'));
   * dispatch(new BuyAction('TSLA'));
   * await store.waitAllActions();
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(true);
   *
   * // Dispatches two actions in PARALLEL and wait for them:
   * let action1 = new BuyAction('IBM');
   * let action2 = new SellAction('TSLA');
   * dispatch(action1);
   * dispatch(action2);
   * await store.waitAllActions([action1, action2]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Dispatches two actions in SERIES and wait for them:
   * await dispatchAndWait(new BuyAction('IBM'));
   * await dispatchAndWait(new SellAction('TSLA'));
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Wait until some action of a given type is dispatched.
   * dispatch(new DoALotOfStuffAction());
   * let action = await store.waitActionType(ChangeNameAction);
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(action.status.isCompleteOk).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Wait until some action of the given types is dispatched.
   * dispatch(new ProcessStocksAction());
   * let action = await store.waitAnyActionTypeFinishes([BuyAction, SellAction]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   *  ```
   *
   * See also:
   * `waitCondition` - Waits until the state is in a given condition.
   * `waitActionCondition` - Waits until the actions in progress meet a given condition.
   * `waitAllActions` - Waits until the given actions are NOT in progress, or no actions are in progress.
   * `waitActionType` - Waits until an action of a given type is NOT in progress.
   * `waitAllActionTypes` - Waits until all actions of the given type are NOT in progress.
   * `waitAnyActionTypeFinishes` - Waits until ANY action of the given types finish dispatching.
   *
   * You should only use this method in tests.
   */
  waitAllActions(
    actions: ReduxAction<St>[] | null,
    {
      completeImmediately = false,
      timeoutMillis = null
    }: {
      completeImmediately?: boolean,
      timeoutMillis?: number | null
    } = {}): Promise<{ actions: Set<ReduxAction<St>>, triggerAction: ReduxAction<St> | null }> {

    return this.store.waitAllActions(
      actions, {
        completeImmediately: completeImmediately,
        timeoutMillis: timeoutMillis
      });
  }

  /**
   * Returns a promise that completes when an action of the given type in NOT in progress
   * (it's not being dispatched):
   *
   * - If NO action of the given type is currently in progress when the method is called,
   *   and `completeImmediately` is false (the default), this method will throw an error.
   *
   * - If NO action of the given type is currently in progress when the method is called,
   *   and `completeImmediately` is true, the promise completes immediately, returns `null`,
   *   and throws no error.
   *
   * - If an action of the given type is in progress, the promise completes when the action
   *   finishes, and returns the action. You can use the returned action to check its `status`:
   *
   *   ```dart
   *   var action = await store.waitActionType(MyAction);
   *   expect(action.status.originalError, isA<UserException>());
   *   ```
   *
   * You may also provide a `timeoutMillis`, which by default is 10 minutes.
   * To disable the timeout, make it 0 or -1.
   * If you want, you can modify `TimeoutException.defaultTimeoutMillis` to change the default timeout.
   *
   * Examples:
   *
   * ```ts
   * // Dispatches an actions that changes the state, then await for the state change:
   * expect(store.state.name).toBe('John');
   * dispatch(new ChangeNameAction("Bill"));
   * let action = await store.waitCondition((state) => state.name == "Bill");
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Dispatches actions and wait until no actions are in progress.
   * dispatch(new BuyStock('IBM'));
   * dispatch(new BuyStock('TSLA'));
   * await waitAllActions();
   * expect(state.stocks).toBe(['IBM', 'TSLA']);
   *
   * // Dispatches two actions in PARALLEL and wait for their TYPES:
   * expect(store.state.portfolio).toBe(['TSLA']);
   * dispatch(new BuyAction('IBM'));
   * dispatch(new SellAction('TSLA'));
   * await store.waitAllActionTypes([BuyAction, SellAction]);
   * expect(store.state.portfolio).toBe(['IBM']);
   *
   * // Dispatches actions in PARALLEL and wait until no actions are in progress.
   * dispatch(new BuyAction('IBM'));
   * dispatch(new BuyAction('TSLA'));
   * await store.waitAllActions();
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(true);
   *
   * // Dispatches two actions in PARALLEL and wait for them:
   * let action1 = new BuyAction('IBM');
   * let action2 = new SellAction('TSLA');
   * dispatch(action1);
   * dispatch(action2);
   * await store.waitAllActions([action1, action2]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Dispatches two actions in SERIES and wait for them:
   * await dispatchAndWait(new BuyAction('IBM'));
   * await dispatchAndWait(new SellAction('TSLA'));
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Wait until some action of a given type is dispatched.
   * dispatch(new DoALotOfStuffAction());
   * let action = await store.waitActionType(ChangeNameAction);
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(action.status.isCompleteOk).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Wait until some action of the given types is dispatched.
   * dispatch(new ProcessStocksAction());
   * let action = await store.waitAnyActionTypeFinishes([BuyAction, SellAction]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   *  ```
   *
   * See also:
   * `waitCondition` - Waits until the state is in a given condition.
   * `waitActionCondition` - Waits until the actions in progress meet a given condition.
   * `waitAllActions` - Waits until the given actions are NOT in progress, or no actions are in progress.
   * `waitActionType` - Waits until an action of a given type is NOT in progress.
   * `waitAllActionTypes` - Waits until all actions of the given type are NOT in progress.
   * `waitAnyActionTypeFinishes` - Waits until ANY action of the given types finish dispatching.
   *
   * You should only use this method in tests.
   */
  async waitActionType(
    actionType: { new(...args: any[]): ReduxAction<St> },
    {
      completeImmediately = false,
      timeoutMillis = null
    }: {
      completeImmediately?: boolean,
      timeoutMillis?: number | null
    } = {}): Promise<ReduxAction<St> | null> {
    return this.store.waitActionType(
      actionType, {
        completeImmediately: completeImmediately,
        timeoutMillis: timeoutMillis
      });
  }

  /**
   * Returns a promise that completes when ALL actions of the given type are NOT in progress
   * (none of them is being dispatched):
   *
   * - If NO action of the given types is currently in progress when the method is called,
   *   and `completeImmediately` is false (the default), this method will throw an error.
   *
   * - If NO action of the given type is currently in progress when the method is called,
   *   and `completeImmediately` is true, the promise completes immediately and throws no error.
   *
   * - If any action of the given types is in progress, the promise completes only when
   *   no action of the given types is in progress anymore.
   *
   * You may also provide a `timeoutMillis`, which by default is 10 minutes.
   * To disable the timeout, make it 0 or -1.
   * If you want, you can modify `TimeoutException.defaultTimeoutMillis` to change the default timeout.
   *
   * Examples:
   *
   * ```ts
   * // Dispatches an actions that changes the state, then await for the state change:
   * expect(store.state.name).toBe('John');
   * dispatch(new ChangeNameAction("Bill"));
   * let action = await store.waitCondition((state) => state.name == "Bill");
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Dispatches actions and wait until no actions are in progress.
   * dispatch(new BuyStock('IBM'));
   * dispatch(new BuyStock('TSLA'));
   * await waitAllActions();
   * expect(state.stocks).toBe(['IBM', 'TSLA']);
   *
   * // Dispatches two actions in PARALLEL and wait for their TYPES:
   * expect(store.state.portfolio).toBe(['TSLA']);
   * dispatch(new BuyAction('IBM'));
   * dispatch(new SellAction('TSLA'));
   * await store.waitAllActionTypes([BuyAction, SellAction]);
   * expect(store.state.portfolio).toBe(['IBM']);
   *
   * // Dispatches actions in PARALLEL and wait until no actions are in progress.
   * dispatch(new BuyAction('IBM'));
   * dispatch(new BuyAction('TSLA'));
   * await store.waitAllActions();
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(true);
   *
   * // Dispatches two actions in PARALLEL and wait for them:
   * let action1 = new BuyAction('IBM');
   * let action2 = new SellAction('TSLA');
   * dispatch(action1);
   * dispatch(action2);
   * await store.waitAllActions([action1, action2]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Dispatches two actions in SERIES and wait for them:
   * await dispatchAndWait(new BuyAction('IBM'));
   * await dispatchAndWait(new SellAction('TSLA'));
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Wait until some action of a given type is dispatched.
   * dispatch(new DoALotOfStuffAction());
   * let action = await store.waitActionType(ChangeNameAction);
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(action.status.isCompleteOk).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Wait until some action of the given types is dispatched.
   * dispatch(new ProcessStocksAction());
   * let action = await store.waitAnyActionTypeFinishes([BuyAction, SellAction]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   *  ```
   *
   * See also:
   * `waitCondition` - Waits until the state is in a given condition.
   * `waitActionCondition` - Waits until the actions in progress meet a given condition.
   * `waitAllActions` - Waits until the given actions are NOT in progress, or no actions are in progress.
   * `waitActionType` - Waits until an action of a given type is NOT in progress.
   * `waitAllActionTypes` - Waits until all actions of the given type are NOT in progress.
   * `waitAnyActionTypeFinishes` - Waits until ANY action of the given types finish dispatching.
   *
   * You should only use this method in tests.
   */
  async waitAllActionTypes(
    actionTypes: { new(...args: any[]): ReduxAction<any> }[],
    {
      completeImmediately = false,
      timeoutMillis = null
    }: {
      completeImmediately?: boolean,
      timeoutMillis?: number | null
    } = {}): Promise<void> {
    return this.store.waitAllActionTypes(
      actionTypes, {
        completeImmediately: completeImmediately,
        timeoutMillis: timeoutMillis
      });
  }

  /**
   * Returns a promise which will complete when ANY action of the given types FINISHES
   * dispatching. IMPORTANT: This method is different from the other similar methods, because
   * it does NOT complete immediately if no action of the given types is in progress. Instead,
   * it waits until an action of the given types finishes dispatching, even if they
   * were not yet in progress when the method was called.
   *
   * This method returns the action that completed the promise, which you can use to check
   * its `status`.
   *
   * It's useful when the actions you are waiting for are not yet dispatched when you call this
   * method. For example, suppose action `StartAction` starts a process that takes some time
   * to run and then dispatches an action called `MyFinalAction`. You can then write:
   *
   * ```dart
   * dispatch(StartAction());
   * let action = await store.waitAnyActionTypeFinishes([MyFinalAction]);
   * expect(action.status.originalError).toBeInstanceOf(UserException>);
   * ```
   *
   * You may also provide a `timeoutMillis`, which by default is 10 minutes.
   * To disable the timeout, make it 0 or -1.
   * If you want, you can modify `TimeoutException.defaultTimeoutMillis` to change the default timeout.
   *
   * Examples:
   *
   * ```ts
   * // Dispatches an actions that changes the state, then await for the state change:
   * expect(store.state.name).toBe('John');
   * dispatch(new ChangeNameAction("Bill"));
   * let action = await store.waitCondition((state) => state.name == "Bill");
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Dispatches actions and wait until no actions are in progress.
   * dispatch(new BuyStock('IBM'));
   * dispatch(new BuyStock('TSLA'));
   * await waitAllActions();
   * expect(state.stocks).toBe(['IBM', 'TSLA']);
   *
   * // Dispatches two actions in PARALLEL and wait for their TYPES:
   * expect(store.state.portfolio).toBe(['TSLA']);
   * dispatch(new BuyAction('IBM'));
   * dispatch(new SellAction('TSLA'));
   * await store.waitAllActionTypes([BuyAction, SellAction]);
   * expect(store.state.portfolio).toBe(['IBM']);
   *
   * // Dispatches actions in PARALLEL and wait until no actions are in progress.
   * dispatch(new BuyAction('IBM'));
   * dispatch(new BuyAction('TSLA'));
   * await store.waitAllActions();
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(true);
   *
   * // Dispatches two actions in PARALLEL and wait for them:
   * let action1 = new BuyAction('IBM');
   * let action2 = new SellAction('TSLA');
   * dispatch(action1);
   * dispatch(action2);
   * await store.waitAllActions([action1, action2]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Dispatches two actions in SERIES and wait for them:
   * await dispatchAndWait(new BuyAction('IBM'));
   * await dispatchAndWait(new SellAction('TSLA'));
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   * expect(store.state.portfolio.includes('TSLA')).toBe(false);
   *
   * // Wait until some action of a given type is dispatched.
   * dispatch(new DoALotOfStuffAction());
   * let action = await store.waitActionType(ChangeNameAction);
   * expect(action instanceof ChangeNameAction).toBe(true);
   * expect(action.status.isCompleteOk).toBe(true);
   * expect(store.state.name).toBe('Bill');
   *
   * // Wait until some action of the given types is dispatched.
   * dispatch(new ProcessStocksAction());
   * let action = await store.waitAnyActionTypeFinishes([BuyAction, SellAction]);
   * expect(store.state.portfolio.includes('IBM')).toBe(true);
   *  ```
   *
   * See also:
   * `waitCondition` - Waits until the state is in a given condition.
   * `waitActionCondition` - Waits until the actions in progress meet a given condition.
   * `waitAllActions` - Waits until the given actions are NOT in progress, or no actions are in progress.
   * `waitActionType` - Waits until an action of a given type is NOT in progress.
   * `waitAllActionTypes` - Waits until all actions of the given type are NOT in progress.
   * `waitAnyActionTypeFinishes` - Waits until ANY action of the given types finish dispatching.
   *
   * You should only use this method in tests.
   */
  async waitAnyActionTypeFinishes(
    actionTypes: { new(...args: any[]): ReduxAction<St> }[],
    {
      timeoutMillis = null
    }: {
      completeImmediately?: boolean,
      timeoutMillis?: number | null
    } = {}): Promise<ReduxAction<St>> {
    return this.store.waitAnyActionTypeFinishes(
      actionTypes, {
        timeoutMillis: timeoutMillis
      });
  }
}

class RefState<St, T> {
  selectorAndValueAndSetValue: [(state: St) => T, T, React.Dispatch<React.SetStateAction<T>>];

  constructor(selectorAndValueAndSetValue: [(state: St) => T, T, React.Dispatch<React.SetStateAction<T>>]) {
    this.selectorAndValueAndSetValue = selectorAndValueAndSetValue;
  }
}

class RefStore<St, T> {
  selectorAndValueAndSetValue: [(store: Store<St>) => T, T, React.Dispatch<React.SetStateAction<T>>];

  constructor(selectorAndValueAndSetValue: [(store: Store<St>) => T, T, React.Dispatch<React.SetStateAction<T>>]) {
    this.selectorAndValueAndSetValue = selectorAndValueAndSetValue;
  }
}
