import { TodoItem } from './TodoList';
import { Action } from '../infra/Action';

export class ToggleTodoAction extends Action {

  constructor(readonly item: TodoItem) {
    super();
  }

  reduce() {
    let newTodos = this.state.todoList.toggleTodo(this.item);
    return this.state.withTodos(newTodos);
  }
}

