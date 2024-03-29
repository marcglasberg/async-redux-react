import {Action} from '../infra/Action.ts';
import {UserException} from 'async-redux-react';
import {Filter} from './Filter.ts';

export class AddTodoAction extends Action {

  constructor(readonly text: string) {
    super();
  }

  reduce() {

    if (this.state.todos.ifExists(this.text)) {
      throw new UserException(
        `The item "${this.text}" already exists.`, {
          errorText: 'Type something else'
        }).withDialog(true);
    }

    let newTodos = this.state.todos.addTodoFromText(this.text);

    return this.state
      .withTodos(newTodos)
      .withFilter(Filter.showActive, Filter.showAll);
  }
}
