import React, { useState } from 'react';
import {
  ClassPersistor,
  ShowUserException,
  Store,
  StoreProvider,
  useAllState,
  useClearExceptionFor,
  useDispatch,
  useExceptionFor,
  useIsFailed,
  useIsWaiting,
  UserException,
  useSelect,
  useStore,
} from 'async-redux-react';
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
      async (serialized: string) => window.localStorage.setItem('state', serialized),
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
const userExceptionDialog: ShowUserException = (exception: UserException, _count: number, next: () => void) => {

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

  const store = useStore();
  let isFailed = useIsFailed(AddTodoAction);
  let errorText = useExceptionFor(AddTodoAction)?.errorText ?? '';
  let clearExceptionFor = useClearExceptionFor();

  async function sendInputToStore(inputText: string) {
    let status = await store.dispatchAndWait(new AddTodoAction(inputText));
    if (status.isCompletedOk) setInputText(''); // If added, clean the text from the TextField.
  }

  return (
    <div className='inputWrapper'>

      <TextField className='inputField'
                 inputProps={{style: {paddingTop: 0, paddingBottom: 0, height: 55}}}
                 error={isFailed}
                 helperText={isFailed ? errorText : ""}
                 value={inputText}
                 onChange={(e) => {
                   const capitalizedText = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                   setInputText(capitalizedText);
                   clearExceptionFor(AddTodoAction);
                 }}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') sendInputToStore(inputText);
                 }}
      />
      <Button style={{height: 55}} variant="contained" color="primary"
              onClick={() => sendInputToStore(inputText)}>
        Add
      </Button>
    </div>
  );
};

const NoTodosWarning: React.FC = () => {
  const storeState = useAllState<State>();
  let filter = storeState.filter;
  let count = storeState.todos.count(filter);
  let countCompleted = storeState.todos.count(Filter.showCompleted);
  let countActive = storeState.todos.count(Filter.showActive);

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
  const store = useStore();
  const storeState = useAllState<State>();
  const filter = useSelect((state: State) => state.filter);
  const count = useSelect((state: State) => state.todos.count(filter));

  let items: TodoItem[] = useSelect((state: State) => state.todos.items);

  if (count === 0) return <NoTodosWarning/>;

  else {
    const filterTodos = (item: TodoItem) => {
      switch (storeState.filter) {
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
        {items.filter(filterTodos).map((item, index) => (
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
  const store = useStore();
  const storeState = useAllState<State>();

  return (
    <Button style={{display: "block", width: '100%', height: '60px', marginBottom: "10px"}}
            variant="outlined"
            onClick={() => {
              store.dispatch(new NextFilterAction());
            }}
    >
      {storeState.filter}
    </Button>
  );
};

const RemoveAllButton: React.FC = () => {
  const dispatch = useDispatch();
  let isDisabled = useIsWaiting(RemoveCompletedTodosAction);

  return (
    <Button style={{display: "block", width: '100%', height: '60px', marginBottom: "10px", color: 'white'}}
            disabled={isDisabled}
            variant="contained"
            onClick={() => dispatch(new RemoveCompletedTodosAction())}
    >
      {isDisabled ? <CircularProgress size={24} color='inherit'/> : 'Remove Completed Todos'}
    </Button>
  );
};

const AddRandomTodoButton: React.FC = () => {
  let isLoading = useIsWaiting(AddRandomTodoAction);
  const store = useStore();

  console.log('isLoading = ' + isLoading);

  return (
    <Button style={{display: "block", width: '100%', height: '60px', marginBottom: "10px", color: 'white'}}
            variant="contained"
            onClick={() => store.dispatch(new AddRandomTodoAction())}
    >
      {isLoading ? <CircularProgress size={24} color='inherit'/> : 'Add Random Todo'}
    </Button>
  );
};

