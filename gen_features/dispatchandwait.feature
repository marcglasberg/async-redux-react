Feature: DispatchAndWait

  Scenario: Waiting for a dispatchAndWait to end.
    Given A SYNC or ASYNC action.
    When The action is dispatched with `dispatchAndWait(action)`.
    Then It returns a `Promise` that resolves when the action finishes.

  Scenario: Knowing when some action dispatched with `dispatchAndWait` is being processed.
    Given A SYNC or ASYNC action.
    When The action is dispatched.
    Then We can check if the action is processing with `Store.isWaiting(actionType)`.

  Scenario: Reading the ActionStatus of the action.
    Given A SYNC or ASYNC action.
    When The action is dispatched.
    And The action finishes without any errors.
    Then We can check the action status, which says the action completed OK (no errors).

  Scenario: Reading the ActionStatus of the action.
    Given A SYNC or ASYNC action.
    When The action is dispatched.
    And The action fails in the "before" method.
    Then We can check the action status, which says the action completed with errors.

  Scenario: Reading the ActionStatus of the action.
    Given A SYNC or ASYNC action.
    When The action is dispatched.
    And The action fails in the "reduce" method.
    Then We can check the action status, which says the action completed with errors.

  Scenario: Reading the ActionStatus of the action.
    Given A SYNC or ASYNC action.
    When The action is dispatched.
    And The action fails in the "after" method.
    Then We can check the action status, which says the action completed OK (no errors).
    # The "after" method should never fail. If it does, the error will be swallowed.
