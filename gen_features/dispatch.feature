Feature: Dispatch

  Scenario: Waiting for a dispatch to end.
    Given A SYNC or ASYNC action.
    When The action is dispatched with `dispatch(action)`.
    Then The SYNC action changes the state synchronously.
    And The ASYNC action changes the state asynchronously.

  Scenario: Knowing when some action dispatched with `dispatch` is being processed.
    Given A SYNC or ASYNC action.
    When The action is dispatched.
    Then We can check if the action is processing with `Store.isWaiting(action)`.
