import { ClassPersistor, ShowUserException } from 'async-redux-react';
import { Alert } from 'react-native';
import { State } from '../business/State.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TodoItem, Todos } from '../business/Todos.ts';
import { Filter } from '../business/Filter.ts';

// Uses AsyncStorage, since this is a React Native app. If it was a React web app,
// we would use localStorage or IndexedDB.
export const persistor = new ClassPersistor<State>(
  async () => await AsyncStorage.getItem('state'),
  async (serialized) => await AsyncStorage.setItem('state', serialized),
  async () => await AsyncStorage.clear(),
  [State, Todos, TodoItem, Filter] // All custom classes in the state (except native JavaScript ones).
);

export const userExceptionDialog: ShowUserException =
  (exception, count, next) => {
    Alert.alert(
      exception.title || exception.message,
      exception.title ? exception.message : '',
      [{text: 'OK', onPress: (_value?: string) => next()}]
    );
  };

