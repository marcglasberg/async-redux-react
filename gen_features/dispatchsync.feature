Feature: DispatchSync

  Scenario: DispatchSync only dispatches SYNC actions.
    Given A SYNC or ASYNC action.
    When The action is dispatched with `dispatchSync(action)`.
    Then It throws a `StoreException` when the action is ASYNC.
    And It fails synchronously.
    # We have to separately test with async "before", async "reduce", and both "before" and "reduce" being async, because they fail in different ways.
