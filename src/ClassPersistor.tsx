import { ClassOrEnum, ESSerializer } from './Esserializer';
import { Persistor } from './Persistor';

/**
 * Use it like this:
 *
 * ```ts
 * const store = createStore<AppState>({
 *   initialState: initialState,
 *   persistor: new MyPersistor(),
 * });
 * ```
 *
 * Example for web:
 * ```
 * return new ClassPersistor<State>(
 *     async () => window.localStorage.getItem('state'),
 *     async (serialized) => window.localStorage.setItem('state', serialized),
 *     async () => window.localStorage.clear(),
 *     [State, Todos, TodoItem, Filter] // All state classes the app uses.
 *   );
 * ```
 *
 * Example for React Native:
 * ```
 * return new ClassPersistor<State>(
 *     async () => AsyncStorage.getItem('state'),
 *     async (serialized) => AsyncStorage.setItem('state', serialized),
 *     async () => AsyncStorage.clear(),
 *     [State, Todos, TodoItem, Filter] // All state classes the app uses.
 *   );
 * ```
 */
export class ClassPersistor<St> extends Persistor<St> {

  constructor(
    /**
     * Returns the serialized state. You can use this to load from localStorage or IndexedDB
     * (in React web), or AsyncStorage (in React Native) or other.
     * It should return a Promise that resolves to the serialized state, or to null if the state
     * is not yet persisted.
     */
    public loadSerialized: () => Promise<string | null>,
    //
    /**
     * Saves the given serialized state. You can use this to save to localStorage or IndexedDB
     * (in React web), or AsyncStorage (in React Native) or other.
     * It should return a Promise that resolves when the state is saved.
     */
    public saveSerialized: (serialized: string) => Promise<void>,
    //
    /**
     * Deletes the serialized state. You can use this to delete from the localStorage or IndexedDB
     * (in React web), or AsyncStorage (in React Native) or other.
     * It should return a Promise that resolves when the state is deleted.
     */
    public deleteSerialized: () => Promise<void>,
    //
    /**
     * You HAVE to list here all the custom classes that are part of your state, directly or
     * indirectly. Note: You don't need to list native JavaScript classes, like Date.
     * For example, suppose you have a class `State` that has a property `todos` of type `Todos`.
     * And the class `Todos` has a property `items` of type `Array<TodoItem>`.
     * Then you have to list all three classes here: `[State, Todos, TodoItem]`.
     */
    public classesToSerialize: Array<ClassOrEnum>
  ) {
    super();
  }

  /**
   * Read the saved state from the persistence. Should return null if the state is not yet
   * persisted. This method should be called only once, when the app starts, before the store
   * is created. The state it returns may become the store's initial-state. If some error
   * occurs while loading the info, we have to deal with it by fixing the problem. In the worse
   * case, if we think the state is corrupted and cannot be fixed, one alternative is deleting
   * all persisted files and returning null.
   */
  async readState(): Promise<St | null> {

    // Reads the JSON file as a string.
    const serializedString = await this.loadSerialized();
    if (serializedString === null) return null;

    ESSerializer.registerClasses(this.classesToSerialize);

    return ESSerializer.deserialize(serializedString);
  }

  /**
   * Save an initial-state to the persistence.
   */
  async saveInitialState(state: St) {
    const serializedString = ESSerializer.serialize(state);
    await this.saveSerialized(serializedString);
  }

  /**
   * Delete the saved state from the persistence.
   */
  async deleteState() {
    return this.deleteSerialized();
  }

  /**
   * We assume the state is small, and we save `newState` everytime, ignoring `lastPersistedState`.
   */
  async persistDifference(_lastPersistedState: St | null, newState: St) {
    const serializedString = ESSerializer.serialize(newState);
    await this.saveSerialized(serializedString);
  }
}

