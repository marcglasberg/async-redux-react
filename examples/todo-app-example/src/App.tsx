import React, { useState } from 'react';
import { ClassPersistor, ShowUserException, Store, StoreProvider, useStore } from 'async-redux-react';
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField
} from '@mui/material';
import { State } from './State';
import { AddTodoAction } from './AddTodoAction';
import { ToggleTodoAction } from './ToggleTodoAction';
import { RemoveCompletedTodosAction } from './RemoveCompletedTodosAction';
import { TodoItem, Todos } from './Todos';
import { NextFilterAction } from './NextFilterAction';
import { Filter } from './Filter';
import { AddRandomTodoAction } from './AddRandomTodoAction';
import { createRoot } from "react-dom/client";
import './AppStyles.css';

export function App() {

  const store = new Store<State>({
    initialState: State.initialState,
    showUserException: userExceptionDialog,
    persistor: getPersistor(),
  });

  return (
    <StoreProvider store={store}>
      <AppContent/>
    </StoreProvider>
  );

  // Uses AsyncStorage, since this is a React Native app. If it was a React web app,
  // we would use localStorage or IndexedDB.
  function getPersistor() {
    return new ClassPersistor<State>(
      async () => window.localStorage.getItem('state'),
      async (serialized) => window.localStorage.setItem('state', serialized),
      async () => window.localStorage.clear(),
      [State, Todos, TodoItem, Filter]
    );
  }
}

/**
 * It could also open a browser dialog:
 *
 * ```ts
 * const userExceptionDialog: ShowUserException =
 *   (exception, count, next) => {
 *     let message = exception.title ? `${exception.title} - ${exception.message}` : exception.message;
 *     window.alert(message);
 *     next();
 *   };
 * ```
 *
 * In React Native it could be:
 *
 * ```ts
 * const userExceptionDialog: ShowUserException =
 *   (exception, count, next) => {
 *     Alert.alert(
 *       exception.title || exception.message,
 *       exception.title ? exception.message : '',
 *       [{ text: 'OK', onPress: (_value?: string) => next() }]
 *     );
 *   };
 * ```
 */
const userExceptionDialog: ShowUserException = (exception, _count, next) => {

  const container = document.getElementById('dialog-root');
  if (!container) return;

  const root = createRoot(container!);

  const closeDialog = () => {
    root.unmount();
    next();
  };

  root.render(
    <Dialog open={true} onClose={closeDialog}>
      <DialogContent>
        <p>{exception.title || 'Error'}</p>
        <p>{exception.message}</p>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeDialog}>OK</Button>
      </DialogActions>
    </Dialog>
  );
};

const AppContent: React.FC = () => {
  return (
    <div className='appContentStyle'>
      <h1 className='h1Style'>Todos</h1>
      <TodoInput/>
      <TodoList/>
      <div className='bottomFixedDiv'>
        <FilterButton/>
        <AddRandomTodoButton/>
        <RemoveAllButton/>
      </div>
    </div>
  );
};

const TodoInput: React.FC = () => {

  const [inputText, setInputText] = useState<string>('');
  const store = useStore<State>();

  let isFailed = store.isFailed(AddTodoAction);
  let errorText = store.exceptionFor(AddTodoAction)?.errorText ?? '';

  async function sendInputToStore(inputText: string) {
    let status = await store.dispatchAndWait(new AddTodoAction(inputText));
    if (status.isCompletedOk) setInputText(''); // If added, clean the text from the TextField.
  }

  return (
    <div className='inputWrapper'>
      <TextField className='inputField'
                 placeholder={isFailed ? errorText : "Type here..."}
                 error={isFailed}
                 value={inputText}
                 onChange={(e) => {
                   const capitalizedText = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                   setInputText(capitalizedText);
                   store.clearExceptionFor(AddTodoAction);
                 }}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') sendInputToStore(inputText);
                 }}
      />
      <Button variant="contained" color="primary" onClick={() => sendInputToStore(inputText)}>
        Add
      </Button>
    </div>
  );
};

const NoTodosWarning: React.FC = () => {
  const store = useStore<State>();
  let filter = store.state.filter;
  let count = store.state.todos.count(filter);
  let countCompleted = store.state.todos.count(Filter.showCompleted);
  let countActive = store.state.todos.count(Filter.showActive);

  if (count === 0) {
    let warningText = '';
    let additionalText = '';

    if (filter === Filter.showAll) {
      warningText = 'No todos';
    } else if (filter === Filter.showActive) {
      warningText = 'No active todos';
      if (countCompleted !== 0) {
        additionalText = ` (change filter to see ${countCompleted} completed)`;
      }
    } else if (filter === Filter.showCompleted) {
      warningText = 'No completed todos';
      if (countActive !== 0) {
        additionalText = ` (change filter to see ${countActive} active)`;
      }
    } else {
      throw new Error('Invalid filter: ' + filter);
    }

    return (
      <div className='noTodosDiv'>
        <p className='noTodosText'>{warningText}</p>&nbsp;
        {additionalText && <p className='noTodosText'>{additionalText}</p>}
      </div>
    );
  }

  return <div></div>;
};
const TodoList: React.FC = () => {
  const store = useStore<State>();
  let filter = store.state.filter;
  let count = store.state.todos.count(filter);

  if (count === 0) return <NoTodosWarning/>;

  else {
    const filterTodos = (item: TodoItem) => {
      switch (store.state.filter) {
        case Filter.showCompleted:
          return item.completed;
        case Filter.showActive:
          return !item.completed;
        case Filter.showAll:
        default:
          return true;
      }
    };

    return (
      <div className='todoListDiv'>
        {store.state.todos.items.filter(filterTodos).map((item, index) => (
          <FormControlLabel
            key={index}
            control={
              <Checkbox
                checked={item.completed}
                onChange={() => store.dispatch(new ToggleTodoAction(item))}
                color="primary"
              />
            }
            label={item.text}
          />
        ))}
      </div>
    );
  }
};

const FilterButton: React.FC = () => {
  const store = useStore<State>();

  return (
    <Button style={{display: "block", width: '100%', height: '60px', marginBottom: "10px"}}
            variant="outlined"
            onClick={() => {
              store.dispatch(new NextFilterAction());
            }}
    >
      {store.state.filter}
    </Button>
  );
};

const RemoveAllButton: React.FC = () => {
  const store = useStore<State>();
  let disabled = store.isWaiting(RemoveCompletedTodosAction);

  return (
    <Button style={{display: "block", width: '100%', height: '60px', marginBottom: "10px", color: 'white'}}
            disabled={disabled}
            variant="contained"
            onClick={() => store.dispatch(new RemoveCompletedTodosAction())}
    >
      {disabled ? <CircularProgress size={24} color='inherit'/> : 'Remove Completed Todos'}
    </Button>
  );
};

const AddRandomTodoButton: React.FC = () => {
  const store = useStore<State>();
  let loading = store.isWaiting(AddRandomTodoAction);
  let failed = store.isFailed(AddRandomTodoAction);

  return (
    <Button style={{display: "block", width: '100%', height: '60px', marginBottom: "10px", color: 'white'}}
            variant="contained"
            onClick={() => store.dispatch(new AddRandomTodoAction())}
    >
      {loading ? <CircularProgress size={24} color='inherit'/> : 'Add Random Todo'}
      {failed ? ' - FAILED' : ' - NOT FAILED'}
    </Button>
  );
};

