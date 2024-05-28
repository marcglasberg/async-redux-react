import { TodoItem } from './TodoList';
import { Action } from '../infra/Action';

export class RemoveTodoAction extends Action {

  constructor(readonly item: TodoItem) {
    super();
  }

  reduce() {
    let newTodos = this.state.todoList.removeTodo(this.item);
    return this.state.withTodos(newTodos);
  }
}
