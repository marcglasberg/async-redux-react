import { ReduxAction } from 'async-redux-react';
import { State } from '../business/State.ts';

export abstract class Action extends ReduxAction<State> {
}


