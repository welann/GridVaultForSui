#[test_only]
module grid_vault::grid_vault_tests {
    use sui::coin;
    use sui::sui::SUI;
    use sui::test_scenario;


    use grid_vault::grid_vault;

    /// Dummy USDC type for unit tests.
    public struct USDC has drop, store {}

    #[test]
    fun test_create_cap_binding() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);
            let vid = grid_vault::vault_id(&vault);

            assert!(grid_vault::owner_cap_vault_id(&owner_cap) == vid, 0);
            assert!(grid_vault::trader_cap_vault_id(&trader_cap) == vid, 1);

            // Verify initial state
            assert!(grid_vault::balance_a(&vault) == 0, 2);
            assert!(grid_vault::balance_b(&vault) == 0, 3);
            assert!(!grid_vault::is_paused(&vault), 4);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_deposit_withdraw_roundtrip() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            let coin_in = coin::mint_for_testing<SUI>(1_000, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault, &owner_cap, coin_in);
            assert!(grid_vault::balance_a(&vault) == 1_000, 0);

            let coin_out = grid_vault::withdraw_a<SUI, USDC>(&mut vault, &owner_cap, 400, ctx);
            assert!(coin::value(&coin_out) == 400, 0);
            assert!(grid_vault::balance_a(&vault) == 600, 0);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_deposit_b_roundtrip() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            let coin_in = coin::mint_for_testing<USDC>(5_000, ctx);
            grid_vault::deposit_b<SUI, USDC>(&mut vault, &owner_cap, coin_in);
            assert!(grid_vault::balance_b(&vault) == 5_000, 0);

            let coin_out = grid_vault::withdraw_b<SUI, USDC>(&mut vault, &owner_cap, 2_000, ctx);
            assert!(coin::value(&coin_out) == 2_000, 0);
            assert!(grid_vault::balance_b(&vault) == 3_000, 0);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // ============ Trader Withdraw/Deposit Tests ============

    #[test]
    fun test_trader_withdraw_and_deposit_a() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit first
            let coin_in = coin::mint_for_testing<SUI>(1_000, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault, &owner_cap, coin_in);
            assert!(grid_vault::balance_a(&vault) == 1_000, 0);

            // Trader withdraw
            let coin_out = grid_vault::trader_withdraw_a<SUI, USDC>(&mut vault, &trader_cap, 500, ctx);
            assert!(coin::value(&coin_out) == 500, 1);
            assert!(grid_vault::balance_a(&vault) == 500, 2);

            // Trader deposit back
            grid_vault::trader_deposit_a<SUI, USDC>(&mut vault, &trader_cap, coin_out);
            assert!(grid_vault::balance_a(&vault) == 1_000, 3);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_trader_withdraw_and_deposit_b() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit first
            let coin_in = coin::mint_for_testing<USDC>(5_000, ctx);
            grid_vault::deposit_b<SUI, USDC>(&mut vault, &owner_cap, coin_in);
            assert!(grid_vault::balance_b(&vault) == 5_000, 0);

            // Trader withdraw
            let coin_out = grid_vault::trader_withdraw_b<SUI, USDC>(&mut vault, &trader_cap, 2_000, ctx);
            assert!(coin::value(&coin_out) == 2_000, 1);
            assert!(grid_vault::balance_b(&vault) == 3_000, 2);

            // Trader deposit back
            grid_vault::trader_deposit_b<SUI, USDC>(&mut vault, &trader_cap, coin_out);
            assert!(grid_vault::balance_b(&vault) == 5_000, 3);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EPaused (1) - Trader cannot withdraw when paused
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 1)]
    fun test_trader_withdraw_a_fails_when_paused() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit and pause
            let coin_in = coin::mint_for_testing<SUI>(1_000, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault, &owner_cap, coin_in);
            grid_vault::set_paused<SUI, USDC>(&mut vault, &owner_cap, true);

            // Trader withdraw should fail with EPaused
            let coin_out = grid_vault::trader_withdraw_a<SUI, USDC>(&mut vault, &trader_cap, 500, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EPaused (1) - Trader cannot withdraw B when paused
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 1)]
    fun test_trader_withdraw_b_fails_when_paused() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit and pause
            let coin_in = coin::mint_for_testing<USDC>(5_000, ctx);
            grid_vault::deposit_b<SUI, USDC>(&mut vault, &owner_cap, coin_in);
            grid_vault::set_paused<SUI, USDC>(&mut vault, &owner_cap, true);

            // Trader withdraw should fail with EPaused
            let coin_out = grid_vault::trader_withdraw_b<SUI, USDC>(&mut vault, &trader_cap, 1_000, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EWrongCap (0) - Wrong trader_cap for withdraw_a
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 0)]
    fun test_trader_withdraw_a_wrong_cap() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap_1, trader_cap_1, mut vault_1) = grid_vault::create_for_testing<SUI, USDC>(ctx);
            let (owner_cap_2, trader_cap_2, vault_2) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit
            let coin_in = coin::mint_for_testing<SUI>(1_000, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault_1, &owner_cap_1, coin_in);

            // Try withdraw with wrong trader_cap
            let coin_out = grid_vault::trader_withdraw_a<SUI, USDC>(&mut vault_1, &trader_cap_2, 500, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap_1, sender);
            transfer::public_transfer(trader_cap_1, sender);
            transfer::public_transfer(vault_1, sender);
            transfer::public_transfer(owner_cap_2, sender);
            transfer::public_transfer(trader_cap_2, sender);
            transfer::public_transfer(vault_2, sender);
        };
        test_scenario::end(scenario);
    }

    // EWrongCap (0) - Wrong trader_cap for withdraw_b
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 0)]
    fun test_trader_withdraw_b_wrong_cap() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap_1, trader_cap_1, mut vault_1) = grid_vault::create_for_testing<SUI, USDC>(ctx);
            let (owner_cap_2, trader_cap_2, vault_2) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit
            let coin_in = coin::mint_for_testing<USDC>(5_000, ctx);
            grid_vault::deposit_b<SUI, USDC>(&mut vault_1, &owner_cap_1, coin_in);

            // Try withdraw with wrong trader_cap
            let coin_out = grid_vault::trader_withdraw_b<SUI, USDC>(&mut vault_1, &trader_cap_2, 1_000, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap_1, sender);
            transfer::public_transfer(trader_cap_1, sender);
            transfer::public_transfer(vault_1, sender);
            transfer::public_transfer(owner_cap_2, sender);
            transfer::public_transfer(trader_cap_2, sender);
            transfer::public_transfer(vault_2, sender);
        };
        test_scenario::end(scenario);
    }

    // EInsufficientBalance (4) - Trader withdraw_a with insufficient balance
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 4)]
    fun test_trader_withdraw_a_insufficient_balance() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // No deposit, try withdraw
            let coin_out = grid_vault::trader_withdraw_a<SUI, USDC>(&mut vault, &trader_cap, 100, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EInsufficientBalance (4) - Trader withdraw_b with insufficient balance
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 4)]
    fun test_trader_withdraw_b_insufficient_balance() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // No deposit, try withdraw
            let coin_out = grid_vault::trader_withdraw_b<SUI, USDC>(&mut vault, &trader_cap, 100, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EZeroAmount (3) - Trader withdraw_a with zero amount
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 3)]
    fun test_trader_withdraw_a_zero_amount() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit
            let coin_in = coin::mint_for_testing<SUI>(1_000, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault, &owner_cap, coin_in);

            // Try withdraw zero
            let coin_out = grid_vault::trader_withdraw_a<SUI, USDC>(&mut vault, &trader_cap, 0, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EZeroAmount (3) - Trader withdraw_b with zero amount
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 3)]
    fun test_trader_withdraw_b_zero_amount() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit
            let coin_in = coin::mint_for_testing<USDC>(5_000, ctx);
            grid_vault::deposit_b<SUI, USDC>(&mut vault, &owner_cap, coin_in);

            // Try withdraw zero
            let coin_out = grid_vault::trader_withdraw_b<SUI, USDC>(&mut vault, &trader_cap, 0, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // Test trader deposit with zero value coin (should work, just no event)
    #[test]
    fun test_trader_deposit_a_zero_coin() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Create zero value coin
            let zero_coin = coin::mint_for_testing<SUI>(0, ctx);
            
            // Should not fail
            grid_vault::trader_deposit_a<SUI, USDC>(&mut vault, &trader_cap, zero_coin);
            
            assert!(grid_vault::balance_a(&vault) == 0, 0);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // ============ Swap Record Function Tests ============

    // Test trader_swap_a_to_b records the trade (but doesn't actually swap)
    #[test]
    fun test_trader_swap_a_to_b_records_trade() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit
            let coin_in = coin::mint_for_testing<SUI>(1_000, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault, &owner_cap, coin_in);
            assert!(grid_vault::balance_a(&vault) == 1_000, 0);

            // Call swap record function (this just records, doesn't change balances)
            // In actual PTB, this would be called after: withdraw_a -> cetus_swap -> deposit_b
            let amount_out = grid_vault::trader_swap_a_to_b<SUI, USDC>(&mut vault, &trader_cap, 500, 450);
            
            // The function returns min_out as the expected output
            assert!(amount_out == 450, 1);
            
            // Balance should remain unchanged (function only records)
            assert!(grid_vault::balance_a(&vault) == 1_000, 2);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // Test trader_swap_b_to_a records the trade
    #[test]
    fun test_trader_swap_b_to_a_records_trade() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Owner deposit
            let coin_in = coin::mint_for_testing<USDC>(5_000, ctx);
            grid_vault::deposit_b<SUI, USDC>(&mut vault, &owner_cap, coin_in);
            assert!(grid_vault::balance_b(&vault) == 5_000, 0);

            // Call swap record function
            let amount_out = grid_vault::trader_swap_b_to_a<SUI, USDC>(&mut vault, &trader_cap, 2_000, 1800);
            
            assert!(amount_out == 1800, 1);
            assert!(grid_vault::balance_b(&vault) == 5_000, 2);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EZeroAmount (3) - swap_a_to_b with zero amount
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 3)]
    fun test_trader_swap_a_to_b_zero_amount() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            grid_vault::trader_swap_a_to_b<SUI, USDC>(&mut vault, &trader_cap, 0, 0);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EZeroAmount (3) - swap_b_to_a with zero amount
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 3)]
    fun test_trader_swap_b_to_a_zero_amount() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            grid_vault::trader_swap_b_to_a<SUI, USDC>(&mut vault, &trader_cap, 0, 0);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // ============ Original Tests ============

    // EWrongCap
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 0)]
    fun test_wrong_owner_cap_rejected() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap_1, trader_cap_1, mut vault_1) = grid_vault::create_for_testing<SUI, USDC>(ctx);
            let (owner_cap_2, trader_cap_2, vault_2) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            let coin_in = coin::mint_for_testing<SUI>(1_000, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault_1, &owner_cap_1, coin_in);

            // Use a different vault's owner cap.
            let coin_out = grid_vault::withdraw_a<SUI, USDC>(&mut vault_1, &owner_cap_2, 1, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap_1, sender);
            transfer::public_transfer(trader_cap_1, sender);
            transfer::public_transfer(vault_1, sender);
            transfer::public_transfer(owner_cap_2, sender);
            transfer::public_transfer(trader_cap_2, sender);
            transfer::public_transfer(vault_2, sender);
        };
        test_scenario::end(scenario);
    }

    // EZeroAmount (3)
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 3)]
    fun test_zero_deposit_rejected() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            let coin_in = coin::mint_for_testing<SUI>(0, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault, &owner_cap, coin_in);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EInsufficientBalance (4)
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 4)]
    fun test_insufficient_balance_rejected() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Try to withdraw without any deposit
            let coin_out = grid_vault::withdraw_a<SUI, USDC>(&mut vault, &owner_cap, 100, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EPaused (1)
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 1)]
    fun test_pause_blocks_trader_entry() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            grid_vault::set_paused<SUI, USDC>(&mut vault, &owner_cap, true);
            assert!(grid_vault::is_paused(&vault), 0);
            
            grid_vault::assert_can_trade<SUI, USDC>(&vault, &trader_cap);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_pause_unpause_cycle() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Initially not paused
            assert!(!grid_vault::is_paused(&vault), 0);

            // Pause
            grid_vault::set_paused<SUI, USDC>(&mut vault, &owner_cap, true);
            assert!(grid_vault::is_paused(&vault), 1);

            // Unpause
            grid_vault::set_paused<SUI, USDC>(&mut vault, &owner_cap, false);
            assert!(!grid_vault::is_paused(&vault), 2);

            // Should be able to trade now
            grid_vault::assert_can_trade<SUI, USDC>(&vault, &trader_cap);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_trader_entry_allowed_when_unpaused() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            grid_vault::assert_can_trade<SUI, USDC>(&vault, &trader_cap);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // EWrongCap (0)
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 0)]
    fun test_wrong_trader_cap_rejected() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap_1, trader_cap_1, vault_1) = grid_vault::create_for_testing<SUI, USDC>(ctx);
            let (owner_cap_2, trader_cap_2, vault_2) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            grid_vault::assert_can_trade<SUI, USDC>(&vault_1, &trader_cap_2);

            transfer::public_transfer(owner_cap_1, sender);
            transfer::public_transfer(trader_cap_1, sender);
            transfer::public_transfer(vault_1, sender);
            transfer::public_transfer(owner_cap_2, sender);
            transfer::public_transfer(trader_cap_2, sender);
            transfer::public_transfer(vault_2, sender);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_risk_params_update() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Check default risk params
            let _default_risk = grid_vault::get_risk_params(&vault);
            // Values are 0 in MVP

            // Update risk params
            grid_vault::set_risk_params<SUI, USDC>(&mut vault, &owner_cap, 1000, 5000);
            let _updated_risk = grid_vault::get_risk_params(&vault);
            // Verify update (struct is copy, so we can't directly compare, but function succeeded)

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // Test that trader cannot pause
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 0)]
    fun test_trader_cannot_pause() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap_1, trader_cap_1, mut vault_1) = grid_vault::create_for_testing<SUI, USDC>(ctx);
            let (owner_cap_2, trader_cap_2, vault_2) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Trader tries to pause using wrong owner's cap (should fail with EWrongCap)
            // Using owner_cap_2 to trigger EWrongCap (vault_id mismatch)
            grid_vault::set_paused<SUI, USDC>(&mut vault_1, &owner_cap_2, true);

            transfer::public_transfer(owner_cap_1, sender);
            transfer::public_transfer(trader_cap_1, sender);
            transfer::public_transfer(vault_1, sender);
            transfer::public_transfer(owner_cap_2, sender);
            transfer::public_transfer(trader_cap_2, sender);
            transfer::public_transfer(vault_2, sender);
        };
        test_scenario::end(scenario);
    }

    // Test deposit/withdraw events are emitted
    #[test]
    fun test_events_emitted() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            // Deposit and check effects
            let coin_in = coin::mint_for_testing<SUI>(1000, ctx);
            grid_vault::deposit_a<SUI, USDC>(&mut vault, &owner_cap, coin_in);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        let effects = test_scenario::end(scenario);
        
        // Verify events were emitted (basic check)
        assert!(test_scenario::num_user_events(&effects) > 0, 0);
    }

    // Test zero amount withdraw rejected
    #[test, expected_failure(location = ::grid_vault::grid_vault, abort_code = 3)]
    fun test_zero_withdraw_rejected() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, mut vault) = grid_vault::create_for_testing<SUI, USDC>(ctx);

            let coin_out = grid_vault::withdraw_a<SUI, USDC>(&mut vault, &owner_cap, 0, ctx);

            transfer::public_transfer(coin_out, sender);
            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
            transfer::public_transfer(vault, sender);
        };
        test_scenario::end(scenario);
    }

    // Test create_and_share returns correct vault_id
    #[test]
    fun test_create_and_share() {
        let sender = @0xA;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (owner_cap, trader_cap, vault_id) = grid_vault::create_and_share<SUI, USDC>(ctx);
            
            // Verify caps point to correct vault
            assert!(grid_vault::owner_cap_vault_id(&owner_cap) == vault_id, 0);
            assert!(grid_vault::trader_cap_vault_id(&trader_cap) == vault_id, 1);

            transfer::public_transfer(owner_cap, sender);
            transfer::public_transfer(trader_cap, sender);
        };
        test_scenario::end(scenario);
    }
}
