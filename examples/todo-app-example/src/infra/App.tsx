import React from "react";
import { Store, StoreProvider, } from 'async-redux-react';
import { persistor, userExceptionDialog } from './StoreParameters';
import { State } from '../business/State';
import '../ui/AppStyles.css';
import { AppContent } from '../ui/AppContent';

const store = new Store<State>({
    initialState: State.initialState,
    showUserException: userExceptionDialog,
    persistor: persistor,
  }
);

export const App: React.FC = () => {
  return (
    <StoreProvider store={store}>
      <AppContent/>
    </StoreProvider>
  );
}

