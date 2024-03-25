import { Store } from "./Store";
import { StoreException } from "./StoreException";

/**
 * A SYNC reducer can return:
 * - `St`: A new state, changed synchronously.
 * - `null`: No state change
 *
 * An ASYNC reducer can return:
 * - `Promise<(state: St) => St>`: A new state, changed asynchronously.
 * - `Promise<(state: St) => null>`: No state change
 * - `Promise<null>`: No state change
 */
export type ReduxReducer<St> = St | null | Promise<((state: St) => (St | null)) | null>;

/**
 * A SYNC reducer can return:
 * - `St`: A new state, changed synchronously
 * - `null`: No state change
 */
export type SyncReducer<St> = St | null;

/**
 * An ASYNC reducer can return:
 * - `Promise<(state: St) => St>`: A new state, changed asynchronously
 * - `Promise<(state: St) => null>`: No state change
 * - `Promise<null>`: No state change
 */
export type AsyncReducer<St> = Promise<((state: St) => (St | null)) | null>;

export type AsyncReducerResult<St> = ((state: St) => (St | null)) | null;

export abstract class ReduxAction<St> {

  get attempts(): number {
    return this._retry.attempts;
  }

  /**
   * The `reduce()` method is the Reducer. It MUST be implemented by the action.
   *
   * A reducer can return:
   * - `St`: A new state, changed synchronously.
   * - `null`: No state change, decided synchronously.
   * - `Promise<(state: St) => St>`: A new state, changed asynchronously.
   * - `Promise<(state: St) => null>`: No state change, decided asynchronously.
   * - `Promise<null>`: No state change, decided asynchronously.
   */
  abstract reduce(): St | null | Promise<((state: St) => (St | null)) | null>;

  /**
   * The `before()` method MAY be implemented by the action. If implemented, it runs before the
   * reducer. It may be sync or async. If it's async, the reducer will run after the before
   * resolves.
   *
   * This method is useful for actions that need to perform some checks before executing the
   * reducer. For example, if an action needs internet connection, it can check the presence of
   * the connection before executing the reducer. If the connection is not present, the before
   * method can throw a `UserException("Please, check your internet connection.");`. This will
   * prevent the reducer from running.
   *
   * Note the `after` method always runs, even if the before method throws an exception.
   */
  before(): void | Promise<void> {
  }

  /**
   * The `after()` method MAY be implemented by the action. If implemented, it runs after the
   * `before()`, after `reduce()`, and after `wrapError()`.
   *
   * The `after()` method is always synchronous, and it will always be called when the action is
   * dispatched, even if errors were thrown by `before` or `reduce`.
   */
  after(): void {
  }

  /**
   * If any error is thrown by `reduce` or `before`, you have the chance to further process it
   * by using `wrapError`. Usually this is used to wrap the error inside another that better
   * describes the failed action.
   *
   * For example, if some input validation inside your action throws a `ValidationError`,
   * then instead of throwing this error you could do:
   *
   * ```
   * wrapError(error) { return new UserException("Please enter a valid input.", {cause: error}) }
   * ```
   *
   * If you want to disable the error you can return `null`. For example, if you want
   * to disable all errors of type `MyException`:
   *
   * ```
   * wrapError(error) { return (error instanceof MyException) ? null : error }
   * ```
   *
   * IMPORTANT: If instead of RETURNING an error you throw an error inside the `wrapError` method,
   * AsyncRedux will catch this error and use it instead the original error. In other words,
   * returning an error or throwing an error works the same way. But it's recommended that you
   * return the error instead of throwing it anyway.
   *
   * IMPORTANT: Apart from defining `wrapError()` methods per action, you can also define a
   * global `wrapError` as a store parameter when you create the Store.
   */
  wrapError(error: any): any {
    return error;
  };

  private _store: Store<St> | null = null;
  private _resolve: ((value: ActionStatus) => void) | null = null;
  private _status = new ActionStatus();
  private _initialState: St | null = null;

  /**
   * Dispatches an action to the Redux store.
   */
  protected dispatch(action: ReduxAction<St>): void {
    this.store.dispatch(action);
  }

  /**
   * Dispatches an action and returns a promise that resolves when the action finishes.
   * While the state change from the action's reducer will have been applied when the promise
   * resolves, other independent processes that the action may have started may still be in
   * progress.
   *
   * Usage: `await this.dispatchAndWait(new MyAction())`.
   */
  protected dispatchAndWait(action: ReduxAction<St>): Promise<ActionStatus> {
    return this.store.dispatchAndWait(action);
  }

  /**
   * Returns the Redux store: `this.store`.
   *
   * To read the current state inside an action, use: `this.store.state` or simply `this.state`.
   * Note this is the CURRENT state, meaning it may change each time you look at it.
   *
   * If you want the snapshot of the state as it was when the action was dispatched, you can
   * use `this.initialState`. You can also make a copy of the current state at any point in time:
   *
   * ```ts
   * let currentState = this.state;
   * ```
   *
   * To dispatch an action inside the current action, you can simply write `this.dispatch()`
   * or `this.dispatchAndWait()`, which is the same as `this.store.dispatch()` etc.
   */
  protected get store(): Store<St> {
    if (this._store === null) throw new StoreException('Store not set in action');
    return this._store;
  }

  /**
   * Returns the CURRENT state: `this.state`.
   * Note this is the CURRENT state, meaning it may change each time you look at it.
   *
   * If you want a snapshot of the state as it was when the action was dispatched, you can
   * use `this.initialState`. You can also make a copy of the current state at any point in time:
   *
   * ```ts
   * let currentState = this.state;
   * ```
   *
   * To dispatch an action inside the current action, you can simply write `this.dispatch()`
   * or `this.dispatchAndWait()`, which is the same as `this.store.dispatch()` etc.
   */
  protected get state(): St {
    return this.store.state;
  }

  /**
   * Returns the state as it was when the action was dispatched.
   *
   * It can be the same or different from `this.state`, which is the current state in the store,
   * because other actions may have changed the current state since this action was dispatched.
   *
   * In the case of SYNC actions that do not dispatch other SYNC actions,
   * `this.state` and `this.initialState` will be the same.
   */
  get initialState(): St {
    return this._initialState as St;
  }

  /**
   * You can wrap the reducer to allow for some pre- or post-processing.
   * For instance, if you want to prevent an async reducer from modifying the current state,
   * if the current state has already changed since the reducer started:
   *
   * ```ts
   * wrapReduce(reduce: () => St | null | Promise<((state: St) => (St | null)) | null>): () => St | null | Promise<((state: St) => (St | null)) | null> {
   *     let oldState = this.state;
   *     let newState = await reduce();
   *     return oldState === this.state ? newState : null;
   * }
   * ```
   *
   * Note: If you return a function that returns a Promise, the action will be ASYNC.
   * If you return a function that returns St, the action will be SYNC only if the
   * before and reduce methods are also SYNC.
   */
  wrapReduce(reduce: () => ReduxReducer<St>): () => ReduxReducer<St> {
    return reduce;
  }

  /**
   * Returns the "status" of the action, used to keep track of the action's lifecycle. If you have
   * a reference to the action you can check its status at any time with `action.status`:
   *
   * ```ts
   * const action = new MyAction();
   * await store.dispatchAndWait(new MyAction());
   * if (action.isFinishedWithNoErrors) { ... }
   * ```
   * However, dispatchAndWait also returns the action status after it finishes:
   *
   * ```ts
   * const status = await store.dispatchAndWait(new MyAction());
   * if (status.isFinishedWithNoErrors) { ... }
   * ```
   */
  get status() {
    return this._status;
  }

  /**
   * If method `abortDispatch()` returns true, the action will not be dispatched: `before`,
   * `reduce` and `after` will not be called. This is an advanced feature only useful under rare
   * circumstances, and you should only use it if you know what you are doing.
   */
  abortDispatch(): boolean {
    return false;
  }

  /**
   * Method `abortReduce()` is called with the result of the `reduce()` method, right after
   * the `reduce()` runs. However, it's only called if no error was thrown, and if the `reduce()`
   * method result would change the current state (in other words, if `reduce()` returned a
   * non-null state different from the current state).
   *
   * If `abortReduce()` returns true, the result of the `reduce()` method will be discarded,
   * as if the `reduce()` method itself returned null.
   *
   * Note: `abortReduce()` is called BEFORE the `after()` method, and the `after()` method will
   * run normally no mather the result of `abortReduce()`.
   *
   * For example, suppose you want to abort an async action if some part of the state changed
   * since when the action was dispatched:
   * ```
   * abortReduce(state: St): boolean {
   *    return (state.somePart !== this.initialState.somePart);
   * }
   * ```
   *
   * Method `abortReduce()` is an advanced feature only useful under rare circumstances,
   * and you should only use it if you know what you are doing.
   */
  abortReduce(state: St): boolean {
    return false;
  }

  /**
   * If your action overrides this method returning `true`, it will abort the action in
   * case the action is still running from a previous dispatch. For example:
   *
   * ```ts
   * class MyAction extends ReduxAction<State> {
   *    nonReentrant = true;
   * }
   * ```
   */
  nonReentrant: boolean = false;

  /**
   * To retry the `reduce` method when it throws an error:
   *
   * ```ts
   * class MyAction extends ReduxAction<State> {
   *    retry = {on: true}
   * }
   * ```
   *
   * The retry parameters are:
   *
   * - Initial Delay: The delay before the first retry attempt.
   * - Multiplier: The factor by which the delay increases for each subsequent retry.
   * - Maximum Retries: The maximum number of retries before giving up.
   * - Maximum Delay: The maximum delay between retries to avoid excessively long wait times.
   *
   *  And their default values are:
   *
   * - `initialDelay` is `350` milliseconds.
   * - `multiplier` is `2`, which means the default delays are: 350 millis, 700 millis, and 1.4 seg.
   * - `maxRetries` is `3`, meaning it will try a total of 4 times.
   * - `maxDelay` is `5000` milliseconds (which means 5 seconds).
   *
   * You can change one or more of the default values.
   * Doing so also turns on the retry:
   *
   * ```ts
   * class MyAction extends ReduxAction<State> {
   *    retry = {initialDelay: 100, multiplier: 5, maxRetries: 10, maxDelay: 10000};
   * }
   * ```
   *
   * If you want to retry unlimited times, make maxRetries equal to: `-1`:
   * Note: If you `await dispatchAndWait(action)` and the action uses unlimited retries,
   * it may never finish if it keeps failing. So, be careful when using it.
   *
   * ```ts
   * class MyAction extends ReduxAction<State> {
   *    retry = {maxRetries: -1};
   * }
   * ```
   *
   * Notes:
   *
   * - If the `before` method throws an error, the retry will NOT happen.
   *
   * - The retry delay only starts after the reducer finishes executing. For example, if the
   *   reducer takes 1 second to fail, and the retry delay is 350 millis, the first retry will
   *   happen 1.35 seconds after the first reducer started.
   *
   * - When the action finally fails, the last error will be rethrown, and the previous ones
   *   will be ignored.
   *
   * - For most actions that use `retry`, consider also making them non-Reentrant to avoid
   *   multiple instances of the same action running at the same time:
   *   ```ts
   *   class MyAction extends ReduxAction<State> {
   *      retry = {on: true}
   *      nonReentrant = true;
   *   }
   *   ```
   *
   * - Keep in mind that all actions using the `retry` mixin will become asynchronous, even
   *   if the original action was synchronous.
   */
  retry?: Retry;

  _retry: RetryOptions = {
    on: false,
    attempts: 0,
    initialDelay: 350,
    multiplier: 2,
    maxRetries: 3,
    maxDelay: 5000,
    unlimitedRetries: false,
    currentDelay: 0,
  };

  get ifRetryIsOn(): boolean {
    return (this.retry as RetryOptions)?.on === true;
  }

  /**
   * For AsyncRedux internal use only.
   */
  _injectStore(_store: Store<St>) {
    this._store = _store;
    this._initialState = _store.state;

    if (!!this.retry) {
      this._retry = {...this._retry, ...this.retry, on: true};
      this.retry = this._retry;
    }
  }

  /**
   * For AsyncRedux internal use only.
   */
  _changeStatus(params: {
    isDispatched?: boolean,
    hasFinishedMethodBefore?: boolean,
    hasFinishedMethodReduce?: boolean,
    hasFinishedMethodAfter?: boolean
    originalError?: any,
    wrappedError?: any,
  } = {}) {
    this._status = this._status.copy(params);
  }

  /**
   * For AsyncRedux internal use only.
   */
  _createPromise(): Promise<ActionStatus> {
    return new Promise<ActionStatus>((resolve, _reject) => {
      this._resolve = resolve;
    });
  }

  /**
   * For AsyncRedux internal use only.
   */
  _resolvePromise(): void {
    // Resolves the promise created by `dispatchAndWait()`, and returns the action status.
    this._resolve?.(this.status);
  }

  /**
   * Prints a readable description of the action, for debugging purposes.
   * Example: `MyAction(increment:10)`.
   */
  toString(): string {
    // Initialize an array to hold key-value pairs as strings
    const keyValuePairs: string[] = [];
    for (const key of Object.keys(this)) {
      if (!key.startsWith('_') && (key != 'nonReentrant') && (key != 'retry') && (key != 'wrapReduce')) { // Continue to exclude base class/internal fields
        // For each property, push "key:value" string to the array
        // Note: This simple line assumes that `value` can be meaningfully represented as a string.
        // You might need a more complex handling for objects, arrays, etc.
        const value = (this as any)[key];
        keyValuePairs.push(`${key}:${JSON.stringify(value)}`);
      }
    }
    // Join all key-value pairs with a comma and space, and format it according to your requirements
    return `${this.constructor.name}(${keyValuePairs.join(', ').replace(/"/g, '')})`;
  }
}

/**
 * The `status` is a property of the action, used to keep track of the action's lifecycle.
 * If you have a reference to the action you can check its status at any time with `action.status`:
 *
 * ```ts
 * const action = new MyAction();
 * await store.dispatchAndWait(new MyAction());
 * if (action.isFinishedWithoutErrors) { ... }
 * ```
 *
 * However, `dispatchAndWait` also returns the action status after it finishes:
 *
 * ```ts
 * const status = await store.dispatchAndWait(new MyAction());
 * if (status.isFinishedWithoutErrors) { ... }
 * ```
 */
export class ActionStatus {

  /**
   * Returns true if the action was already dispatched. An action cannot be dispatched
   * more than once, which means that you have to create a new action each time.
   *
   * Note this may be true even if the action has not yet FINISHED dispatching.
   * To check if it has finished, use `action.isFinished`.
   */
  readonly isDispatched: boolean;

  /**
   * Is true when the `before` method finished executing normally.
   * Is false if it has not yet finished executing or if it threw an error.
   */
  readonly hasFinishedMethodBefore: boolean;

  /**
   * Is true when the `reduce` method finished executing normally, returning a value.
   * Is false if it has not yet finished executing or if it threw an error.
   */
  readonly hasFinishedMethodReduce: boolean;

  /**
   * Is true if the `after` method finished executing. Note the `after` method should
   * never throw any errors, but if it does the error will be swallowed and ignored.
   * Is false if it has not yet finished executing.
   */
  readonly hasFinishedMethodAfter: boolean;

  /**
   * Holds the error thrown by the action's before/reduce methods, if any.
   * This may or may not be equal to the error thrown by the action, because the original error
   * will still be processed by the action's `wrapError` and the `globalWrapError`. However,
   * if `originalError` is non-null, it means the reducer did not finish running.
   */
  readonly originalError: any;

  /**
   * Holds the error thrown by the action. This may or may not be the same as `originalError`,
   * because any errors thrown by the action's before/reduce methods may still be changed or
   * cancelled by the action's `wrapError` and the `globalWrapError`. This is the final error
   * after all these wraps.
   */
  readonly wrappedError: any;

  /**
   * Returns true only if the action has completed, and none of the 'before' or 'reduce'
   * methods have thrown an error. This indicates that the 'reduce' method completed and
   * returned a result (even if the result was null). The 'after' method also already ran.
   *
   * This can be useful if you need to dispatch a second method only if the first method
   * succeeded:
   *
   * ```ts
   * let action = new LoadInfo();
   * await dispatchAndWait(action);
   * if (action.isCompletedOk) dispatch(new ShowInfo());
   * ```
   *
   * Or you can also get the state directly from `dispatchAndWait`:
   *
   * ```ts
   * let status = await dispatchAndWait(new LoadInfo());
   * if (status.isCompletedOk) dispatch(new ShowInfo());
   * ```
   */
  get isCompletedOk(): boolean {
    return this.isCompleted && (this.originalError === null);
  }

  /**
   * Returns true only if the action has completed (the 'after' method already ran), but either
   * the 'before' or the 'reduce' methods have thrown an error. If this is true, it indicates that
   * the reducer could NOT complete, and could not return a value to change the state.
   */
  get isCompletedFailed(): boolean {
    return this.isCompleted && (this.originalError != null);
  }

  /**
   * Returns true only if the action has completed executing, either with or without errors.
   * If this is true, the 'after' method already ran.
   */
  get isCompleted(): boolean {
    return this.hasFinishedMethodAfter;
  }

  constructor(params: {
    isDispatched?: boolean,
    hasFinishedMethodBefore?: boolean,
    hasFinishedMethodReduce?: boolean,
    hasFinishedMethodAfter?: boolean,
    originalError?: any,
    wrappedError?: any,
  } = {}) {
    this.isDispatched = params.isDispatched ?? false;
    this.hasFinishedMethodBefore = params.hasFinishedMethodBefore ?? false;
    this.hasFinishedMethodReduce = params.hasFinishedMethodReduce ?? false;
    this.hasFinishedMethodAfter = params.hasFinishedMethodAfter ?? false;
    this.originalError = params.originalError ?? null;
    this.wrappedError = params.wrappedError ?? null;
  }

  copy(params: {
    isDispatched?: boolean,
    hasFinishedMethodBefore?: boolean,
    hasFinishedMethodReduce?: boolean,
    hasFinishedMethodAfter?: boolean
    originalError?: any,
    wrappedError?: any,
  }) {
    return new ActionStatus({
      isDispatched: params.isDispatched ?? this.isDispatched,
      hasFinishedMethodBefore: params.hasFinishedMethodBefore ?? this.hasFinishedMethodBefore,
      hasFinishedMethodReduce: params.hasFinishedMethodReduce ?? this.hasFinishedMethodReduce,
      hasFinishedMethodAfter: params.hasFinishedMethodAfter ?? this.hasFinishedMethodAfter,
      originalError: params.originalError ?? this.originalError,
      wrappedError: params.wrappedError ?? this.wrappedError,
    });
  }
}

/**
 * The `OptimisticUpdate` abstract class is designed to facilitate optimistic updates in your application.
 * This pattern can significantly enhance the user experience by immediately reflecting changes in the UI
 * before confirming those changes on the backend. It is particularly useful in scenarios where
 * you're dealing with asynchronous updates, such as saving or updating data on a remote server.
 *
 * This class provides a structured way to implement optimistic updates by defining a series of abstract
 * methods that you'll need to override in your subclasses. These methods include:
 *
 * - `newValue()`: Define the new value that you intend to add or update in your application state.
 * - `getValueFromState(state)`: Extract and return the current value from the given state.
 * - `applyState(value, state)`: Apply the given value to the specified state and return the updated state.
 * - `saveValue(newValue)`: Handle the saving of the new value to your backend or cloud service.
 * - `reloadValue()`: Optionally, reload the value from the backend to ensure the UI is in sync with the latest data.
 *
 * By implementing these methods, `OptimisticUpdate` helps manage the optimistic update process,
 * including rolling back changes if necessary. This approach allows for a smoother and more responsive
 * user interface, even when operations may fail or require more time to complete.
 *
 * ---
 *
 * The `OptimisticUpdate` abstract class is still EXPERIMENTAL. You can use it, but test it well.
 *
 * Let's use this example: We want to save a new TodoItem to a TodoList.
 *
 * This code saves the TodoItem, then reloads the TodoList from the cloud:
 *
 * ```typescript
 * class SaveTodo extends ReduxAction<AppState> {
 *    newTodo: TodoItem;
 *    constructor(newTodo: TodoItem) {
 *        super();
 *        this.newTodo = newTodo;
 *    }
 *
 *    async reduce() {
 *
 *       try {
 *          // Saves the new TodoItem to the cloud.
 *          await saveTodoItem(this.newTodo);
 *       } finally {
 *          // Loads the complete TodoList from the cloud.
 *          let reloadedTodoList = await loadTodoList();
 *          return this.state.copy({ todoList: reloadedTodoList });
 *       }
 *    }
 * }
 * ```
 *
 * The problem with the above code is that it may take a second to update the TodoList on
 * the screen, while we save then load, which is not a good user experience.
 *
 * The solution is optimistically updating the TodoList before saving the new TodoItem to the cloud:
 *
 * ```typescript
 * class SaveTodo extends ReduxAction<AppState> {
 *    newTodo: TodoItem;
 *    constructor(newTodo: TodoItem) {
 *        super();
 *        this.newTodo = newTodo;
 *    }
 *
 *    async reduce() {
 *
 *       // Updates the TodoList optimistically.
 *       this.dispatch(new UpdateStateAction((state: AppState) => state.copy({ todoList: state.todoList.add(this.newTodo) })));
 *
 *       try {
 *          // Saves the new TodoItem to the cloud.
 *          await saveTodoItem(this.newTodo);
 *       } finally {
 *          // Loads the complete TodoList from the cloud.
 *          let reloadedTodoList = await loadTodoList();
 *          this.dispatch(new UpdateStateAction((state: AppState) => state.copy({ todoList: reloadedTodoList })));
 *       }
 *    }
 * }
 * ```
 *
 * That's better. But if the saving fails, the users still have to wait for the reload until
 * they see the reverted state. We can further improve this:
 *
 * ```typescript
 * class SaveTodo extends ReduxAction<AppState> {
 *    newTodo: TodoItem;
 *    constructor(newTodo: TodoItem) {
 *        super();
 *        this.newTodo = newTodo;
 *    }
 *
 *    async reduce() {
 *
 *       // Updates the TodoList optimistically.
 *       let newTodoList = state.todoList.add(this.newTodo);
 *       this.dispatch(new UpdateStateAction((state: AppState) => state.copy({ todoList: newTodoList })));
 *
 *       try {
 *          // Saves the new TodoItem to the cloud.
 *          await saveTodoItem(this.newTodo);
 *       } catch (e) {
 *          // If the state still contains our optimistic update, we roll back.
 *          // If the state now contains something else, we DO NOT roll back.
 *          if (this.state.todoList === newTodoList) {
 *             return state.copy({ todoList: initialState.todoList }); // Rollback.
 *          }
 *       } finally {
 *          // Loads the complete TodoList from the cloud.
 *          let reloadedTodoList = await loadTodoList();
 *          this.dispatch(new UpdateStateAction((state: AppState) => state.copy({ todoList: reloadedTodoList })));
 *       }
 *    }
 * }
 * ```
 *
 * Now the user sees the rollback immediately after the saving fails.
 *
 * Note: If you are using a realtime database or WebSockets to receive real-time updates from the
 * server, you may not need the finally block above, as long as the `newTodoList` above can be
 * told apart from the current `state.todoList`. This can be a problem if the state in question
 * is a primitive (boolean, number, etc.) or string.
 *
 * The `OptimisticUpdate` abstract class helps you implement the above code for you when you
 * provide the following:
 *
 * * `newValue()`: Is the new value, that you want to see saved and applied to the state.
 * * `getValueFromState(state: St)`: Is a function that extracts the value from the given state.
 * * `reloadValue()`: Is a function that reloads the value from the cloud.
 * * `applyState(value: any, state: St)`: Is a function that applies the given value to the given state.
 */

export abstract class OptimisticUpdate<St> extends ReduxAction<St> {

  /**
   * You should return here the value that you want to update. For example, if you want to add
   * a new TodoItem to the todoList, you should return the new todoList with the new TodoItem added.
   *
   * You can access the fields of the action, and the state, and return the new value.
   */
  abstract newValue(): any;

  /**
   * Using the given `state`, you should return the `value` from that state.
   */
  abstract getValueFromState(state: St): any;

  /**
   * Using the given `state`, you should apply the given `value` to it, and return the result.
   */
  abstract applyState(value: any, state: St): St;

  /**
   * You should save the `value` or other related value in the cloud.
   */
  abstract saveValue(newValue: any): Promise<void>;

  /**
   * You should reload the `value` from the cloud.
   * If you want to skip this step, simply don't provide this method.
   */
  abstract reloadValue(): Promise<any>;

  async reduce() {
    // Updates the value optimistically.
    const _newValue = this.newValue();
    const action = new UpdateStateAction((state: St) => this.applyState(_newValue, state));
    this.dispatch(action);

    try {
      // Saves the new value to the cloud.
      await this.saveValue(_newValue);
    } catch (e) {
      // If the state still contains our optimistic update, we roll back.
      // If the state now contains something else, we DO NOT roll back.
      if (this.getValueFromState(this.state) === _newValue) {
        let initialValue = this.getValueFromState(this.initialState);
        return (state: St) => this.applyState(initialValue, state); // Rollback.
      }
    } finally {
      try {
        let reloadedValue = await this.reloadValue();
        const action = new UpdateStateAction((state: St) => this.applyState(reloadedValue, state));
        this.dispatch(action);
      } catch (e) {
        // If the reload was not implemented, do nothing.
      }
    }

    return null;
  }
}

class UpdateStateAction<St> extends ReduxAction<St> {
  updateFunction: (state: St) => St;

  constructor(updateFunction: (state: St) => St) {
    super();
    this.updateFunction = updateFunction;
  }

  reduce(): St {
    return this.updateFunction(this.state);
  }
}

export type Retry = {
  on?: boolean,
  initialDelay?: number,
  multiplier?: number,
  maxRetries?: number,
  maxDelay?: number,
  unlimitedRetries?: boolean
};

export type RetryOptions = {
  on: boolean,
  attempts: number,
  currentDelay: number,
  initialDelay: number,
  multiplier: number,
  maxRetries: number,
  maxDelay: number,
  unlimitedRetries: boolean
};
