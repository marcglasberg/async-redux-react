import { Action } from '../infra/Action';
import { UserException } from 'async-redux-react';
import { Filter } from './Filter';

export class AddTodoAction extends Action {

  constructor(readonly text: string) {
    super();
  }

  reduce() {

    if (this.state.todoList.ifExists(this.text)) {
      throw new UserException(
        `The item "${this.text}" already exists.`, {
          errorText: `Type something else other than "${this.text}"`
        });
    }

    let newTodos = this.state.todoList.addTodoFromText(this.text);

    return this.state
      .withTodos(newTodos)
      .withFilter(Filter.showActive, Filter.showAll);
  }
}
