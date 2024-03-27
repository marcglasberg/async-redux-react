import React from 'react';
import { Store, StoreProvider } from 'async-redux-react';
import { State } from '../business/State.ts';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppContent } from '../ui/AppContent.tsx';
import { persistor, userExceptionDialog } from './StoreParameters.tsx';

const store = new Store<State>({
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



