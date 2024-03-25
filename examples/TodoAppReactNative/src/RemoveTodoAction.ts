import { TodoItem } from './Todos';
import { Action } from './Action';

export class RemoveTodoAction extends Action {

  constructor(readonly item: TodoItem) {
    super();
  }

  reduce() {
    let newTodos = this.state.todos.removeTodo(this.item);
    return this.state.withTodos(newTodos);
  }
}
