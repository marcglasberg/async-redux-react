Feature: ErrorObserver

  Scenario: ErrorObserver is called when the state changes.
    Given SYNC and ASYNC actions.
    When The actions are dispatched.
    Then The SYNC action starts and finishes at once.
    And The ASYNC action first starts, and then finishes after the async gap.
