Feature: Failed action

  Scenario: Checking if a SYNC action has failed.
    Given A SYNC action.
    When The action is dispatched twice with `dispatch(action)`.
    And The action fails the first time, but not the second time.
    Then We can check that the action failed the first time, but not the second.
    And We can get the action exception the first time, but null the second time.
    And We can clear the failing flag.

  Scenario: Checking if an ASYNC action has failed.
    Given An ASYNC action.
    When The action is dispatched twice with `dispatch(action)`.
    And The action fails the first time, but not the second time.
    Then We can check that the action failed the first time, but not the second.
    And We can get the action exception the first time, but null the second time.
    And We can clear the failing flag.
