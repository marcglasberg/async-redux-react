Feature: Action initial state

  Scenario: The action has access to its initial state.
    Given SYNC and ASYNC actions.
    When The "before" and "reduce" and "after" methods are called.
    Then They have access to the store state as it was when the action was dispatched.
    # The action initial state has nothing to do with the store initial state.
