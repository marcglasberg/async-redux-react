<img src="https://asyncredux.com/img/PlatipusLandscape.jpg">

Async Redux is:

* Simple to learn and easy to use
* Powerful enough to handle complex apps with millions of users
* Testable

## What is it?

An optimized, unofficial version of Redux, written from the ground up,
created by [Marcelo Glasberg](https://github.com/marcglasberg), launched in July 2024.

While new for React, it's a **mature solution** as it's
been [available for Flutter](https://pub.dev/packages/async_redux) for years
(top 8% of packages), battle-tested in hundreds of real-world applications.

## Documentation

The Async Redux docs are published
at **[https://asyncredux.com](https://asyncredux.com)**

* [Getting Started](https://asyncredux.com/react/intro)
* [Tutorial: A simple Todo List app](https://asyncredux.com/react/tutorial/setting-up-the-store)
* [The Basics](https://asyncredux.com/react/basics/store-and-state)

## How does it compare?

State management solutions can sometimes overwhelm with the complexity of concepts you 
have to grasp and the significant knowledge overhead needed to navigate the pitfalls.
**Async Redux** is the opposite:
There's no need to be super clever to make things work.

[Compare it with Redux Toolkit, TanStack Query, Zustand and Mobx](https://asyncredux.com/react/category/comparisons).

<hr>

# Overview

For a quick overview, here are the main concepts:

## Store and state

The **store** holds all the application **state**. A few examples:

```tsx 
// Here, the state is a number
const store = createStore<number>({initialState: 1});

// Here, the state is a plain JS object
const store = createStore({ initialState: {name: 'Mary', age: 25} });

// Here, the state is an ES6 class object
class State { constructor(public name: string, public age: number){} }
const store = createStore<State>({ initialState: new State('Mary', 25) });
``` 

To use the store, add it in a `StoreProvider` at the top of your component tree.

```tsx
function App() {
  return (
    <StoreProvider store={store}>
      <AppContent />
    </StoreProvider>
  );
};
```

&nbsp;

## Components use the state

The `useAllState` hook lets you access the state from any component.
It will rebuild when the state changes.

```tsx
function MyComponent() { 
  const state = useAllState();   
  
  return <div>{state.name} has {state.age} years old</div>;    
};
```

The `useSelect` hook selects only the part of the state that your component needs.
It will rebuild only when that part changes.

```tsx
function MyComponent() { 
  const name = useSelect((state) => state.name);   
  const age = useSelect((state) => state.age);
     
  return <div>{name} has {age} years old</div>;    
};
```

The `useObject` hook is another alternative that only rebuilds when needed:

```tsx
function MyComponent() {
 
  const state = useObject((state) => {
    name: state.name, 
    age: state.age
  });
       
  return <div>{state.name} has {state.age} years old</div>;    
};
```

&nbsp;

## Actions and reducers

An **action** is a class that contain its own **reducer**.

```tsx
class Increment extends Action {

  reduce() { 
    // The reducer has access to the current state
    return this.state + 1; // It returns a new state 
  };
}
```

&nbsp;

## Dispatch an action

The store state is **immutable**.

The only way to change the store **state** is by dispatching an **action**.
The action reducer returns a new state, that replaces the old one.

```tsx
// Dispatch an action
store.dispatch(new Increment());

// Dispatch multiple actions
store.dispatchAll([new Increment(), new LoadText()]);

// Dispatch an action and wait for it to finish
await store.dispatchAndWait(new Increment());

// Dispatch multiple actions and wait for them to finish
await store.dispatchAndWaitAll([new Increment(), new LoadText()]);
```

&nbsp;

## Components can dispatch actions

The hooks to dispatch actions are `useDispatch` , `useDispatchAll` etc.

```tsx
function MyComponent() { 
  const dispatch = useDispatch();  

  return (
      <Button onClick={() => dispatch(new LoadText())}> 
        Click me! 
      </Button>
  );
};
```

Or getting the store with `useStore` also allows you to dispatch actions:

```tsx
function MyComponent() { 
  const store = useStore();  

  return (
      <Button onClick={() => store.dispatch(new LoadText())}> 
        Click me! 
      </Button>
  );
};
```

&nbsp;

## Actions can do asynchronous work

They can download information from the internet, or do any other async work.

```tsx
const store = createStore<string>({initialState: ''});
```

```tsx
class LoadText extends Action {

  // This reducer returns a Promise
  async reduce() {

    // Download something from the internet
    let response = await fetch('https://dummyjson.com/todos/1');
    let text = await response.text(); 

    // Change the state with the downloaded information
    return (state) => text;
  }
```

> If you want to understand the above code in terms of traditional Redux patterns,
> the beginning of the `reduce` method is the equivalent of a middleware,
> and the return function `(state) => text` is the equivalent of a traditional reducer.
> It's still Redux, just written in a way that is easy and boilerplate-free.
> No need for Thunks or Sagas.

&nbsp;

## Actions can throw errors

If something bad happens, you can simply **throw an error**. In this case, the state will not
change. Errors are caught globally and can be handled in a central place, later.

In special, if you throw a `UserException`, which is a type provided by Async Redux,
a dialog (or other UI) will open automatically, showing the error message to the user.

```tsx
class LoadText extends Action {
  
  async reduce() {
    let response = await fetch("https://dummyjson.com/todos/random/1");
    if (!response.ok) throw new UserException("Failed to load.");    
              
    let text = await response.text();         
    return (state) => text;
  }
```

&nbsp;

## Components can react to actions

To show a spinner while an asynchronous action is running, use `isWaiting(action)`.

To show an error message inside the component, use `isFailed(action)`.

```tsx
function MyComponent() {

  const isWaiting = useIsWaiting(LoadText); 
  const isFailed = useIsFailed(LoadText);  
  const state = useAllState();  
  
  if (isWaiting) return <CircularProgress />
  if (isFailed) return <p>Loading failed...</p>;
  return <p>{state}</p>;
}
```

&nbsp;

## Actions can dispatch other actions

You can use `dispatchAndWait` to dispatch an action and wait for it to finish.

```tsx
class LoadTextAndIncrement extends Action {

  async reduce() {
  
    // Dispatch and wait for the action to finish   
    await this.dispatchAndWait(new LoadText());
    
    // Only then, increment the state
    return (state) => state.copy({ count: state.count + 1 });  
  }
}
```

You can also dispatch actions in **parallel** and wait for them to finish:

```tsx
class BuyAndSell extends Action {

  async reduce() {  
    
    // Dispatch and wait for both actions to finish
    await this.dispatchAndWaitAll([
      new BuyAction('IBM'), 
      new SellAction('TSLA')
    ]);        

    return (state) => state.copy({ 
      message: `New cash balance is ${this.state.cash}` 
    });
  }
}
```

You can also use `waitCondition` to wait until the `state` changes in a certain way:

```tsx
class SellStockForPrice extends Action {
  constructor(public stock: string, public price: number) { super(); }

  async reduce() {
  
    // Wait until the stock price is higher than the limit price
    await this.waitCondition(
      (state) => state.stocks.getPrice(this.stock) >= this.price
    );
    
    // Only then, post the sell order to the backend
    let amount = await postSellOrder(this.stock);    
    
    return (state) => 
      state.copy(
        stocks: state.stocks.setAmount(this.stock, amount),
      );
  }
}
```

&nbsp;

## Add features to your actions

It's easy to add your own reusable "features" to your actions,
but they come out of the box with some interesting ones:

## NonReentrant

To prevent an action from being dispatched while it's already running,
add the `nonReentrant` property to your action class and set it to `true`.

```tsx
class LoadText extends Action { 
  nonReentrant = true;
   
  reduce() { ... }
}
```

## Retry

If an action fails, to retry it a few times with exponential backoff, 
add the `retry` property to your action class.

```tsx
class LoadText extends Action {   
  retry = {on: true}
         
  reduce() { ... }
}
```

And you can specify the retry policy:

```tsx
class LoadText extends Action {

  retry = {
    initialDelay: 350, // Millisecond delay before the first attempt
    maxRetries: 3,     // Number of retries before giving up
    multiplier: 2,     // Delay increase factor for each retry
    maxDelay: 5000,    // Max millisecond delay between retries
  }
   
  reduce() { ... }
}
```

## Debounce

To limit how often an action occurs in response to rapid inputs, you can add a `debounce` property
to your action class. For example, when a user types in a search bar, debouncing ensures that not
every keystroke triggers a server request. Instead, it waits until the user pauses typing before
acting.

```tsx
class SearchText extends Action {
  constructor(public searchTerm: string) { super(); }
  
  debounce = 300 // Milliseconds
   
  async reduce()  {      
    let result = await loadJson('https://example.com/?q=', searchTerm);
    return (state) => state.copy({searchResult: result});
  }   
}
```

## Throttle

To prevent an action from running too frequently, you can add a `throttle` property to your
action class. This means that once the action runs it's considered _fresh_, and it won't run
again for a set period of time, even if you try to dispatch it.
After this period ends, the action is considered _stale_ and is ready to run again.

```tsx
class LoadPrices extends Action {  
  
  throttle = 5000 // Milliseconds
   
  async reduce()  {      
    let result = await loadJson('https://example.com/prices');
    return (state) => state.copy({prices: result});
  } 
}
```

## CheckInternet

Automatically checks if there is an internet connection before running the action.
If there is no internet, the action aborts. Optionally, it can show a dialog to the user
saying something like: "There is no Internet, please verify your connection".

```tsx
class LoadPrices extends Action {  
  
  checkInternet = { dialog: true } 
   
  async reduce() { ... } 
}
```

## OptimisticUpdate

To provide instant feedback on actions that save information to the server, this feature immediately
applies state changes as if they were already successful, before confirming with the server.
If the server update fails, the change is rolled back and, optionally, a notification can inform
the user of the issue.

```tsx
class SaveName extends Action {  
  
  optimisticUpdate = { ... } 
   
  async reduce() { ... } 
}
```

&nbsp;

## Persist the state

You can add a `persistor` to save the state to the local device disk.
It supports serializing JavaScript objects **and** ES6 classes out of the box.

```tsx
const store = createStore<State>({  
  persistor: new Persistor(),
});  
```

&nbsp;

## Testing your app is easy

Just dispatch actions and wait for them to finish.
Then, verify the new state or check if some error was thrown.

```tsx
class State {
  constructor(
    public items: string[], 
    public selectedItem: number
  ) {}
}

test('Selecting an item', async () => {

  const store = createStore<State>({      
    initialState: new State(['A', 'B', 'C'], -1);    
  });
  
  // Should select item 2
  await store.dispatchAndWait(new SelectItem(2));
  expect(store.state.selectedItem).toBe('B');
  
  // Fail to select item 42
  let status = await store.dispatchAndWait(new SelectItem(42));    
  expect(status.originalError).toBeInstanceOf(UserException);          
});
```

&nbsp;

## Advanced setup

If you are the Team Lead, you set up the app's infrastructure in a central place,
and allow your developers to concentrate solely on the business logic.

You can add a `stateObserver` to collect app metrics, an `errorObserver` to log errors,
an `actionObserver` to print information to the console during development,
and a `globalWrapError` to catch all errors.

```tsx
const store = createStore<string>({    
  stateObserver: (action, prevState, newState, error, count) => { ... },
  errorObserver: (error, action, store) => { ... }
  actionObserver: (action, count, ini) => { ... }
  globalWrapError: (error) => { ... }
});  
```

For example, here we handle `FirestoreError` errors thrown by Firebase.
We convert them into `UserException` errors, which are built-in types that
automatically show a message to the user in an error dialog:

```tsx
globalWrapError: (error: any) => {
   return (error instanceof FirestoreError)
      ? UserException('Error connecting to Firebase')
      : error;
   }  
```

&nbsp;

## Advanced action configuration

The Team Lead may create a base action class that all actions will extend, and add some common
functionality to it. For example, add getter shortcuts to important parts of the state,
and selectors to help find information.

```tsx
class State {  
  items: Item[];    
  selectedItem: number;
}

export abstract class Action extends ReduxAction<State> {

  // Getter shortcuts   
  get items() { return this.state.items; }
  get selectedItem() { return this.state.selectedItem; }
  
  // Selectors 
  findById(id) { return this.items.find((item) => item.id === id); }
  get selectedIndex() { return this.items.indexOf(this.selectedItem); }
  searchByText(text) { return this.items.find((item) => item.text.includes(text)); }
}
```

Now, all actions can use them to access the state in their reducers:

```tsx
class SelectItem extends Action {
  constructor(public id: number) { super(); }

  reduce() {
    let item = this.findById(this.id);
    if (item === undefined) throw new Error('Item not found');
    return this.state.copy({selectedItem: item});
  }
}
```

---

&nbsp;

_To learn more, the complete Async Redux documentation is published
at **[https://asyncredux.com](https://asyncredux.com)**_
