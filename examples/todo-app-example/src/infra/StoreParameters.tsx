import { ClassPersistor, ShowUserException, UserException, } from 'async-redux-react';
import { Button, Dialog, DialogActions, DialogContent } from '@mui/material';
import { State } from '../business/State';
import { TodoItem, Todos } from '../business/Todos';
import { Filter } from '../business/Filter';
import { createRoot } from "react-dom/client";

/**
 * Uses localStorage, since this is a React web app.
 * Could also use IndexedDB.
 * If it was a React Native app, we would use AsyncStorage.
 */
export const persistor = new ClassPersistor<State>(
  async () => window.localStorage.getItem('state'),
  async (serialized: string) => window.localStorage.setItem('state', serialized),
  async () => window.localStorage.clear(),
  [State, Todos, TodoItem, Filter]
);

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
export const userExceptionDialog: ShowUserException = (exception: UserException, _count: number, next: () => void) => {

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

