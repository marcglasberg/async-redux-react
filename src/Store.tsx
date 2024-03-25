import React, { createContext, Dispatch, SetStateAction, useContext, useState } from 'react';
import { UserException } from './UserException';
import { Persistor } from './Persistor';
import { ActionStatus, AsyncReducer, AsyncReducerResult, ReduxAction, ReduxReducer, RetryOptions } from './ReduxAction';
import { ProcessPersistence } from './ProcessPersistence';
import { StoreException, TimeoutException } from './StoreException';
import { UnmodifiableSetView } from "./UnmodifiableSetView";

export type ShowUserException = (exception: UserException, count: number, next: () => void) => void;

interface ConstructorParams<St> {

  /**
   * The initial state of the app.
   */
  initialState: St;

  /**
   * AsyncRedux calls this function automatically when actions throw `UserException`s, so that
   * they can be shown to the user. Usually, this function opens some UI like a dialog or a toast,
   * with the error message.
   *
   * The `count` parameter is the number of exceptions still in the queue.
   *
   * You should explicitly call `next` function when the user is ready to see the next exception
   * in the queue, when the user dismisses the dialog or toast. If there are no more exceptions,
   * `next` will do nothing. Otherwise, it will call `showUserException` again. Example:
   *
   * ```ts
   * const showUserException: UserExceptionDialog =
   *   (exception, count, next) => {
   *     Alert.alert(
   *       exception.title || exception.message,
   *       exception.title ? exception.message : '',
   *       [{ text: 'OK', onPress: (value?: string) => next }]
   *     );
   *   };
   * ```
   */
  showUserException?: (exception: UserException, count: number, next: () => void) => void;

  /**
   * The persistor saves and retrieves the application's state from the local device storage,
   * ensuring data persistence across app restarts. Without a defined persistor, the app's state
   * will not be saved.
   *
   * The `Persistor` is an abstract base class, allowing developers to easily craft their custom
   * persistors. AsyncRedux makes it easy, by automatically invoking the persistor upon any state
   * modification, and passing it the information that needs to be saved as well as the last saved
   * state.
   *
   * AsyncRedux also offers a built-in `ClassPersistor` that can be used to persist the state by
   * serializing it to a string and saving it to the local device storage.
   */
  persistor?: Persistor<St>;

  /**
   * A function that AsyncRedux uses to log information.
   * If not defined, the default is printing messages to the console with `console.log()`.
   * Note: The result of this function is not used, and can be anything.   *
   * To disable it, pass it as `() => {}`.
   */
  logger?: (obj: any) => any;

  /**
   * Global function to wrap errors.
   *
   * This `globalWrapError` will be given all errors thrown in your actions, including those
   * of type `UserException`. If and action already has a `wrapError` method, that method will
   * be called first, and then the `globalWrapError` will be called with the result.
   *
   * A common use case for this is to have a global place to convert some exceptions into
   * `UserException`s. For example, Firebase may throw some `PlatformExceptions` in response to
   * a bad connection to the server. In this case, you may want to show the user a dialog
   * explaining that the connection is bad, which you can do by converting it to a `UserException`.
   * While this could also be done in the action's `wrapError`, you'd have to add it to all
   * actions that use Firebase.
   *
   * IMPORTANT: If instead of RETURNING an error you throw an error inside the `globalWrapError`
   * function, AsyncRedux will catch this error and use it instead the original error. In other
   * words, returning an error or throwing an error works the same way. But it's recommended that
   * you return the error instead of throwing it anyway.
   *
   * Note: Don't use the `globalWrapError` to log errors, as you should prefer doing that
   * in the `ErrorObserver`.
   */
  globalWrapError?: (error: any) => any;

  /**
   * An `actionObserver` can be set during the `Store` creation.
   * It's called whenever actions are dispatched, and also when they finish.
   * The action and the dispatch-count are available, as well as the `ini` parameter:
   * If `ini` is true, this is right before the action is dispatched.
   * If `ini` is false, this is right after the action finishes.
   *
   * The `actionObserver` is a good place to log which actions are dispatched by your application.
   * For example, the following code logs actions to the console in development or test mode.
   * and logs actions to Crashlytics in production mode:
   *
   * ```ts
   * actionObserver: (action, dispatchCount, ini) => {
   *   if (inDevelopment() || inTests()) {
   *      if (ini) console.log('Action dispatched: ' + action);
   *      else console.log('Action finished: ' + action);
   *   }
   *   else Crashlytics.log('Dispatched: ' + action);
   * }
   * ```
   */
  actionObserver?: (action: ReduxAction<St>, dispatchCount: number, ini: boolean) => void;

  /**
   * A `stateObserver`s can be set during the `Store` creation.
   * It's called for all dispatched actions, right after the reducer returns, before
   * the action's `after()` method, before the action's `wrapError()`, and before
   * the `globalWrapError()`.
   *
   * The parameters are:
   *
   * - action = The action itself.
   *
   * - prevState = The state right before the new state returned by the reducer is applied. Note
   *              this may be different from the state when the action was dispatched.
   *
   * - newState = The state returned by the reducer. Note: If you need to know if the state was
   *             changed or not by the reducer, you can compare both states:
   *             `let ifStateChanged = prevState !=== newState;`
   *
   * - error = Is null if the reducer completed with no error and returned. Otherwise, will be the
   *           error thrown by the reducer (before any wrapError is applied). Note that, in case
   *           of error, both `prevState` and `newState` will be the current store state when the
   *           error was thrown.
   *
   * - dispatchCount = The sequential number of the dispatch.
   *
   * <br>
   *
   * The state-observer is a good place to add an interface to the Redux DevTools.
   * It's also a good place to add METRICS to your application. For example:
   *
   * ```
   * (action, prevState, newState, error, dispatchCount) => trackMetrics(action, newState, error);
   * ```
   *
   * An interesting idea is to add a method to the Action base class called `setMetrics`, that
   * allows actions to return tailored custom metrics about the action, and then use it in the
   * state-observer to track those metrics. For example:
   *
   * ```
   * export abstract class Action extends ReduxAction<State> {
   *    let metrics: any;
   *    setMetrics(): any { return null; }
   * }
   *
   * export class AddTodoAction extends Action {
   *   reduce() { ... }
   *   setMetrics() { return <someMetrics>; }
   * }
   * ...
   *
   * stateObserver: (action, prevState, newState, error, dispatchCount) => {
   *   let metrics = (action instanceof Action) ? action.metrics: null;
   *   trackMetrics(action, metrics, newState, error);
   * }
   * ```
   */
  stateObserver?: (action: ReduxAction<St>, prevState: St, newState: St, error: any, dispatchCount: number) => void;

  /**
   * An `errorObserver` can be set during the `Store` creation.
   * This will be given all errors that survive the action's `wrapError` and the `globalWrapError`,
   * including those of type `UserException`.
   *
   * You also get the `action` and a reference to the `store`. IMPORTANT: Don't use the store to
   * dispatch any actions, as this may have unpredictable results.
   *
   * The `errorObserver` is the ideal place to log errors, as you have all the information you may
   * need, including the `action` that dispatched the error, which you can use to log the action
   * name, as well as any action properties you may find interesting.
   *
   * After you log the error, you may then return `true` to let the error throw,
   * or `false` to swallow it.
   *
   * After logging the error you may To disable the error, return `null`. For example, if you want to disable all errors
   * of type `MyException`, but log them:
   *
   * ```
   * errorObserver: (error, action) {
   *
   *    // In development, we throw the error so that we can see it in the emulator/console.
   *    if (inDevelopment() || inTests() || (error instanceof UserException)) return true;
   *
   *    // In production, we log the error, and swallow it.
   *    else {
   *       Logger.error(`Got ${error} in action ${action}.`);
   *       return false;
   *       }
   * }
   * ```
   */
  errorObserver?: (error: any, action: ReduxAction<St>, store: Store<St>) => boolean;
}

/**
 * The store holds the state of the application and allows the state to be updated
 * by dispatching actions. The store is also responsible for showing user exceptions
 * to the user, persisting the state to the local device disk, processing wait states
 * to show spinners while async operations are in progress, and more.
 */
export class Store<St> {

  /**
   * The default is `(obj: any) => console.log(obj);`
   * An alternative is: `(obj: any) => process.stdout.write(obj + '\n');`
   */
  public static log: (obj: any) => void;

  private _state: St;

  /**
   * A queue of errors of type UserException, thrown by actions.
   * They are shown to the user using the function `showUserException`.
   * This is public if you need it for advanced stuff, but you should probably not touch it.
   */
  public readonly userExceptionsQueue: UserException[];

  /// The async actions that are currently being processed.
  /// Use `isWaiting` to know if an action is currently being processed.
  private readonly _actionsInProgress: Set<ReduxAction<St>>;

  /// Async actions that we may put into `_asyncActionsInProgress`.
  /// This helps to know when to rebuild to make `isWaiting` work.
  private readonly _awaitableActions: Set<new (...args: any[]) => ReduxAction<St>>;

  /// The async actions that have failed recently.
  /// When an action fails by throwing an UserException, it's added to this map (indexed by its
  /// action type), and removed when it's dispatched.
  /// Use `isFailed`, `exceptionFor` and `clearExceptionFor` to know if you should display
  /// some error message due to an action failure.
  ///
  /// Note: Throwing an UserException can show a modal dialog to the user, and also show the error
  /// as a message in the UI. If you don't want to show the dialog you can use the `noDialog`
  /// getter in the error message: `throw UserException('Invalid input').noDialog`.
  ///
  private readonly _failedActions: Map<new (...args: any[]) => ReduxAction<St>, ReduxAction<St>>;

  /// Async actions that we may put into `_failedActions`.
  /// This helps to know when to rebuild to make `isWaiting` work.
  private readonly _actionsWeCanCheckFailed: Set<new (...args: any[]) => ReduxAction<St>>;

  // Helps implement the waitCondition method.
  private _waitConditions: Array<{
    check: (state: St) => boolean,
    resolve: (state: St) => void
  }> = [];

  // Helps implement the `waitActionCondition` method.
  private _waitActionConditions: Array<{
    check: (actions: Set<ReduxAction<St>>, triggerAction: ReduxAction<St> | null) => boolean,
    resolve: (actions: Set<ReduxAction<St>>, triggerAction: ReduxAction<St> | null) => void
  }> = [];

  private readonly _processPersistence: ProcessPersistence<St> | null;
  private _dispatchCount = 0;

  private _updateCount = 0;
  private _forceUiUpdateFunction: Dispatch<SetStateAction<number>> | null;

  private _forceUiUpdate() {
    this._forceUiUpdateFunction?.(++this._updateCount);
  }

  // A function that shows `UserExceptions` to the user, using some UI like a dialog or a toast.
  // This function is passed to the constructor. If not passed, the `UserException` is ignored.
  private readonly _showUserException: ShowUserException;

  private readonly _globalWrapError?: (error: any, action: ReduxAction<St>) => any;
  private readonly _actionObserver?: (action: ReduxAction<St>, dispatchCount: number, ini: boolean) => void;
  private readonly _stateObserver?: (action: ReduxAction<St>, prevState: St, newState: St, error: any, dispatchCount: number) => void;
  private readonly _errorObserver?: (error: any, action: ReduxAction<St>, store: Store<St>) => boolean;

  /**
   * You can use `store.mocks` to mock actions. You should use this for testing purposes, only.
   *
   * By adding mock actions to the store, they will be used instead of the original mocked actions,
   * when dispatching. You can mock an action to return a specific state or to throw an error.
   * You can also ignore an action by adding a mock action with null.
   *
   * Usage
   *
   * - `store.mocks.add(actionType, (action: actionType) => mockAction)`:
   *    Adds a mock action to the store. Whenever an action of type `actionType` is
   *    dispatched, `mockAction` will be dispatched instead. If you pass `mockAction` as null,
   *    actions of type `actionType` will be ignored when dispatched.
   *
   * - `remove(actionType)`:
   *    Removes remove a mock action from the store. Note you should pass the
   *    type of the action that was mocked, and NOT the type of the mock.
   *
   * - `clear()`:
   *    Removes all mock actions from the store.
   *
   *  Examples:
   *
   * ```ts
   * // When an IncrementAction is dispatched, AddAction(1) will be dispatched instead.
   * store.mocks.add(IncrementAction, (action) => new AddAction(1));
   *
   * // When an IncrementAction is dispatched, it will be ignored.
   * store.mocks.add(IncrementAction, null);
   *
   * // Removes the mock for Increment.
   * store.mocks.remove(Increment);
   *
   * // Removes all mocks.
   * store.mocks.clear();
   *
   * // When an AddAction is dispatched, the value will be subtracted instead.
   * store.mocks.add(AddAction, (action) => new AddAction(-action.value));
   * ```ts
   */
  public mocks: Mocks<St> = new Mocks<St>();

  public readonly record = {
    isRecording: false,
    changes: [] as Array<{
      action: ReduxAction<St>,
      ini: boolean,
      prevState: St,
      newState: St,
      error: any,
      dispatchCount: number
    }>,
    start: () => {
      this.record.isRecording = true;
      this.record.changes = [];
    },
    stop: () => {
      this.record.isRecording = false;
    },
    result: () => {
      return this.record.changes;
    },
    toString: () => {
      let count = 0;
      return '[\n' + this.record.changes.map(change =>
        `${count++}. ` +
        `${change.action.constructor.name} ${change.ini ? 'ini-' + change.dispatchCount : 'end'}: ` +
        ((change.ini) ? change.prevState : `${change.prevState} → ${change.newState}`) +
        `${change.error ? `, error: ${change.error}` : ''}`
      ).join('\n') + '\n]';
    }
  };

  // The default logger prints messages to the console.
  // An alternative is: `const logger = (obj: any) => process.stdout.write(obj + '\n');`
  private _defaultLogger(obj: any) {
    console.log(obj);
  };

  // The default Ui just logs all user-exceptions and removes them from the queue.
  private _defaultShowUserException(exception: UserException, _count: number, next: () => void) {
    Store.log(`User got an exception: ${exception}`);
    next();
  };

  constructor({
                initialState,
                showUserException,
                persistor,
                globalWrapError,
                actionObserver,
                stateObserver,
                errorObserver,
                logger
              }: ConstructorParams<St>
  ) {
    this._state = initialState;
    this._showUserException = showUserException || this._defaultShowUserException;
    this._processPersistence = (persistor === undefined) ? null : new ProcessPersistence(persistor, initialState);
    this._globalWrapError = globalWrapError;
    this._actionObserver = actionObserver;
    this._stateObserver = stateObserver;
    this._errorObserver = errorObserver;
    this.userExceptionsQueue = [];
    this._actionsInProgress = new Set();
    this._awaitableActions = new Set();
    this._failedActions = new Map<new (...args: any[]) => ReduxAction<St>, ReduxAction<St>>();
    this._actionsWeCanCheckFailed = new Set();
    this._forceUiUpdateFunction = null;
    Store.log = logger || this._defaultLogger;

    if (this._processPersistence != null) {
      this._processPersistence.readInitialState(this, initialState).then();
    }
  }

  get state(): St {
    return this._state;
  }

  get dispatchCount() {
    return this._dispatchCount;
  }

  /**
   * Dispatches the action to the Redux store, to potentially change the state.
   */
  dispatch(action: ReduxAction<St>) {
    let mockedActionOrAction = this._mockActionOrNot(action);

    // 1) If mocked as `null`, the action is ignored.
    if (mockedActionOrAction === null) return; // If mocked as null, the action is ignored.

    // 2) If the action wants to abort the dispatch, aborts, swallowing potential errors.
    // Note: It's up to the developer to make sure `abortDispatch` doesn't throw any errors.
    try {
      if (mockedActionOrAction.abortDispatch()) return;
      if (mockedActionOrAction.nonReentrant && this.isWaiting(mockedActionOrAction.constructor as new (...args: any[]) => ReduxAction<St>)) return;
    } catch (error) {
      Store.log(`Method '${action}.abortDispatch()' has thrown an error: ${error}.`);
      return;
    }

    // 3) If the action is mocked to return another action, we dispatch the mock.
    this._processDispatch(mockedActionOrAction, false);
  }

  /**
   * Dispatches an action and returns a promise that resolves when the action finishes.
   * While the state change from the action's reducer will have been applied when the promise
   * resolves, other independent processes that the action may have started may still be in
   * progress.
   *
   * Usage: `await store.dispatchAndWait(new MyAction())`.
   *
   * See also:
   * - `waitNoActionsInProgress`
   */
  dispatchAndWait(action: ReduxAction<St>): Promise<ActionStatus> {

    let mockedActionOrAction = this._mockActionOrNot(action);

    // 1) If mocked as `null`, the action is ignored.
    if (mockedActionOrAction === null) return Promise.resolve(new ActionStatus());

    // 2) If the action wants to abort the dispatch, aborts, swallowing potential errors.
    // Note: It's up to the developer to make sure `abortDispatch` doesn't throw any errors.
    try {
      if (mockedActionOrAction.abortDispatch()) return Promise.resolve(new ActionStatus());
    } catch (error) {
      Store.log(`Method '${action}.abortDispatch()' has thrown an error: ${error}.`);
      return Promise.resolve(new ActionStatus());
    }

    // 3) If the action is mocked to return another action, we dispatch the mock.
    let promise = mockedActionOrAction._createPromise();
    this._processDispatch(mockedActionOrAction, false);
    return promise;
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
  dispatchSync(action: ReduxAction<St>) {
    let mockedActionOrAction = this._mockActionOrNot(action);

    // 1) If mocked as `null`, the action is ignored.
    if (mockedActionOrAction === null) return; // If mocked as null, the action is ignored.

    // 2) If the action wants to abort the dispatch, aborts, swallowing potential errors.
    // Note: It's up to the developer to make sure `abortDispatch` doesn't throw any errors.
    try {
      if (mockedActionOrAction.abortDispatch()) return;
    } catch (error) {
      Store.log(`Method '${action}.abortDispatch()' has thrown an error: ${error}.`);
      return;
    }
    // 3) If the action is mocked to return another action, we dispatch the mock.
    this._processDispatch(mockedActionOrAction, true);
  }

  // Mocks an action to return another action.
  // If it returns null, the action should be ignored by the caller.
  // If no mock is defined, the original action is returned unchanged.
  private _mockActionOrNot(action: ReduxAction<St>): ReduxAction<St> | null {

    const mockActionFunction = this.mocks.get(action.constructor as new () => ReduxAction<St>);

    // If no mock is defined, the original action is returned unchanged.
    if (mockActionFunction === undefined) {
      return action;
    }
    // If a mock is defined, we use it.
    else {
      const mockAction = mockActionFunction(action);

      // If the mock returns null, the action is ignored.
      if (mockAction === null) {
        Store.log(`Dispatch of ${action} aborted by mock.`);
        return null;
      }
      // Otherwise, the mock is used.
      else {
        Store.log(`Dispatch of ${action} mocked by ${mockAction}.`);
        return mockAction;
      }
    }
  }

  // Dispatches the action (or the already mocked action).
  // If `mustBeSync` is true, will throw a `StoreException` if the action is ASYNC.
  private _processDispatch(action: ReduxAction<St>, mustBeSync: boolean) {

    this._dispatchCount++;
    Store.log(`${this._dispatchCount})${action}`);

    if (this._forceUiUpdateFunction === null) Store.log('Component tree not wrapped with <StoreProvider store={store}>');

    if (action.status.isDispatched)
      throw new StoreException('The action was already dispatched. Please, create a new action each time.');

    action._changeStatus({isDispatched: true});

    // We inject the store so that the action can access it (and state, dispatch etc)
    // as an object property.
    action._injectStore(this);

    Store.log('Dispatched: ' + action);

    // The action is dispatched twice. This is the 1st: when the action starts (ini true).
    this._actionObserver?.(action, this._dispatchCount, true);

    // If `record.isRecording`, record the INI state. That's for testing only.
    this._record(action, true, this._state, this._state, null);

    this._calculateIsWaitingIsFailed(action);

    this._wraps(
      action,
      () => this._runFromStart(action, mustBeSync)
    );
  }

  _calculateIsWaitingIsFailed(action: ReduxAction<St>) {

    // If the action is failable (that is to say, we have once called `isFailed` for this action),
    let failable = this._actionsWeCanCheckFailed.has(action.constructor as new (...args: any[]) => ReduxAction<St>);

    let theUIHasAlreadyUpdated = false;

    if (failable) {
      // Dispatch is starting, so we remove the action from the list of failed actions.
      let wasInTheList = this._failedActions.delete(action.constructor as new (...args: any[]) => ReduxAction<St>);

      // Then we notify the UI. Note we don't notify if the action was never checked.
      if (wasInTheList) {
        theUIHasAlreadyUpdated = true;
        this._forceUiUpdate();
      }
    }

    // Add the action to the list of actions in progress.
    this._actionsInProgress.add(action);

    // Note: If the UI hasn't updated yet, AND
    // the action is awaitable (that is to say, we have already called `isWaiting` for this action),
    if (!theUIHasAlreadyUpdated && this._awaitableActions.has(action.constructor as new (...args: any[]) => ReduxAction<St>)) {
      // Then we notify the UI. Note we don't notify if the action was never checked.
      this._forceUiUpdate();
    }
  }


  // Wraps SYNC actions.
  // - Runs the before are reduce methods.
  // - Runs the state observer.
  // - Catches and processes errors.
  // - Shows some UI if there are user exceptions.
  // - Makes sure the after method runs, always.
  // - Removes the wait state for the action in progress, always.
  // - Runs the action observer.
  private _wraps(
    action: ReduxAction<St>,
    functionToRun: () => boolean
  ) {
    let ifWentAsync = false;
    try {
      ifWentAsync = functionToRun();
    } catch (error) {
      this._processWrapsError(error, action);
    } finally {
      if (!ifWentAsync) {
        this._processWrapsFinally(action);
      }
    }
  }

  // Wraps ASYNC actions.
  // - Runs the before are reduce methods.
  // - Runs the state observer.
  // - Catches and processes errors.
  // - Shows some UI if there are user exceptions.
  // - Makes sure the after method runs, always.
  // - Removes the wait state for the action in progress, always.
  // - Runs the action observer.
  private async _wrapsAsync(
    action: ReduxAction<St>,
    functionToRun: () => Promise<void>
  ) {
    try {
      await functionToRun();
    } catch (error) {
      this._processWrapsError(error, action);
    } finally {
      this._processWrapsFinally(action);
    }
  }

  private _processWrapsError(error: any, action: ReduxAction<St>) {
    //
    action._changeStatus({originalError: error});

    // Observe the state with an error here. We use the current state; no new state was applied.
    // This is before the action's `after()` and `wrapError()` and `globalWrapError`.
    this._stateObserver?.(action, this._state, this._state, error, this._dispatchCount);

    this._record(action, false, this._state, this._state, error);

    // Any error may optionally be processed by the `wrapError` method of the action.
    // Usually this is used to wrap the error inside another that better describes the failed
    // action. It's recommended RETURNING the new error, but if `wrapError` throws an error,
    // that will be used too.
    try {
      error = action.wrapError(error);
    } catch (thrownError) {
      error = thrownError;
    }

    if (error !== null) {

      // The default wrap error does nothing (returns all errors unaltered).

      // Any error may optionally be processed by the `globalWrapError` passed to the Store
      // constructor. This is useful to wrap all errors in a common way. It's recommended
      // RETURNING the new error, but if `globalWrapError` throws an error, that will be used too.
      if (this._globalWrapError != null) {
        try {
          error = this._globalWrapError(error, action);
        } catch (thrownError) {
          error = thrownError;
        }
      }

      // To completely disable the error, `wrapError` or `globalWrapError` may return `null`.
      // But if we got an error, we deal with it here.
      if (error !== null) {

        action._changeStatus({wrappedError: error});

        // Memorizes the action that failed. We'll remove it when it's dispatched again.
        this._failedActions.set(action.constructor as new (...args: any[]) => ReduxAction<St>, action);

        // Memorizes errors of type `UserException` (in the error queue).
        // These errors are usually shown to the user in a modal dialog, and are not logged.
        if (error instanceof UserException) {
          if (error.ifOpenDialog) {
            this._addUserException(error);
            this._openSomeUiToShowUserException();
          }
        }

        // If an error-observer WAS NOT defined in the Store constructor, swallows errors
        // of type `UserExceptions` (which were already shown to the user in some UI)
        // and rethrows all others. This means the `dispatch()` method will throw this error.
        if (!this._errorObserver) {
          if (!(error instanceof UserException)) {
            throw error;
          }
        }
        // However, if as error-observer WAS defined in the Store constructor,
        else {
          // We call the error-observer.
          // - If it returns `true`, the `dispatch()` method will throw this error.
          // - If it returns `false`, the error is swallowed.
          // Note: When the error-observer is defined, we don't make a distinction between
          // `UserExceptions` and other errors, anymore. We let the error-observer do a
          // distinction if it wants by returning true or false depending on the error type.
          let shouldThrow = this._errorObserver(error, action, this);
          if (shouldThrow) throw error;
        }
      }
    }
  }

  private _processWrapsFinally(action: ReduxAction<St>) {
    // We run the `after` method of the action.
    try {
      action.after();
    } catch (error) {
      Store.log('The `after()` method of the action ' + action + ' threw an error: ' + error
        + '. This error will be ignored, but you should fix this, as `after()` methods should ' +
        'not throw errors.');
    } finally {
      action._changeStatus({hasFinishedMethodAfter: true});
    }

    // Remove the wait state for the action in progress.
    // Note: If the state was applied, this was already removed and the UI updated.
    const removed = this._actionsInProgress.delete(action);
    if (removed) {
      this._forceUiUpdate();

      // Check the wait-conditions after state change. We pass it the trigger-action.
      this._checkAllActionConditions(action);
    }

    // The action is dispatched twice. This is the 2nd: when the action ends (ini false).
    this._actionObserver?.(action, this._dispatchCount, false);

    // This allows us to `let status = await dispatchAndWait(new MyAction())`.
    action._resolvePromise();
  }


  // This method checks and resolves conditions related to actions in progress.
  // It iterates over the `_waitActionConditions` array and checks each condition.
  // If a condition is met, it resolves the condition and later removes it.
  // The `triggerAction` is the action that was just added or removed in the list
  // of `_actionsInProgress` that triggered the check.
  private _checkAllActionConditions(triggerAction: ReduxAction<St>) {

    let toRemove: any[] = [];

    // Iterate over the conditions, resolve the ones that check, and add the ones to be removed to the separate array.
    for (let condition of this._waitActionConditions) {
      if (condition.check(this.actionsInProgress(), triggerAction)) {
        condition.resolve(this.actionsInProgress(), triggerAction);
        toRemove.push(condition);
      }
    }

    // Remove the checked conditions from the original array.
    if (toRemove.length !== 0)
      this._waitActionConditions = this._waitActionConditions.filter(condition => !toRemove.includes(condition));
  }


  private _runFromStart(action: ReduxAction<St>, mustBeSync: boolean): boolean {

    // BEFORE

    // 1) Runs the `before` method.
    // It may be sync or async, but it doesn't return anything.
    let beforeResult: void | Promise<void> = action.before();

    // 2) If it's async, wait for the `before` method to finish.
    if (beforeResult instanceof Promise) {
      if (mustBeSync) throw new StoreException(`You called dispatchSync(${action.constructor.name}), but the action's 'before' method returned a Promise.`);
      this._runAsyncBeforeOnwards(action, beforeResult).then();
      return true; // Get out of here. Went ASYNC.
    }

    action._changeStatus({hasFinishedMethodBefore: true});

    // REDUCE

    if (action.ifRetryIsOn) action.wrapReduce = this._retryWrapReduce(action);

    // 3)
    // - Runs the SYNC `reduce` method; OR
    // - Runs the initial sync part of the ASYNC `reduce` method.
    let reduceResult: ReduxReducer<St> =
      action.wrapReduce(action.reduce.bind(action))();

    // 4) If the reducer returned null, or if it returned the unaltered state, we simply do nothing.
    if (reduceResult === null || reduceResult === this.state) {
      action._changeStatus({hasFinishedMethodReduce: true});
      this._record(action, false, this.state, this.state, null);
      return false; // Kept SYNC.
    }
      //
    // 5) If the reducer is ASYNC, we still process the rest of the reducer to generate the new state.
    else if (reduceResult instanceof Promise) {
      if (mustBeSync) throw new StoreException(`You called dispatchSync(${action.constructor.name}), but the action's 'reduce' method returned a Promise.`);
      this._runAsyncReduceOnwards(action, reduceResult);
      return true; // Get out of here. Went ASYNC.
    }
      //
    // 6) If the reducer is SYNC, we already have the new state, and we simply must apply it.
    else {
      action._changeStatus({hasFinishedMethodReduce: true});

      if (action.abortReduce(reduceResult)) {
        action._changeStatus({hasFinishedMethodReduce: true});
        this._record(action, false, this.state, this.state, null);
        return false; // Kept SYNC.
      }

      this._registerState(action, reduceResult);
      return false; // Kept SYNC.
    }
  }

  private _retryWrapReduce(action: ReduxAction<St>): (reduce: () => ReduxReducer<St>) => () => ReduxReducer<St> {

    let retry = (action.retry as RetryOptions);

    if (!retry.on) {
      function _wrapReduce1(reduce: () => ReduxReducer<St>): () => ReduxReducer<St> {
        return reduce;
      }

      return _wrapReduce1;
    }
    //
    else {
      /// Start with the `initialDelay`, and then increase it by `multiplier` each time this is called.
      /// If the delay exceeds `maxDelay`, it will be set to `maxDelay`.
      function nextDelay(retry: RetryOptions): number {
        let _multiplier = retry.multiplier;
        if (_multiplier <= 1) _multiplier = 2;

        retry.currentDelay = (retry.currentDelay == null) //
          ? retry.initialDelay //
          : retry.currentDelay! * _multiplier;

        if (retry.currentDelay! > retry.maxDelay) retry.currentDelay = retry.maxDelay;

        return retry.currentDelay!;
      }

      function _wrapReduce2(reduce: () => ReduxReducer<St>): () => ReduxReducer<St> {

        async function _wrapReduce3(): AsyncReducer<St> {

          let newState: any;
          try {
            newState = reduce();
            if (newState instanceof Promise)
              newState = await newState;
          }
            //
          catch (error) {
            (action.retry as RetryOptions).attempts++;
            let maxRetries = (action.retry as RetryOptions).maxRetries;
            if ((maxRetries >= 0) && (action.attempts > maxRetries)) throw error;

            let currentDelay = nextDelay(action.retry as RetryOptions);
            await new Promise(resolve => setTimeout(resolve, currentDelay));
            return action.wrapReduce(reduce)() as any;
          }

          return newState;
        }

        // Store.log(' ======= RETURNED _wrapReduce3 = () => ' + _wrapReduce3);
        return () => _wrapReduce3();
      }

      // Store.log(' ======= RETURNED _wrapReduce2 = () => ' + _wrapReduce2);
      return _wrapReduce2;
    }
  }

  private _record(
    action: ReduxAction<St>,
    ini: boolean,
    prevState: St,
    newState: St,
    error: any
  ) {
    if (this.record.isRecording) {
      this.record.changes.push({
        action,
        ini,
        prevState: prevState,
        newState: newState,
        error: error,
        dispatchCount: this._dispatchCount
      });
    }
  }

  private async _runAsyncBeforeOnwards(action: ReduxAction<St>, beforeResult: Promise<void>) {

    this._wrapsAsync(action, async () => {

      // 2.1) Method `before` is ASYNC, so we wait for it to finish.
      await beforeResult;

      action._changeStatus({hasFinishedMethodBefore: true});

      // REDUCE

      if (action.ifRetryIsOn) action.wrapReduce = this._retryWrapReduce(action);

      // 2.2)
      // - Runs the SYNC `reduce` method; OR
      // - Runs the initial sync part of the ASYNC `reduce` method.
      let reduceResult: ReduxReducer<St> | AsyncReducerResult<St> =
        action.wrapReduce(action.reduce.bind(action))();

      // 2.3) If the reducer returned null, or if it returned the unaltered state, we simply do nothing.
      if (reduceResult === null || reduceResult === this.state) {
        action._changeStatus({hasFinishedMethodReduce: true});
        this._record(action, false, this.state, this.state, null);
        return; // Get out of here.
      }
        //
      // 2.4) If the reducer is ASYNC, we still process the rest of the reducer to generate the new state.
      else if (reduceResult instanceof Promise) {
        reduceResult = await reduceResult as AsyncReducerResult<St>;
        action._changeStatus({hasFinishedMethodReduce: true});

        if (reduceResult === null || reduceResult === this.state) {
          this._record(action, false, this.state, this.state, null);
        }
        //
        else {
          if (action.ifRetryIsOn && !this._isFunction(reduceResult))
            throw new StoreException(`Since action '${action}' retries, it should have an ASYNC reducer, that returns a Promise<(St) => St>.`);

          let newAsyncState = reduceResult(this.state);
          if (newAsyncState != null) {

            if (action.abortReduce(newAsyncState)) {
              this._record(action, false, this.state, this.state, null);
            } else
              this._registerState(action, newAsyncState);
          }
        }

        return; // Get out of here.
      }
        //
      // 2.5) If the reducer is SYNC, we already have the new state, and we simply must apply it.
      else {
        action._changeStatus({hasFinishedMethodReduce: true});

        if (action.abortReduce(reduceResult)) {
          action._changeStatus({hasFinishedMethodReduce: true});
          this._record(action, false, this.state, this.state, null);
        } else
          this._registerState(action, reduceResult);

        return; // Get out of here.
      }
    }).then();
  }

  private _runAsyncReduceOnwards(action: ReduxAction<St>, reduceResult: AsyncReducer<St>) {

    this._wrapsAsync(action, async () => {

      // 5.1) Method `reduce` is ASYNC, so we wait for it to finish.
      let functionalReduceResult: AsyncReducerResult<St> = await reduceResult;
      action._changeStatus({hasFinishedMethodReduce: true});

      // 5.2) If the reducer returned null, we simply do nothing.
      if (functionalReduceResult === null) {
        this._record(action, false, this.state, this.state, null);
        return; // Get out of here.
      }
        //
        // 5.3) If the reducer returned a function `(state: St) => (St | null)`,
      // we still need to run this function to generate the new state.
      else {
        if (action.ifRetryIsOn && !this._isFunction(functionalReduceResult))
          throw new StoreException(`Since action '${action}' retries, it should have an ASYNC reducer, that returns a Promise<(St) => St>.`);

        let finalReduceState = functionalReduceResult(this.state);

        if (finalReduceState != null) {

          if (action.abortReduce(finalReduceState)) {
            this._record(action, false, this.state, this.state, null);
          } else
            this._registerState(action, finalReduceState);
        }

        return; // Get out of here.
      }
    }).then();
  }

  private _isFunction(obj: any): boolean {
    return typeof obj === 'function';
  }

  private _registerState(action: ReduxAction<St>, newState: St) {

    try {
      let stateChangeDescription = Store.describeStateChange(this.state, newState);
      if (stateChangeDescription !== '') Store.log(stateChangeDescription);
    } catch (error) {
      // Swallow error and do nothing, as this is just a debug print.
    }

    const prevState = this._state;

    if (newState !== null && newState !== this._state) {
      this._state = newState;

      // Observe the state with null error, because the reducer completed normally.
      this._stateObserver?.(action, prevState, newState, null, this._dispatchCount);

      this._record(action, false, prevState, newState, null);

      // Remove the wait state for the action in progress.
      // Note: We do this here, before updating the UI.
      const removed = this._actionsInProgress.delete(action);

      // Check the wait-conditions after state change. We pass it the trigger-action.
      if (removed) this._checkAllActionConditions(action);

      this._forceUiUpdate();

      // Check the wait-conditions after state change.
      this._waitConditions = this._waitConditions.filter(condition => {
        if (condition.check(this.state)) {
          condition.resolve(this.state);
          return false; // remove the condition from the array.
        }
        return true; // keep the condition in the array.
      });
    }

    if (this._processPersistence != null)
      this._processPersistence.process(
        action,
        newState
      );
  }

  /**
   * For this to work, we have to pass a function `showUserException` in the constructor
   * of the Store, that will open some UI to show the error to the user.
   *
   * 1) If the UI is still open, don't do anything.
   * 2) If no UI is open, check to see if any errors are in the queue.
   *    If so, remove the first error from the queue and show it in the UI.
   * 3) In this case, we mark the UI as open, and count the number of errors still in the queue.
   * 4) When the UI calls `next()`, we mark the UI as closed, and call the method again, to
   *    process the next error in the queue, if any.
   *
   * IMPORTANT: Failing to call `next()` will prevent the UI to ever opening again, because
   * AsyncRedux will think the previous UI is still open. In contrast, calling `next()` as soon
   * as the UI opens may result in opening more than one UI on top pf each other.
   * Also, calling `next()` when there are no more errors in the queue will do nothing.
   *
   * An example using React Native:
   *
   * ```ts
   * const showUserException = (exception: UserException, next: () => void) => {
   *     Alert.alert(
   *       exception.title || exception.message,
   *       exception.title ? exception.message : '',
   *       [{ text: 'OK', onPress: (value?: string) => { next(); }]
   *     );
   *   };
   * ```
   */
  private _openSomeUiToShowUserException() {

    // 1) If the UI is still open, don't do anything.
    if (this._isUserExceptionUiOpen) return;

    // 2.1) If no UI is open,
    else {
      // 2.2) Check to see if any errors are in the queue. If so, remove the first error from the queue.
      let currentError = this.userExceptionsQueue.shift();
      if (currentError !== undefined) {

        // 3.1) In this case, we mark the UI as open,
        this._isUserExceptionUiOpen = true;

        // 3.2) and count the number of errors still in the queue.
        let queued = this.userExceptionsQueue.length;

        // 2.3) And show it in the UI.
        this._showUserException?.(currentError, queued,

          // 4.1) When the UI calls `next()`.
          () => {

            // 4.2) We mark the UI as closed.
            this._isUserExceptionUiOpen = false;

            // 4.3) And call the method again, to process the next error in the queue, if any.
            this._openSomeUiToShowUserException();
          });
      }
    }
  };


  private _isUserExceptionUiOpen: boolean = false;

  private _addUserException(error: UserException) {
    this.userExceptionsQueue.push(error);
  }

  /**
   * You can use `isWaiting` and pass it an action `type`:
   * - It returns true if an ASYNC action of the specific type is currently being processed.
   * - It returns false if an ASYNC action of the specific type is NOT currently being processed.
   * - This is only useful for ASYNC actions, since it always returns `false` when the action is SYNC.
   *
   * Note an action is ASYNC if it returns a promise from its `before` OR its `reduce` methods.
   *
   * ```ts
   * dispatch(MyAction());
   * if (store.isWaiting(MyAction)) { // Show a spinner }   *
   * ```
   */
  isWaiting<T extends ReduxAction<St>>(type: { new(...args: any[]): T }): boolean {

    this._awaitableActions.add(type);

    for (const action of this._actionsInProgress) {
      if (action instanceof type) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns true if an [actionOrActionTypeOrList] failed with an [UserException].
   * Note: This method uses the EXACT type in [actionOrActionTypeOrList]. Subtypes are not considered.
   */
  isFailed<T extends ReduxAction<St>>(type: { new(...args: any[]): T }): boolean {
    return this.exceptionFor(type) !== null;
  }

  /**
   * Returns the `UserException` of the `type` that failed.
   * Note: This method uses the EXACT type in `type`. Subtypes are not considered.
   */
  exceptionFor<T extends ReduxAction<St>>(type: { new(...args: any[]): T }): (UserException | null) {
    this._actionsWeCanCheckFailed.add(type);
    let action = this._failedActions.get(type);
    let error = action?.status.wrappedError;
    return (error instanceof UserException) ? error : null;
  }

  /**
   * Removes the given `type` from the list of action types that failed.
   *
   * Note that dispatching an action already removes that action type from the exceptions list.
   * This removal happens as soon as the action is dispatched, not when it finishes.
   *
   * Note: This method uses the EXACT type. Subtypes are not considered.
   */
  clearExceptionFor<T extends ReduxAction<St>>(type: { new(...args: any[]): T }): void {
    let result = this._failedActions.delete(type);
    if (result) this._forceUiUpdate();
  }

  // TODO: MARCELO Change this.
  _inject(forceUpdate: Dispatch<SetStateAction<number>>) {
    this._forceUiUpdateFunction = forceUpdate;
  }

  static describeStateChange(obj1: any, obj2: any, path: string = ''): String {
    // Ensure both parameters are objects
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
      return '';
      // Note: This method should not fail.
      // Throw new StoreException(`Type mismatch or one of the objects is null at path: ${path}`);
    }

    let differences = '';
    // Combine keys from both objects
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    for (const key of allKeys) {
      const val1 = obj1[key];
      const val2 = obj2[key];
      const newPath = path === '' ? key : `${path}.${key}`;

      // If both values are objects, recurse
      if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
        Store.describeStateChange(val1, val2, newPath);
      } else {
        // If values are different, log the difference
        if (val1 !== val2) {
          differences += `State ${newPath}: ${val1} → ${val2}`;
        }
      }
    }
    return differences;
  }

  /**
   * Pause the Persistor temporarily.
   *
   * When pausePersistor is called, the Persistor will not start a new persistence process, until method
   * resumePersistor is called. This will not affect the current persistence process, if one is currently
   * running.
   *
   * Note: A persistence process starts when the Persistor.persistDifference method is called,
   * and finishes when the promise returned by that method completes.
   */
  pausePersistor(): void {
    this._processPersistence?.pause();
  }

  /**
   * Persists the current state (if it's not yet persisted), then pauses the Persistor temporarily.
   *
   * When persistAndPausePersistor is called, this will not affect the current persistence
   * process, if one is currently running. If no persistence process was running, it will
   * immediately start a new persistence process (ignoring Persistor.throttle).
   *
   * Then, the Persistor will not start another persistence process, until method
   * resumePersistor is called.
   *
   * Note: A persistence process starts when the Persistor.persistDifference method is called,
   * and finishes when the promise returned by that method completes.
   */
  persistAndPausePersistor(): void {
    this._processPersistence?.persistAndPause();
  }

  /**
   * Resumes persistence by the Persistor,
   * after calling pausePersistor or persistAndPausePersistor.
   */
  resumePersistor(): void {
    this._processPersistence?.resume();
  }

  /**
   * Asks the Persistor to save the initialState in the local persistence.
   */
  async saveInitialStateInPersistence(initialState: St): Promise<void> {
    return this._processPersistence?.saveInitialState(initialState);
  }

  /**
   * Asks the Persistor to read the state from the local persistence.
   * Important: If you use this, you MUST put this state into the store.
   * The Persistor will assume that's the case, and will not work properly otherwise.
   */
  async readStateFromPersistence(): Promise<St | null> {
    return this._processPersistence?.readState() || null;
  }

  /**
   * Asks the Persistor to delete the saved state from the local persistence.
   */
  async deleteStateFromPersistence(): Promise<void> {
    return this._processPersistence?.deleteState();
  }

  /**
   * Gets, from the Persistor, the last state that was saved to the local persistence.
   */
  getLastPersistedStateFromPersistor(): St | null {
    return this._processPersistence?.lastPersistedState || null;
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
  async waitCondition(
    condition: (state: St) => boolean,
    timeoutMillis: number | null = null
  ): Promise<St> {

    // If the condition is already met, return the state immediately.
    if (condition(this._state)) return this._state;
    // Otherwise, create a Promise that resolves when the condition is met.
    else {
      return new Promise((resolve, reject) => {
        this._waitConditions.push({check: condition, resolve});

        timeoutMillis ??= TimeoutException.defaultTimeoutMillis;
        if (timeoutMillis > 0) {
          setTimeout(() => {
            reject(new TimeoutException(`Timeout exceeded: ${timeoutMillis} milliseconds.`));
          }, timeoutMillis);
        }
      });
    }
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
      // Error message in case the condition was already true when the method was called,
      // and `completeImmediately` is false.
      completedErrorMessage = "Awaited action condition was already true",
      //
      // The maximum time to wait for the condition to be met. The default is 10 minutes.
      // To disable the timeout, make it 0 or -1.
      timeoutMillis = null,
    }: {
      completeImmediately?: boolean,
      completedErrorMessage?: string,
      timeoutMillis?: number | null
    } = {})
    : Promise<{ actions: Set<ReduxAction<St>>, triggerAction: ReduxAction<St> | null }> {

    // If the condition is already true when `waitActionCondition` is called,
    if (condition(this.actionsInProgress(), null)) {
      // Complete and return the actions in progress and the trigger action.
      if (completeImmediately)
        return Promise.resolve({actions: this.actionsInProgress(), triggerAction: null});
      // else throw an error.
      else
        throw new StoreException(completedErrorMessage + ", and the promise completed immediately.");
    }
    //
    else {
      return new Promise((resolve, reject) => {
        this._waitActionConditions.push(
          {
            check: (actions: Set<ReduxAction<St>>, triggerAction: ReduxAction<St> | null) => condition(actions, triggerAction),
            resolve: (actions: Set<ReduxAction<St>>, triggerAction: ReduxAction<St> | null) =>
              resolve({actions, triggerAction: triggerAction}
              )
          });

        timeoutMillis ??= TimeoutException.defaultTimeoutMillis;
        if (timeoutMillis > 0) {
          setTimeout(() => {
            reject(new TimeoutException(`Timeout exceeded: ${timeoutMillis} milliseconds.`));
          }, timeoutMillis);
        }
      });
    }
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
  async waitAllActions(
    actions: ReduxAction<St>[] | null,
    {
      completeImmediately = false,
      timeoutMillis = null
    }: {
      completeImmediately?: boolean,
      timeoutMillis?: number | null
    } = {}) {
    if (!actions || (actions.length === 0)) {
      return this.waitActionCondition(
        (actions) => actions.size === 0,
        {
          completeImmediately: completeImmediately,
          completedErrorMessage: "No actions were in progress",
          timeoutMillis: timeoutMillis,
        },
      )
    } else {
      return this.waitActionCondition((actionsInProgress) => {
          for (const action of actions) {
            if (actionsInProgress.has(action)) {
              return false;
            }
          }
          return true;
        }, {
          completeImmediately: completeImmediately,
          completedErrorMessage: "None of the given actions were in progress",
          timeoutMillis: timeoutMillis,
        },
      );
    }
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
    actionType: {
      new(...args: any[]): ReduxAction<St>
    },
    completeImmediately: boolean = false,
    timeoutMillis: number | null = null
  ) {
    let {actions, triggerAction} = await this.waitActionCondition(
      (actionsInProgress, triggerAction) => {
        return !(Array.from(actionsInProgress).some((action) => action.constructor === actionType));
      },
      {
        completeImmediately: completeImmediately,
        completedErrorMessage: "No action of the given type was in progress",
        timeoutMillis: timeoutMillis,
      }
    );

    return triggerAction;
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
    actionTypes: { new(...args: any[]): ReduxAction<St> }[],
    {
      completeImmediately = false,
      timeoutMillis = null
    }: {
      completeImmediately?: boolean,
      timeoutMillis?: number | null
    } = {}) {
    if (actionTypes.length === 0) {
      await this.waitActionCondition(
        (actions, triggerAction) => actions.size === 0,
        {
          completeImmediately: completeImmediately,
          completedErrorMessage: "No actions are in progress",
          timeoutMillis: timeoutMillis,
        }
      );
    } else {
      await this.waitActionCondition(
        (actionsInProgress, triggerAction) => {
          for (const actionType of actionTypes) {
            if (Array.from(actionsInProgress).some(action => action.constructor === actionType)) return false;
          }
          return true;
        },
        {
          completeImmediately: completeImmediately,
          completedErrorMessage: "No action of the given types was in progress",
          timeoutMillis: timeoutMillis,
        }
      );
    }
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
    {timeoutMillis = null}: { timeoutMillis?: number | null }
  ): Promise<ReduxAction<St>> {

    const {triggerAction} = await this.waitActionCondition(
      //
      (actionsInProgress, triggerAction) => {

        // If the triggerAction is one of the actionTypes,
        if ((triggerAction !== null) && actionTypes.includes(triggerAction.constructor as any)) {
          // If the actions in progress do not contain the triggerAction, then the triggerAction has finished.
          // Otherwise, the triggerAction has just been dispatched, which is not what we want.
          const isFinished = !Array.from(actionsInProgress).includes(triggerAction);
          return isFinished;
        }
        return false;
      },
      {
        completedErrorMessage: "Assertion error",
        timeoutMillis: timeoutMillis,
      }
    );

    // Always non-null, because the condition is only met when an action finishes.
    return triggerAction!;
  }

  /**
   * Returns an unmodifiable set of the actions on progress.
   * For debug purposes, the `toString` method of the returned set will call `ReduxAction.toString()` for all actions.
   */
  actionsInProgress(): Set<ReduxAction<St>> {
    return new UnmodifiableSetView(this._actionsInProgress)
  }

  /**
   * Waits until the store state meets a certain condition, and then dispatches an action.
   */
  dispatchWhen(action: ReduxAction<St>, condition: (state: St) => boolean): void {
    this.waitCondition(condition).then(() => this.dispatch(action));
  }
}

interface StoreProviderProps<St> {
  store: Store<St>;
  children: React.ReactNode;
}

interface StoreContextType<St> {
  store: Store<St> | null;
}

const StoreContext = createContext<StoreContextType<any>>({
  store: null
});

export function useStore<St>(): Store<St> {
  const context = useContext<StoreContextType<St>>(StoreContext) as StoreContextType<St>;
  if (context === undefined) {
    throw new StoreException('useStore must be used within a StoreProvider');
  }
  return context.store as Store<St>;
}

export function StoreProvider<St>({store, children}: StoreProviderProps<St>): JSX.Element {
  const [_store] = useState<Store<St>>(store);
  const [_, forceUpdate] = useState(store.dispatchCount);

  _store?._inject(forceUpdate);

  return (
    <StoreContext.Provider value={{store: _store}}>
      {children}
    </StoreContext.Provider>
  );
}

class Mocks<St> {
  private mocks: Map<new (...args: any[]) => ReduxAction<St>, (action: any) => ReduxAction<St> | null> = new Map();

  add<T extends ReduxAction<St>>(
    actionType: new (...args: any[]) => T,
    mockAction: (action: T) => ReduxAction<St> | null): void {
    this.mocks.set(actionType, mockAction);
  }

  remove(actionType: new () => ReduxAction<St>): void {
    this.mocks.delete(actionType);
  }

  clear(): void {
    this.mocks.clear();
  }

  get(actionType: new () => ReduxAction<St>): ((action: ReduxAction<St>) => ReduxAction<St> | null) | undefined {
    return this.mocks.get(actionType);
  }
}

