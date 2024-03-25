Feature: Non reentrant actions

  Scenario: Sync action non-reentrant does not call itself.
    Given A SYNC action that calls itself.
    And The action is non-reentrant.
    When The action is dispatched.
    Then It runs once.
    And Does not result in a stack overflow.

  Scenario: Async action non-reentrant does not call itself.
    Given An ASYNC action that calls itself.
    And The action is non-reentrant.
    When The action is dispatched.
    Then It runs once.
    And Does not result in a stack overflow.

  Scenario: Async action non-reentrant does start before an action of the same type finished.
    Given An ASYNC action takes some time to finish.
    And The action is non-reentrant.
    When The action is dispatched.
    And Another action of the same type is dispatched before the previous one finished.
    Then It runs only once.
