import { TodoItem } from './Todos';
import { Action } from './Action';

export class ToggleTodoAction extends Action {

  constructor(readonly item: TodoItem) {
    super();
  }

  reduce() {
    let newTodos = this.state.todos.toggleTodo(this.item);
    return this.state.withTodos(newTodos);
  }
}

