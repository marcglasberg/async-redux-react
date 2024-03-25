Feature: Retry action

  Scenario: Action retries a few times and succeeds.
    Given An action that retries up to 10 times.
    And The action fails with a user exception the first 4 times.
    When The action is dispatched.
    Then It does change the state.

  Scenario: Action retries a few times and succeeds.
    Given An action that retries up to 10 times.
    And The action fails with a user exception the first 4 times.
    When The action is dispatched.
    Then It does change the state.

  Scenario: Action retries unlimited tries until it succeeds.
    Given An action marked with "UnlimitedRetries".
    And The action fails with a user exception the first 6 times.
    When The action is dispatched.
    Then It does change the state.
    # Without the "UnlimitedRetries" it would fail because the default is 3 retries.

  Scenario: Action retries a few times and fails.
    Given An action that retries up to 3 times.
    And The action fails with a user exception the first 4 times.
    When The action is dispatched.
    Then It does NOT change the state.

  Scenario: Sync action becomes ASYNC of it retries, even if it succeeds the first time.
    Given A SYNC action that retries up to 10 times.
    When The action is dispatched and succeeds the first time.
    Then It cannot be dispatched SYNC anymore.
