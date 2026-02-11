module grid_vault::grid_vault {
    use sui::balance;
    use sui::coin;
    use sui::coin::Coin;
    use sui::event;

    /// Vault is intended to be **shared** on-chain so the bot can operate independently.
    ///
    /// MVP rule: funds must never leave the Vault via bot-controlled code paths.
    public struct Vault<phantom A, phantom B> has key, store {
        id: UID,
        balance_a: balance::Balance<A>,
        balance_b: balance::Balance<B>,
        paused: bool,
        risk: RiskParams,
    } 

    /// Owner-only capability.
    public struct OwnerCap has key, store {
        id: UID,
        vault_id: ID,
    }

    /// Trader-only capability (held by the bot).
    public struct TraderCap has key, store {
        id: UID,
        vault_id: ID,
    }

    /// Risk parameters placeholder.
    ///
    /// MVP: not enforced yet, but reserved for later hardening.
    public struct RiskParams has store, drop, copy {
        max_in_per_trade: u64,
        cooldown_ms: u64,
    }

    public struct VaultCreatedEvent has copy, drop, store {
        vault_id: ID,
        owner: address,
    }

    public struct DepositEvent has copy, drop, store {
        vault_id: ID,
        /// 0 = A, 1 = B
        side: u8,
        amount: u64,
    }

    public struct WithdrawEvent has copy, drop, store {
        vault_id: ID,
        /// 0 = A, 1 = B
        side: u8,
        amount: u64,
    }

    public struct TradeEvent has copy, drop, store {
        vault_id: ID,
        /// 0 = A->B, 1 = B->A
        side: u8,
        amount_in: u64,
        amount_out: u64,
    }

    public struct PausedEvent has copy, drop, store {
        vault_id: ID,
        paused: bool,
    }

    /// Risk params updated event
    public struct RiskParamsUpdatedEvent has copy, drop, store {
        vault_id: ID,
        max_in_per_trade: u64,
        cooldown_ms: u64,
    }
    const EWrongCap: u64 = 0;
    const EPaused: u64 = 1;
    const ENotImplemented: u64 = 2;
    const EZeroAmount: u64 = 3;
    const EInsufficientBalance: u64 = 4;

    fun new_risk_params(): RiskParams {
        RiskParams { max_in_per_trade: 0, cooldown_ms: 0 }
    }

    fun assert_owner_cap<A, B>(vault: &Vault<A, B>, cap: &OwnerCap) {
        if (cap.vault_id != object::id(vault)) abort EWrongCap;
    }

    fun assert_trader_cap<A, B>(vault: &Vault<A, B>, cap: &TraderCap) {
        if (cap.vault_id != object::id(vault)) abort EWrongCap;
    }

    fun assert_not_paused<A, B>(vault: &Vault<A, B>) {
        if (vault.paused) abort EPaused;
    }

    fun assert_non_zero_amount(amount: u64) {
        if (amount == 0) abort EZeroAmount;
    }

    fun assert_has_sufficient_balance<A>(balance: &balance::Balance<A>, amount: u64) {
        if (balance::value(balance) < amount) abort EInsufficientBalance;
    }

    /// Public helper for tests and for composing more complex trade entrypoints.
    public fun assert_can_trade<A, B>(vault: &Vault<A, B>, trader_cap: &TraderCap) {
        assert_trader_cap(vault, trader_cap);
        assert_not_paused(vault);
    }

    fun create_internal<A, B>(ctx: &mut TxContext): (OwnerCap, TraderCap, Vault<A, B>) {
        let vault = Vault {
            id: object::new(ctx),
            balance_a: balance::zero<A>(),
            balance_b: balance::zero<B>(),
            paused: false,
            risk: new_risk_params(),
        };

        let vault_id = object::id(&vault);
        let owner_cap = OwnerCap { id: object::new(ctx), vault_id };
        let trader_cap = TraderCap { id: object::new(ctx), vault_id };

        event::emit(VaultCreatedEvent {
            vault_id,
            owner: tx_context::sender(ctx),
        });

        (owner_cap, trader_cap, vault)
    }

    /// Creates a Vault and shares it. Returns both caps and the `vault_id`.
    public fun create_and_share<A, B>(ctx: &mut TxContext): (OwnerCap, TraderCap, ID) {
        let (owner_cap, trader_cap, vault) = create_internal<A, B>(ctx);
        let vault_id = object::id(&vault);
        transfer::share_object(vault);
        (owner_cap, trader_cap, vault_id)
    }

    /// Test-only helper that keeps the Vault owned (not shared) for unit tests.
    #[test_only]
    public fun create_for_testing<A, B>(ctx: &mut TxContext): (OwnerCap, TraderCap, Vault<A, B>) {
        create_internal<A, B>(ctx)
    }

    public fun vault_id<A, B>(vault: &Vault<A, B>): ID {
        object::id(vault)
    }

    public fun owner_cap_vault_id(cap: &OwnerCap): ID {
        cap.vault_id
    }

    public fun trader_cap_vault_id(cap: &TraderCap): ID {
        cap.vault_id
    }

    public fun balance_a<A, B>(vault: &Vault<A, B>): u64 {
        balance::value(&vault.balance_a)
    }

    public fun balance_b<A, B>(vault: &Vault<A, B>): u64 {
        balance::value(&vault.balance_b)
    }

    public fun is_paused<A, B>(vault: &Vault<A, B>): bool {
        vault.paused
    }

    public fun get_risk_params<A, B>(vault: &Vault<A, B>): RiskParams {
        vault.risk
    }

    /// Set paused state. Only owner can call.
    public fun set_paused<A, B>(vault: &mut Vault<A, B>, owner_cap: &OwnerCap, paused: bool) {
        assert_owner_cap(vault, owner_cap);
        vault.paused = paused;
        event::emit(PausedEvent {
            vault_id: object::id(vault),
            paused,
        });
    }

    /// Update risk params. Only owner can call.
    public fun set_risk_params<A, B>(
        vault: &mut Vault<A, B>,
        owner_cap: &OwnerCap,
        max_in_per_trade: u64,
        cooldown_ms: u64,
    ) {
        assert_owner_cap(vault, owner_cap);
        vault.risk = RiskParams { max_in_per_trade, cooldown_ms };
        event::emit(RiskParamsUpdatedEvent {
            vault_id: object::id(vault),
            max_in_per_trade,
            cooldown_ms,
        });
    }

    /// Owner-only deposit of coin A.
    public fun deposit_a<A, B>(vault: &mut Vault<A, B>, owner_cap: &OwnerCap, coin_in: Coin<A>) {
        assert_owner_cap(vault, owner_cap);
        
        let amount = coin::value(&coin_in);
        assert_non_zero_amount(amount);
        balance::join(&mut vault.balance_a, coin::into_balance(coin_in));

        event::emit(DepositEvent {
            vault_id: object::id(vault),
            side: 0,
            amount,
        });
    }

    /// Owner-only deposit of coin B.
    public fun deposit_b<A, B>(vault: &mut Vault<A, B>, owner_cap: &OwnerCap, coin_in: Coin<B>) {
        assert_owner_cap(vault, owner_cap);
        
        let amount = coin::value(&coin_in);
        assert_non_zero_amount(amount);
        balance::join(&mut vault.balance_b, coin::into_balance(coin_in));

        event::emit(DepositEvent {
            vault_id: object::id(vault),
            side: 1,
            amount,
        });
    }

    /// Owner-only withdraw of coin A.
    public fun withdraw_a<A, B>(
        vault: &mut Vault<A, B>,
        owner_cap: &OwnerCap,
        amount: u64,
        ctx: &mut TxContext,
    ): Coin<A> {
        assert_owner_cap(vault, owner_cap);
        assert_non_zero_amount(amount);
        assert_has_sufficient_balance(&vault.balance_a, amount);

        let balance_out = balance::split(&mut vault.balance_a, amount);
        let coin_out = coin::from_balance(balance_out, ctx);

        event::emit(WithdrawEvent {
            vault_id: object::id(vault),
            side: 0,
            amount,
        });

        coin_out
    }

    /// Owner-only withdraw of coin B.
    public fun withdraw_b<A, B>(
        vault: &mut Vault<A, B>,
        owner_cap: &OwnerCap,
        amount: u64,
        ctx: &mut TxContext,
    ): Coin<B> {
        assert_owner_cap(vault, owner_cap);
        assert_non_zero_amount(amount);
        assert_has_sufficient_balance(&vault.balance_b, amount);

        let balance_out = balance::split(&mut vault.balance_b, amount);
        let coin_out = coin::from_balance(balance_out, ctx);

        event::emit(WithdrawEvent {
            vault_id: object::id(vault),
            side: 1,
            amount,
        });

        coin_out
    }

    /// Trader-only swap stub.
    ///
    /// MVP: the real Cetus Aggregator integration will be implemented later.
    /// This function exists so we can TDD access control and pause behavior.
    public fun vault_swap_a_to_b<A, B>(
        vault: &mut Vault<A, B>,
        trader_cap: &TraderCap,
        amount_in: u64,
        _min_out: u64,
        _route: vector<u8>,
    ): u64 {
        assert_can_trade(vault, trader_cap);
        assert_non_zero_amount(amount_in);
        assert_has_sufficient_balance(&vault.balance_a, amount_in);
        
        // TODO: Implement actual swap with Cetus Aggregator
        // For now, emit event to track attempted trades
        event::emit(TradeEvent {
            vault_id: object::id(vault),
            side: 0,
            amount_in,
            amount_out: 0,
        });
        
        abort ENotImplemented
    }

    public fun vault_swap_b_to_a<A, B>(
        vault: &mut Vault<A, B>,
        trader_cap: &TraderCap,
        amount_in: u64,
        _min_out: u64,
        _route: vector<u8>,
    ): u64 {
        assert_can_trade(vault, trader_cap);
        assert_non_zero_amount(amount_in);
        assert_has_sufficient_balance(&vault.balance_b, amount_in);
        
        // TODO: Implement actual swap with Cetus Aggregator
        event::emit(TradeEvent {
            vault_id: object::id(vault),
            side: 1,
            amount_in,
            amount_out: 0,
        });
        
        abort ENotImplemented
    }
}
