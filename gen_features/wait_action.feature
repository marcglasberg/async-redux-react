Feature: Wait action

  Scenario: We dispatch async actions and wait for all to finish.
    Given Three ASYNC actions.
    When The actions are dispatched in PARALLEL.
    And We wait until NO ACTIONS are being dispatched.
    Then After we wait, all actions finished.

  Scenario: We dispatch async actions and wait for some action TYPES to finish.
    Given Four ASYNC actions.
    And The fourth takes longer than an others to finish.
    When The actions are dispatched in PARALLEL.
    And We wait until there the types of the faster 3 finished dispatching.
    Then After we wait, the 3 actions finished, and the fourth did not.

  Scenario: We dispatch an async action and wait for its action TYPE to finish.
    Given An ASYNC actions.
    When The action is dispatched.
    Then We wait until its type finished dispatching.

  Scenario: We dispatch async actions and wait for some of them to finish.
    Given Four ASYNC actions.
    And The fourth takes longer than an others to finish.
    When The actions are dispatched in PARALLEL.
    And We wait until there the faster 3 finished dispatching.
    Then After we wait, the 3 actions finished, and the fourth did not.
