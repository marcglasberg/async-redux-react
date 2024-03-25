Feature: Abort reduce of actions

  Scenario: A SYNC action can prevent its own reduce method from changing the state.
    Given A SYNC action that returns true (or false) in its abortReduce method.
    When The action is dispatched.
    Then The reduce method is aborted (or is not aborted, respectively).
    # We only have to test dispatch, because its the same abort code as dispatchSync/dispatchAndWait.

  Scenario: An ASYNC action can prevent its own reduce method from changing the state.
    Given An ASYNC action that returns true (or false) in its abortReduce method.
    And The action is ASYNC because its "before" methos is async, or because its "reduce" method is asnyc.
    When The action is dispatched.
    Then The reduce method is aborted (or is not aborted, respectively).
    # We have to separately test with async "before", async "reduce", and both "before" and "reduce" being async, because they abort in different ways.
