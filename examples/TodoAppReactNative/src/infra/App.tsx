import React from 'react';
import { createStore, StoreProvider } from 'async-redux-react';
import { State } from '../business/State';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppContent } from '../ui/AppContent';
import { persistor, userExceptionDialog } from './StoreParameters';

const store = createStore<State>({
  initialState: State.initialState,
  showUserException: userExceptionDialog,
  persistor: persistor
});

export const App: React.FC = () => {
  return (
    <StoreProvider store={store}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </StoreProvider>
  );
};



