import {Action} from './Action';
import {UserException} from 'async-redux-react';
import {Filter} from './Filter';

export class AddTodoAction extends Action {

  constructor(readonly text: string) {
    super();
  }

  reduce() {

    if (this.state.todos.ifExists(this.text)) {
      throw new UserException('The item "' + this.text + '" already exists.');
    }

    let newTodos = this.state.todos.addTodoFromText(this.text);

    return this.state
      .withTodos(newTodos)
      .withFilter(Filter.showActive, Filter.showAll);
  }
}
