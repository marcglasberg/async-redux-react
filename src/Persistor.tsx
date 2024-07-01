import { ReduxAction } from './ReduxAction';
import { Store } from './Store';

/**
 * Use it like this:
 *
 * ```ts
 * const persistor = new MyPersistor();
 *
 * let initialState = await persistor.readState();
 *
 * if (initialState === null) {
 *   initialState = AppState.initialState();
 *   await persistor.saveInitialState(initialState);
 * }
 *
 * const store = createStore<AppState>({
 *   initialState: initialState,
 *   persistor: persistor,
 * });
 * ```
 *
 * IMPORTANT: When the store is created with a Persistor, it assumes
 * the provided initial state was already persisted. Ensure this is the case.
 */
export abstract class Persistor<St> {

  /**
   * Function `readState` should read/load the saved state from the persistence.
   * It will be called only once per run, when the app starts, during the store creation.
   *
   * - If the state is not yet saved (first app run), `readState` should return `null`.
   *
   * - If the saved state is valid, `readState` should return the saved state.
   *
   * - If the saved state is corrupted but can be fixed, `readState` should save the fixed
   *   state and then return it.
   *
   * - If the saved state is corrupted and cannot be fixed, or some other serious error occurs
   *   while reading the state, `readState` should thrown an error, with an appropriate error
   *   message.
   *
   * Note: If an error is thrown by `readState`, Async Redux will log it with `Store.log()`.
   *
   */
  abstract readState(): Promise<St | null>;

  /**
   * Function `deleteState` should delete/remove the saved state from the persistence.
   */
  abstract deleteState(): Promise<void>;

  /**
   * Function `persistDifference` should save the new state to the persistence,
   * and return a `Promise` that completes only after it is persisted.
   *
   * This new state is provided to the function as a parameter called `newState`.
   * For simpler apps where your state is small, you can simply persist the whole `newState`
   * every time.
   *
   * But for larger apps, you may compare it with the last persisted state, and persist only
   * the difference between them. The last persisted state is provided to the function as a
   * parameter called `lastPersistedState`. It may be `null` if there is no persisted state
   * yet (first app run).
   *
   * @param lastPersistedState The last state that was persisted. It may be null.
   * @param newState The new state to be persisted.
   */
  abstract persistDifference(
    lastPersistedState: St | null,
    newState: St
  ): Promise<void>;

  /**
   * Function `saveInitialState` should save the given `state` to the persistence,
   * replacing any previous state that was saved.
   */
  abstract saveInitialState(state: St): Promise<void>;

  /**
   * The default throttle is 2 seconds (2000 milliseconds).
   * Return `null` to turn off the throttle.
   */
  get throttle(): number | null {
    return 2000; // Default throttle is 2 seconds.
  }
}

/**
 * A decorator to print persistor information to the console.
 * Use it like this:
 *
 * ```ts
 * const store = createStore<AppState>({
 *   ...otherOptions,
 *   persistor: new PersistorPrinterDecorator<AppState>(persistor),
 * });
 * ```
 */
export class PersistorPrinterDecorator<St> implements Persistor<St> {
  private _persistor: Persistor<St>;

  constructor(persistor: Persistor<St>) {
    this._persistor = persistor;
  }

  async readState(): Promise<St | null> {
    Store.log('Persistor: read state.');
    return this._persistor.readState();
  }

  async deleteState(): Promise<void> {
    Store.log('Persistor: delete state.');
    return this._persistor.deleteState();
  }

  async persistDifference(
    lastPersistedState: St | null,
    newState: St
  ): Promise<void> {
    Store.log(`Persistor: persist difference:
      lastPersistedState = ${lastPersistedState}
      newState = ${newState}`);
    return this._persistor.persistDifference(lastPersistedState, newState);
  }

  async saveInitialState(state: St): Promise<void> {
    Store.log('Persistor: save initial state.');
    return this._persistor.saveInitialState(state);
  }

  get throttle(): number | null {
    return this._persistor.throttle;
  }
}

/**
 * A dummy persistor.
 */
export class PersistorDummy<St> implements Persistor<St | null> {
  async readState(): Promise<St | null> {
    return null;
  }

  async deleteState(): Promise<void> {
    return;
  }

  async persistDifference(_lastPersistedState: St | null, _newState: St): Promise<void> {
    return;
  }

  async saveInitialState(_state: St | null): Promise<void> {
    return;
  }

  get throttle(): number | null {
    return null;
  }
}

export class PersistException extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'PersistException';

    // Maintains proper stack trace for where our error was thrown (only available on V8).
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PersistException);
    }
  }
}

export class PersistAction<St> extends ReduxAction<St> {
  reduce(): null {
    return null;
  }
}

