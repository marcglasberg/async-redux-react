// The Esserializer code was copied and adapted from the original copyrighted work, MIT licensed, by cshao.
// All credit goes to him. See: https://www.npmjs.com/package/esserializer

import { ESSerializer } from '../../../src/Esserializer';

test('TodoList class', () => {

  let todo1 = new TodoItem('First', false);
  let todo2 = new TodoItem('Second', false);
  let todo3 = new TodoItem('Third', true);
  let todos = new TodoList([todo1, todo2, todo3]);

  ESSerializer.registerClasses([TodoList, TodoItem]);

  let serialized = ESSerializer.serialize(todos);
  let deserialized = ESSerializer.deserialize(serialized);

  expect(serialized).toBe('{' +
    '"items":[' +
    '{"text":"First","completed":false,"*type":"TodoItem"},' +
    '{"text":"Second","completed":false,"*type":"TodoItem"},' +
    '{"text":"Third","completed":true,"*type":"TodoItem"}],' +
    '"*type":"TodoList"' +
    '}');

  expect(deserialized instanceof TodoList).toBeTruthy();

  let todosDeserialized = deserialized as TodoList;

  expect(Array.isArray(todosDeserialized.items)).toBeTruthy();

  expect(todosDeserialized.items.toString())
    .toBe('' +
      'TodoItem{text=First, completed=false},' +
      'TodoItem{text=Second, completed=false},' +
      'TodoItem{text=Third, completed=true}');

  expect(todosDeserialized.ifExists('Second')).toBeTruthy();
  expect(todosDeserialized.ifExists('xxx')).toBeFalsy();
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

class TodoList {

  // The list of items.
  readonly items: TodoItem[];

  static empty: TodoList = new TodoList();

  constructor(items?: TodoItem[]) {
    this.items = items ?? [];
  }

  addTodoFromText(text: string): TodoList {
    const trimmedText = text.trim();
    const capitalizedText = trimmedText.charAt(0).toUpperCase() + trimmedText.slice(1);
    return this.addTodo(new TodoItem(capitalizedText));
  }

  // If the item already exists, don't add it again.
  // Otherwise, add it to the top of the list.
  // If the text of the item is empty, don't add it.
  addTodo(newItem: TodoItem): TodoList {
    if ((newItem.text === '') || this.ifExists(newItem.text))
      return this;
    else
      return new TodoList([newItem, ...this.items]);
  }

  // Returns true if the given text is already in the list.
  ifExists(text: string): boolean {
    return this.items.some(todo => todo.text === text);
  }

  // Remove the given item from the list.
  removeTodo(item: TodoItem): TodoList {
    return new TodoList(this.items.filter(todo => todo !== item));
  }

  // Toggle the completed status of the given item.
  toggleTodo(item: TodoItem): TodoList {
    const newTodos = this.items.map(itemInList =>
      (itemInList === item) ? item.toggleCompleted() : itemInList
    );
    return new TodoList(newTodos);
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
    return `TodoList{${this.items.join(',')}}`;
  }
}

enum Filter {
  showAll = 'Showing ALL',
  showCompleted = 'Showing COMPLETED',
  showActive = 'Showing ACTIVE',
}
