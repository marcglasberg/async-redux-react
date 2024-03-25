import { expect, test } from '@jest/globals';
import { Bdd, Feature, FeatureFileReporter, reporter } from 'easy-bdd-tool-jest';
import { ReduxAction, Store } from '../src';

reporter(new FeatureFileReporter());

const feature = new Feature('Action initial state');
const logger = (obj: any) => process.stdout.write(obj + '\n');

test('Test fixture', async () => {
  expect(new State(1).count).toBe(1);
});

Bdd(feature)
  .scenario('The action has access to its initial state.')
  .given('SYNC and ASYNC actions.')
  .when('The "before" and "reduce" and "after" methods are called.')
  .then('They have access to the store state as it was when the action was dispatched.')
  .note('The action initial state has nothing to do with the store initial state.')
  .run(async (_) => {

    // SYNC

    let store = new Store<State>({
      initialState: new State(1), logger: logger,
    });

    let actionSync = new IncrementSync();
    store.dispatch(actionSync);

    expect(actionSync.result).toBe('' +
      'before initialState: State(1)|' +
      'before state: State(1)|' +
      'before initialState: State(1)|' +
      'before state: State(42)|' +
      'reduce initialState: State(1)|' +
      'reduce state: State(42)|' +
      'reduce initialState: State(1)|' +
      'reduce state: State(100)|' +
      'after initialState: State(1)|' +
      'after state: State(101)|' +
      'after initialState: State(1)|' +
      'after state: State(1350)|'
    );

    // ASYNC

    store = new Store<State>({
      initialState: new State(1), logger: logger
    });

    let actionAsync = new IncrementAsync();
    await store.dispatchAndWait(actionAsync);

    expect(actionAsync.result).toBe('' +
      'before initialState: State(1)|' +
      'before state: State(1)|' +
      'before initialState: State(1)|' +
      'before state: State(42)|' +
      'reduce initialState: State(1)|' +
      'reduce state: State(42)|' +
      'reduce initialState: State(1)|' +
      'reduce state: State(100)|' +
      'after initialState: State(1)|' +
      'after state: State(101)|' +
      'after initialState: State(1)|' +
      'after state: State(1350)|'
    );
  });

class State {
  constructor(readonly count: number) {
  }

  toString() {
    return `State(${this.count})`;
  }
}

class IncrementSync extends ReduxAction<State> {

  result = '';

  before() {
    this.result += `before initialState: ${this.initialState}|`;
    this.result += `before state: ${this.state}|`;
    this.dispatch(new ChangeAction(42));
    this.result += `before initialState: ${this.initialState}|`;
    this.result += `before state: ${this.state}|`;
  }

  reduce() {
    this.result += `reduce initialState: ${this.initialState}|`;
    this.result += `reduce state: ${this.state}|`;
    this.dispatch(new ChangeAction(100));
    this.result += `reduce initialState: ${this.initialState}|`;
    this.result += `reduce state: ${this.state}|`;
    return new State(this.state.count + 1);
  }

  after() {
    this.result += `after initialState: ${this.initialState}|`;
    this.result += `after state: ${this.state}|`;
    this.dispatch(new ChangeAction(1350));
    this.result += `after initialState: ${this.initialState}|`;
    this.result += `after state: ${this.state}|`;
  }
}


class IncrementAsync extends ReduxAction<State> {

  result = '';

  async before() {
    this.result += `before initialState: ${this.initialState}|`;
    this.result += `before state: ${this.state}|`;
    this.dispatch(new ChangeAction(42));
    this.result += `before initialState: ${this.initialState}|`;
    this.result += `before state: ${this.state}|`;
  }

  async reduce() {
    this.result += `reduce initialState: ${this.initialState}|`;
    this.result += `reduce state: ${this.state}|`;
    this.dispatch(new ChangeAction(100));
    this.result += `reduce initialState: ${this.initialState}|`;
    this.result += `reduce state: ${this.state}|`;
    return (state: State) => new State(state.count + 1);
  }

  after() {
    this.result += `after initialState: ${this.initialState}|`;
    this.result += `after state: ${this.state}|`;
    this.dispatch(new ChangeAction(1350));
    this.result += `after initialState: ${this.initialState}|`;
    this.result += `after state: ${this.state}|`;
  }
}

class ChangeAction extends ReduxAction<State> {

  constructor(readonly newValue: number) {
    super();
  }

  reduce() {
    return new State(this.newValue);
  }
}
