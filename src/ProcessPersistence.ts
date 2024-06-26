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

  // Same as [Persistor.readState] but will remember the read state as the [lastPersistedState].
  async readState(): Promise<St | null> {
    const state = await this.persistor.readState();
    this.lastPersistedState = state;
    return state;
  }

  // Same as [Persistor.deleteState] but will clear the [lastPersistedState].
  async deleteState(): Promise<void> {
    this.lastPersistedState = null;
    await this.persistor.deleteState();
  }

  // 1) If we're still persisting the last time, don't persist no matter what.
  // 2) If action is of type `SetStateDontPersistAction`, don't persist, but consider the state
  //    as persisted.
  // 3) If throttle period is done (or if action is PersistAction), persist.
  // 4) If throttle period is NOT done, create a timer to persist as soon as it finishes.
  //
  // Return true if the persist process started.
  // Return false if persistence was postponed.
  //
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
        || action instanceof PersistAction
      ) {
        this._cancelTimer();
        this._persist(now, newState);
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

      // If a new state became available while the present state was saving, save again.
      if (this.isANewStateAvailable) {
        this.isANewStateAvailable = false;
        this.process(null, this.newestState as St);
      }
    }
  }

  // Pause the [Persistor] temporarily.
  //
  // When [pause] is called, the Persistor will not start a new persistence process, until method
  // [resume] is called. This will not affect the current persistence process, if one is currently
  // running.
  //
  // Note: A persistence process starts when the [persistDifference] method is called, and
  // finishes when the promise returned by that method completes.
  //
  pause(): void {
    this.isPaused = true;
  }

  // Persists the current state (if it's not yet persisted), then pauses the [Persistor]
  // temporarily.
  //
  //
  // When [persistAndPause] is called, this will not affect the current persistence process, if
  // one is currently running. If no persistence process was running, it will immediately start a
  // new persistence process (ignoring [throttle]).
  //
  // Then, the Persistor will not start another persistence process, until method [resume] is
  // called.
  //
  // Note: A persistence process starts when the [persistDifference] method is called, and
  // finishes when the promise returned by that method completes.
  //
  persistAndPause(): void {
    this.isPaused = true;

    this._cancelTimer();

    if (this.isInit && !this.isPersisting && this.lastPersistedState !== this.newestState) {
      const now = new Date();
      this._persist(now, this.newestState as St); // TypeScript forced cast
    }
  }

  // Resumes persistence by the [Persistor], after calling [pause] or [persistAndPause].
  resume(): void {
    this.isPaused = false;
    if (this.isInit) this.process(null, this.newestState as St);
  }
}

