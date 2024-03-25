import { ReduxAction } from 'async-redux-react';
import { State } from './State';

export abstract class Action extends ReduxAction<State> {
}


