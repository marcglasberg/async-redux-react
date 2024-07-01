/**
 * An unmodifiable set.
 *
 * An [UnmodifiableSetView] contains a [Set], and prevents that set from being changed through the view.
 * Methods that could change the set, such as [add] and [remove], throw an [UnsupportedError].
 * Permitted operations defer to the wrapped set.
 */
export class UnmodifiableSetView<T> implements Set<T> {
  private readonly _set: Set<T>;

  constructor(set: Set<T>) {
    this._set = set;
  }

  has(value: T): boolean {
    return this._set.has(value);
  }

  get size(): number {
    return this._set.size;
  }

  forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
    return this._set.forEach(callbackfn, thisArg);
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this._set[Symbol.iterator]();
  }

  entries(): IterableIterator<[T, T]> {
    return this._set.entries();
  }

  values(): IterableIterator<T> {
    return this._set.values();
  }

  keys(): IterableIterator<T> {
    return this._set.keys();
  }

  add(value: T): this {
    throw new Error('Cannot modify the set. Create a copy in necessary.');
  }

  clear(): void {
    throw new Error('Cannot modify the set. Create a copy in necessary.');
  }

  delete(value: T): boolean {
    throw new Error('Cannot modify the set. Create a copy in necessary.');
  }

  get [Symbol.toStringTag](): string {
    return this._set[Symbol.toStringTag];
  }

  toString() {
    return Array.from(this).toString();
  };
}
