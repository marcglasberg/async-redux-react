import { TodoItem } from './Todos.ts';
import { Action } from '../infra/Action.ts';

export class RemoveTodoAction extends Action {

  constructor(readonly item: TodoItem) {
    super();
  }

  reduce() {
    let newTodos = this.state.todos.removeTodo(this.item);
    return this.state.withTodos(newTodos);
  }
}
