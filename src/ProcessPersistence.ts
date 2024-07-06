import { PersistAction, Persistor } from "./Persistor";
import { ReduxAction, UpdateStateAction } from "./ReduxAction";
import { Store } from "./Store";

export class ProcessPersistence<St> {
  persistor: Persistor<St>;
  lastPersistedState: St | null;
  newestState: St | null;
  isPersisting = false;
  isANewStateAvailable = false;
  lastPersistTime: Date = new Date();
  timer?: ReturnType<typeof setTimeout>; // Timer's type
  isPaused = false;
  isInit = false;
  finishedPersistingCallback: (() => void) | null = null;

  constructor(persistor: Persistor<St>, lastPersistedState: St | null) {
    this.persistor = persistor;
    this.lastPersistedState = lastPersistedState;
    this.newestState = null;
  }

  async readInitialState(store: Store<St>, initialState: St) {

    let stateReadFromPersistor: St | null = null;

    try {
      stateReadFromPersistor = await this.persistor.readState();
    } catch (error) {
      this.log('Error reading state:' + error + '. State will reset.');

      try {
        await this.persistor.deleteState();
      } catch (error) {
        this.log('Error deleting the state:' + error + '.');
      }
    }

    if (stateReadFromPersistor === null) {
      try {
        // If it was not possible to read the persisted state,
        // we persist the initial-state passed to the Store constructor.
        await this.persistor.saveInitialState(initialState);
      } catch (error) {
        this.log('Error saving initial state:' + error + '.');
      }
    }
    //
    else {
      // If the saved state was read successfully, we replace the store state with it.
      // In this case, the initial-state passed in the Store constructor was used
      // only while the persisted state is loading.
      await store.dispatchAndWait(
        new UpdateStateAction<St>(
          (_) => stateReadFromPersistor,
          false, // Do not persist the state we just read from the persistence.
        )
      );
    }
  }

  private log(message: string) {
    try {
      Store.log(message);
    } catch (error) {
      // Discard error.
    }
  }

  get throttle(): number {
    return this.persistor.throttle || 0;
  }

  async saveInitialState(initialState: St): Promise<void> {
    this.lastPersistedState = initialState;
    await this.persistor.saveInitialState(initialState);
  }

  /**
   * Same as `Persistor.readState` but will remember the read state as the `lastPersistedState`.
   */
  async readState(): Promise<St | null> {
    const state = await this.persistor.readState();
    this.lastPersistedState = state;
    return state;
  }

  /**
   * Same as `Persistor.deleteState` but will clear the `lastPersistedState`.
   */
  async deleteState(): Promise<void> {
    this.lastPersistedState = null;
    await this.persistor.deleteState();
  }

  /**
   * Call `logOut()` when you want to delete the persisted state, and return the store
   * state to the given initial-state. That's usually necessary when the user logs out
   * of your app, or the user deletes its account, so that another user may log in,
   * or start a new sign-up process.
   *
   * Note: If you know about any timers or async processes that you may have started,
   * you should stop/cancel them all before calling this method.
   *
   * You may opt to:
   *
   * - Wait for `throttle` milliseconds to make sure all async processes that the app may
   * have started have time to finish. The default `throttle` is 3000 milliseconds (3 seconds).
   *
   * - Wait for all actions currently running to finish, but wait at most `actionsThrottle`
   * milliseconds. If the actions are not finished by then, the state will be deleted anyway.
   * The default `actionsThrottle` is 6000 milliseconds (6 seconds).
   */
  async logOut({
                 store,
                 initialState,
                 throttle = 3000,
                 actionsThrottle = 6000,
               }: {
    store: Store<St>,
    initialState: St,
    throttle?: number,
    actionsThrottle?: number,
  }): Promise<void> {

    // Pauses the persistor, so it doesn't start a new persistence process.
    this.pause();

    // Cancel the persistence timer.
    this._cancelTimer();

    // Set the store to shut down, so it doesn't start any new actions.
    store.setShutDown(true);

    // If the state is NOT currently being persisted,
    if (!this.isPersisting) {

      // Clear the callback that is called when it finishes persisting.
      this.finishedPersistingCallback = null;

      // Wait for the throttle period to finish.
      await new Promise<void>(resolve => setTimeout(resolve, throttle));

      // Wait for all actions currently running to finish,
      // but wait at most `actionsThrottle` milliseconds.
      await store.waitAllActions(null, {
        timeoutMillis: actionsThrottle,
        completeImmediately: true
      })
        .catch((error) => {
        });

      // Delete the old persisted state.
      await this.deleteState();

      // Synchronously change the store state to the initial-state.
      store.dispatchSync(new UpdateStateAction((state: St) => initialState));

      // Persist the new initial-state.
      await this._persist(new Date(), initialState).then();

      // Restart the store accepting new actions.
      store.setShutDown(false);
    }
      //
    // If it's currently being persisted, we can't delete the state right now.
    else {
      // But as soon as it finishes persisting, try again.
      this.finishedPersistingCallback = async () => {
        await this.logOut({
          store, initialState, throttle, actionsThrottle
        });
      }
    }
  }

  /**
   * 1) If we're still persisting the last time, don't persist no matter what.
   * 2) If action is of type `UpdateStateAction` with `ifPersists` false,
   *    don't persist, but consider the state as persisted.
   * 3) If throttle period is done (or if action is PersistAction), persist.
   * 4) If throttle period is NOT done, create a timer to persist as soon as it finishes.
   *
   * Return true if the persist process started.
   * Return false if persistence was postponed.
   *
   */
  process(action: ReduxAction<St> | null, newState: St): boolean {
    this.isInit = true;
    this.newestState = newState;

    if (this.isPaused || this.lastPersistedState === newState) return false;

    if ((action instanceof UpdateStateAction) && (!action.ifPersists)) {
      this.lastPersistedState = this.newestState;
      return false;
    }

    // 1) If we're still persisting the last time, don't persist no matter what.
    if (this.isPersisting) {
      this.isANewStateAvailable = true;
      return false;
    }
    //
    else {

      const now = new Date();

      // 2) If throttle period is done (or if action is PersistAction), persist.
      if (
        now.valueOf() - this.lastPersistTime.valueOf() >= this.throttle
        || (action instanceof PersistAction)
      ) {
        this._cancelTimer();
        this._persist(now, newState).then();
        return true;
      }

      // 3) If throttle period is NOT done, create a timer to persist as soon as it finishes.
      else {
        if (!this.timer) {

          const asSoonAsThrottleFinishes = this.throttle - (now.valueOf() - this.lastPersistTime.valueOf());

          this.timer = setTimeout(() => {
            this.timer = undefined;
            this.process(null, this.newestState as St); // TypeScript forced cast
          }, asSoonAsThrottleFinishes);
        }
        return false;
      }
    }
  }

  private _cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private async _persist(now: Date, newState: St): Promise<void> {
    this.isPersisting = true;
    this.lastPersistTime = now;
    this.isANewStateAvailable = false;

    try {
      await this.persistor.persistDifference(
        this.lastPersistedState,
        newState
      );
    }
      //
    finally {
      this.lastPersistedState = newState;
      this.isPersisting = false;
      this.finishedPersistingCallback?.();

      // If a new state became available while the present state was saving, save again.
      if (this.isANewStateAvailable) {
        this.isANewStateAvailable = false;
        this.process(null, this.newestState as St);
      }
    }
  }

  /**
   * Pause the `Persistor` temporarily.
   *
   * When `pause` is called, the Persistor will not start a new persistence process, until method
   * `resume` is called. This will not affect the current persistence process, if one is currently
   * running.
   *
   * Note: A persistence process starts when the `persistDifference` method is called, and
   * finishes when the promise returned by that method completes.
   *
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Persists the current state (if it's not yet persisted), then pauses the `Persistor`
   * temporarily.
   *
   *
   * When `persistAndPause` is called, this will not affect the current persistence process, if
   * one is currently running. If no persistence process was running, it will immediately start a
   * new persistence process (ignoring `throttle`).
   *
   * Then, the Persistor will not start another persistence process, until method `resume` is
   * called.
   *
   * Note: A persistence process starts when the `persistDifference` method is called, and
   * finishes when the promise returned by that method completes.
   *
   */
  async persistAndPause(): Promise<void> {
    this.isPaused = true;

    this._cancelTimer();

    if (this.isInit //
      && !this.isPersisting //
      && (this.lastPersistedState !== this.newestState)) {

      const now = new Date();
      return this._persist(now, this.newestState as St); // TypeScript forced cast
    }
  }

  /**
   * Resumes persistence by the `Persistor`, after calling `pause` or `persistAndPause`.
   */
  resume(): void {
    this.isPaused = false;
    if (this.isInit) this.process(null, this.newestState as St);
  }
}

