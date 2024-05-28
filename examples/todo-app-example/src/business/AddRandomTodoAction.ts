import { Action } from '../infra/Action';
import { Filter } from './Filter';
import { State } from './State';
import { UserException } from 'async-redux-react';
import { delayMillis } from "../utils/utils";

/**
 * Add a random item to the list. The item is a random fact from the NumbersAPI.
 * If the item already exists, try again until it gets a new one (unlikely, but possible).
 * If the API fails, shows an error dialog to the user.
 */
export class AddRandomTodoAction extends Action {

  async reduce() {

    // For demonstration purposes only. Just to give us some
    // time to see the spinner while the information loads.
    await delayMillis(250);

    let text = await this.getTextFromTheNumbersAPI();

    return (state: State) => state
      .withTodos(this.state.todoList.addTodoFromText(text))
      .withFilter(Filter.showActive, Filter.showAll);
  }

  private async getTextFromTheNumbersAPI() {

    let text: string;

    do {
      // Connect with the NumbersAPI to get a random fact.
      let response = await fetch('http://numbersapi.com/random/trivia');

      // If the connection failed, throw an exception.
      if (!response.ok) throw new UserException('Failed to connect to the NumbersAPI.');

      // Get the response text.
      text = await response.text();

      // If the response is empty, throw an exception.
      if (text === '') throw new UserException('Failed to get text from the NumbersAPI.');

    }
      // Repeat the process if the item already exists in the todo list (unlikely, but possible).
    while (this.state.todoList.ifExists(text));

    return text;
  }
}
