import { ReduxAction } from 'async-redux-react';
import { State } from '../business/State';

export abstract class Action extends ReduxAction<State> {
}


