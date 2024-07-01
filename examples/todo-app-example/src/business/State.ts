import { TodoList } from './TodoList';
import { Filter } from './Filter';

export class State {

  readonly todoList: TodoList;
  readonly filter: Filter;

  static initialState: State =
    new State({todoList: TodoList.empty, filter: Filter.showAll});

  constructor({todoList, filter}: { todoList: TodoList, filter: Filter }) {
    this.todoList = todoList;
    this.filter = filter;
  }

  withTodos(todoList: TodoList): State {
    return new State({todoList: todoList, filter: this.filter});
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
    if ((this.filter !== filter1) && (this.filter !== filter2))
      return new State({todoList: this.todoList, filter: filter1});
    else return this;
  }

  hasTodos(): boolean {
    return !this.todoList.isEmpty();
  }

  toString() {
    return `State{todoList=${this.todoList}, filter=${this.filter}}`;
  }
}
