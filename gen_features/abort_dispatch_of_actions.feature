Feature: Abort dispatch of actions

  Scenario: The action can abort its own dispatch.
    Given An action that returns true (or false) in its abortDispatch method.
    When The action is dispatched (with dispatch, or dispatchSync, or dispatchAndWait).
    Then It is aborted (or is not aborted, respectively).
    # We have to test dispatch/dispatchSync/dispatchAndWait separately, because they abort in different ways.

  Scenario: When an action is mocked, its mock decides if it is aborted.
    Given An action that returns true (or false) in its abortDispatch method.
    And The action is mocked with an action that does the opposite.
    When The action is dispatched (with dispatch, or dispatchSync, or dispatchAndWait).
    Then It is not aborted (or is aborted, respectively).
    # It should now abort when its abortDispatch method return false, which is the opposite of the normal behavior.
    # We have to test dispatch/dispatchSync/dispatchAndWait separately, because they abort in different ways.
