import React, { useState } from 'react';
import {
  useAllState,
  useClearExceptionFor,
  useDispatch,
  useExceptionFor,
  useIsFailed,
  useIsWaiting,
  useSelect,
  useStore
} from 'async-redux-react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import BouncyCheckbox from 'react-native-bouncy-checkbox';
import { AddTodoAction } from '../business/AddTodoAction';
import { ToggleTodoAction } from '../business/ToggleTodoAction';
import { RemoveCompletedTodosAction } from '../business/RemoveCompletedTodosAction';
import { TodoItem } from '../business/TodoList';
import { NextFilterAction } from '../business/NextFilterAction';
import { Filter } from '../business/Filter';
import { AddRandomTodoAction } from '../business/AddRandomTodoAction';
import { State } from '../business/State';

export function AppContent() {
  return (
    <View style={{flex: 1}}>
      <Text style={{textAlign: 'center', padding: 16, fontSize: 35, color: '#A44'}}>Todo List</Text>
      <TodoInput/>
      <TodoList/>
      <FilterButton/>
      <AddRandomTodoButton/>
      <RemoveAllButton/>
    </View>
  );
}

function TodoInput() {

  const [inputText, setInputText] = useState<string>('');
  const store = useStore();

  let isFailed = useIsFailed(AddTodoAction);
  let errorText = useExceptionFor(AddTodoAction)?.errorText ?? '';
  let clearExceptionFor = useClearExceptionFor();

  async function sendInputToStore(text: string) {
    let status = await store.dispatchAndWait(new AddTodoAction(text));
    if (status.isCompletedOk) setInputText(''); // If added, clean the text from the input.
  }

  return (
    <View>
      <View style={styles.inputRow}>

        <TextInput
          placeholder={'Type here...'}
          value={inputText}
          style={[styles.input, isFailed ? styles.inputError : null]}
          onChangeText={(text) => {
            const capitalizedText = text.charAt(0).toUpperCase() + text.slice(1);
            setInputText(capitalizedText);
            clearExceptionFor(AddTodoAction);
          }}
          onSubmitEditing={() => sendInputToStore(inputText)}
        />

        <TouchableOpacity onPress={() => sendInputToStore(inputText)} style={styles.button}>
          <Text style={styles.footerButtonText}>Add</Text>
        </TouchableOpacity>

      </View>
      {isFailed && <Text style={styles.helperText}>{errorText}</Text>}
    </View>
  );
}

function NoTodosWarning() {

  // Getting the whole store state with `useAllState()` works,
  // but the component will rebuild whenever the state changes.
  const filter = useAllState<State>().filter;

  // Using `useSelect()` is better, because the component will
  // only rebuild when the selected part of the state changes.
  const todoList = useSelect((state: State) => state.todoList);
  let count = todoList.count(filter);
  let countCompleted = todoList.count(Filter.showCompleted);
  let countActive = todoList.count(Filter.showActive);

  if (count === 0) {
    if (filter === Filter.showAll)
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={styles.dimmedText}>No todos</Text>
        </View>
      );
    else if (filter === Filter.showActive) {
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          {countCompleted !== 0 ? (
            <>
              <Text style={styles.dimmedText}>No active todos</Text>
              <Text style={styles.dimmedText}>(change filter to
                see {countCompleted} completed)</Text>
            </>
          ) : (
            <Text style={styles.dimmedText}>No active todos</Text>
          )}
        </View>
      );
    } else if (filter === Filter.showCompleted) {
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          {countActive !== 0 ? (
            <>
              <Text style={styles.dimmedText}>No completed todos</Text>
              <Text style={styles.dimmedText}>(change filter to see {countActive} active)</Text>
            </>
          ) : (
            <Text style={styles.dimmedText}>No active todos</Text>
          )}
        </View>
      );
    } else throw new Error('Invalid filter: ' + filter);
  }
  //
  else return <View/>;
}

function TodoList() {

  const filter = useSelect((state: State) => state.filter);
  const count = useSelect((state: State) => state.todoList.count(filter));
  let items: TodoItem[] = useSelect((state: State) => state.todoList.items);

  // No todos to show with the current filter.
  if (count === 0) return <NoTodosWarning/>;
    //
  // Show the list of todoItems.
  else {
    const filterTodos = (item: TodoItem) => {
      switch (filter) {
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
      <View style={{flex: 1}}>

        <ScrollView>
          {items.filter(filterTodos).map((item, index) => (
            <TodoItemComponent key={index} item={item} />
          ))}
        </ScrollView>
        <View
          style={{backgroundColor: '#CCC', height: 0.75, marginTop: 10, marginHorizontal: 15}
          }
        />
      </View>
    );
  }
}

function TodoItemComponent({item}: {item: TodoItem}) {
  const store = useStore();

  return <BouncyCheckbox
    size={30}
    style={styles.checkbox}
    isChecked={item.completed}
    disableBuiltInState={true}
    fillColor="#555"
    unfillColor="#FFE"
    text={item.text}
    innerIconStyle={{borderWidth: 2}}
    onPress={(_) => {
      store.dispatch(new ToggleTodoAction(item));
    }}
  />
}

function FilterButton() {
  const store = useStore();
  const state = useAllState<State>();

  // <View style={{ paddingVertical: 20 }}>
  return (

    <TouchableOpacity
      onPress={() => {
        store.dispatch(new NextFilterAction());
      }}
      style={styles.filterButton}
    >
      <Text style={styles.filterButtonText}>{state.filter}</Text>
    </TouchableOpacity>
  );
};

function RemoveAllButton() {
  const dispatch = useDispatch();
  let isDisabled = useIsWaiting(RemoveCompletedTodosAction);

  return (
    <TouchableOpacity
      onPress={() => {
        dispatch(new RemoveCompletedTodosAction());
      }}
      style={styles.footerButton}
      disabled={isDisabled}
    >

      {isDisabled ? (
        <ActivityIndicator size="small" color="#ffffff"/>
      ) : (
        <Text style={styles.footerButtonText}>Remove Completed Todos</Text>
      )}

    </TouchableOpacity>
  );
};

function AddRandomTodoButton() {
  let isLoading = useIsWaiting(AddRandomTodoAction);
  const store = useStore();

  return (
    <TouchableOpacity
      onPress={() => store.dispatch(new AddRandomTodoAction())}
      style={styles.footerButton}
    >

      {isLoading ?
        <ActivityIndicator size="small" color="#ffffff"/>
        :
        <Text style={styles.footerButtonText}>Add Random Todo</Text>
      }

    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingRight: 10
  },
  helperText: {
    color: 'red',
    fontSize: 14,
    marginLeft: 10,
    marginBottom: 10
  },
  label: {
    marginBottom: 8
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    paddingHorizontal: 25
  },
  footerButtonText: {
    color: '#fff'
  },
  filterButtonText: {
    color: '#000'
  },
  dimmedText: {
    fontSize: 20,
    color: '#BBB'
  },
  footerButton: {
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 15,
    paddingHorizontal: 25,
    marginBottom: 10,
    marginHorizontal: 10
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#222',
    padding: 15,
    paddingHorizontal: 25,
    marginBottom: 10,
    marginHorizontal: 10
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    padding: 10,
    margin: 10
  },
  inputError: {
    borderColor: 'red'
  },
  checkbox: {
    paddingHorizontal: 10,
    marginRight: 30,
    paddingVertical: 6
  }
});
