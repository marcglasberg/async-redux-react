// The Esserializer code was copied and adapted from the original copyrighted work, MIT licensed, by cshao.
// All credit goes to him. See: https://www.npmjs.com/package/esserializer

import { ESSerializer } from '../../../src/Esserializer';

test('State class', () => {

  let todo1 = new TodoItem('First', false);
  let todo2 = new TodoItem('Second', false);
  let todo3 = new TodoItem('Third', true);
  let todos = new Todos([todo1, todo2, todo3]);
  let filter = Filter.showActive;

  let state = new State({todos, filter});

  ESSerializer.registerClasses([State, Todos, TodoItem, Filter]);

  let serialized = ESSerializer.serialize(state);
  let deserialized = ESSerializer.deserialize(serialized);

  expect(serialized).toBe('' +
    '{' +
    '"todos":' +
    /*  */'{' +
    /*  */'"items":' +
    /*      */'[' +
    /*      */'{"text":"First","completed":false,"*type":"TodoItem"},' +
    /*      */'{"text":"Second","completed":false,"*type":"TodoItem"},' +
    /*      */'{"text":"Third","completed":true,"*type":"TodoItem"}' +
    /*      */'],' +
    /*  */'"*type":"Todos"' +
    /*  */'},' +
    '"filter":"Showing ACTIVE",' +
    '"*type":"State"' +
    '}');

  expect(deserialized instanceof State).toBeTruthy();

  let stateDeserialized = deserialized as State;

  expect(stateDeserialized.toString())
    .toBe('' +
      'State{' +
      'todos=Todos{TodoItem{text=First, completed=false},TodoItem{text=Second, completed=false},TodoItem{text=Third, completed=true}}, ' +
      'filter=Showing ACTIVE' +
      '}');

  expect(stateDeserialized.hasTodos()).toBeTruthy();

  let deserializedTodos = stateDeserialized.todos;

  expect(deserializedTodos.isEmpty()).toBeFalsy();
  expect(deserializedTodos.ifExists('xxx')).toBeFalsy();
  expect(deserializedTodos.ifExists('Second')).toBeTruthy();
});

class TodoItem {
  constructor(
    public text: string,
    public completed: boolean = false) {
  }

  // Returns a new item with the same text, but with the opposite completed status.
  toggleCompleted() {
    return new TodoItem(this.text, !this.completed);
  }

  showsWhenFilterIs(filter: Filter) {
    switch (filter) {
      case Filter.showCompleted:
        return this.completed;
      case Filter.showActive:
        return !this.completed;
      case Filter.showAll:
      default:
        return true;
    }
  }

  toString() {
    return `TodoItem{text=${this.text}, completed=${this.completed}}`;
  }
}

class Todos {

  // The list of items.
  readonly items: TodoItem[];

  static empty: Todos = new Todos();

  constructor(items?: TodoItem[]) {
    this.items = items ?? [];
  }

  addTodoFromText(text: string): Todos {
    const trimmedText = text.trim();
    const capitalizedText = trimmedText.charAt(0).toUpperCase() + trimmedText.slice(1);
    return this.addTodo(new TodoItem(capitalizedText));
  }

  // If the item already exists, don't add it again.
  // Otherwise, add it to the top of the list.
  // If the text of the item is empty, don't add it.
  addTodo(newItem: TodoItem): Todos {
    if ((newItem.text === '') || this.ifExists(newItem.text))
      return this;
    else
      return new Todos([newItem, ...this.items]);
  }

  // Returns true if the given text is already in the list.
  ifExists(text: string): boolean {
    return this.items.some(todo => todo.text === text);
  }

  // Remove the given item from the list.
  removeTodo(item: TodoItem): Todos {
    return new Todos(this.items.filter(todo => todo !== item));
  }

  // Toggle the completed status of the given item.
  toggleTodo(item: TodoItem): Todos {
    const newTodos = this.items.map(itemInList =>
      (itemInList === item) ? item.toggleCompleted() : itemInList
    );
    return new Todos(newTodos);
  }

  // Count the number of todos that appear when the given filter is applied.
  // If no filter is given, count all todos.
  count(filter?: Filter) {
    return this.items.filter(item => item.showsWhenFilterIs(filter ?? Filter.showAll)).length;
  }

  // Returns true if there are no todos that appear when the given filter is applied.
  // If no filter is given, checks if there are no todos at all.
  isEmpty(filter?: Filter) {
    return this.count(filter) === 0;
  }

  * [Symbol.iterator]() {
    for (let i = 0; i < this.items.length; i++) {
      yield this.items[i];
    }
  }

  toString() {
    return `Todos{${this.items.join(',')}}`;
  }
}

enum Filter {
  showAll = 'Showing all',
  showCompleted = 'Showing COMPLETED',
  showActive = 'Showing ACTIVE',
}

class State {

  readonly todos: Todos;
  readonly filter: Filter;

  static initialState: State =
    new State({todos: Todos.empty, filter: Filter.showAll});

  constructor({todos, filter}: { todos: Todos, filter: Filter }) {
    this.todos = todos;
    this.filter = filter;
  }

  withTodos(todos: Todos): State {
    return new State({todos: todos || this.todos, filter: this.filter});
  }

  /**
   * You can pass one or two filters here.
   * If the current filter in the state is already on one of those filters, keeps the
   * state unaltered. Otherwise, change the state to the first filter listed here:
   *
   * ```
   * // If the current filter is Filter.showCompleted, nothing changes.
   * // Otherwise, changes the filter to Filter.showCompleted.
   * state.withFilter(Filter.showCompleted);
   *
   * // If the current filter is Filter.showAll or Filter.showActive, nothing changes.
   * // Otherwise, changes the filter to Filter.showAll.
   * state.withFilter(Filter.showAll, Filter.showActive)
   * ```
   */
  withFilter(filter1: Filter, filter2?: Filter): State {
    if ((this.filter != filter1) && (this.filter != filter2))
      return new State({todos: this.todos, filter: filter1});
    else return this;
  }

  hasTodos(): boolean {
    return !this.todos.isEmpty();
  }

  toString() {
    return `State{todos=${this.todos}, filter=${this.filter}}`;
  }
}

