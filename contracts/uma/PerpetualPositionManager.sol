// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

//import '../../common/implementation/FixedPoint.sol';

/**
 * @title Financial contract with priceless position management.
 * @notice Handles positions for multiple sponsors in an optimistic (i.e., priceless) way without relying
 * on a price feed. On construction, deploys a new ERC20, managed by this contract, that is the synthetic token.
 */

contract PerpetualPositionManager is FundingRateApplier {
  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  using SafeERC20 for IERC20;
  using SafeERC20 for ExpandedIERC20;

  /****************************************
   *  PRICELESS POSITION DATA STRUCTURES  *
   ****************************************/

  // Represents a single sponsor's position. All collateral is held by this contract.
  // This struct acts as bookkeeping for how much of that collateral is allocated to each sponsor.
  struct PositionData {
    FixedPoint.Unsigned tokensOutstanding;
    // Tracks pending withdrawal requests. A withdrawal request is pending if `withdrawalRequestPassTimestamp != 0`.
    uint256 withdrawalRequestPassTimestamp;
    FixedPoint.Unsigned withdrawalRequestAmount;
    // Raw collateral value. This value should never be accessed directly -- always use _getFeeAdjustedCollateral().
    // To add or remove collateral, use _addCollateral() and _removeCollateral().
    FixedPoint.Unsigned rawCollateral;
  }

  // Maps sponsor addresses to their positions. Each sponsor can have only one position.
  mapping(address => PositionData) public positions;

  // Keep track of the total collateral and tokens across all positions to enable calculating the
  // global collateralization ratio without iterating over all positions.
  FixedPoint.Unsigned public totalTokensOutstanding;

  // Similar to the rawCollateral in PositionData, this value should not be used directly.
  // _getFeeAdjustedCollateral(), _addCollateral() and _removeCollateral() must be used to access and adjust.
  FixedPoint.Unsigned public rawTotalPositionCollateral;

  // Synthetic token created by this contract.
  ExpandedIERC20 public tokenCurrency;

  // Unique identifier for DVM price feed ticker.
  bytes32 public priceIdentifier;

  // Time that has to elapse for a withdrawal request to be considered passed, if no liquidations occur.
  // !!Note: The lower the withdrawal liveness value, the more risk incurred by the contract.
  //       Extremely low liveness values increase the chance that opportunistic invalid withdrawal requests
  //       expire without liquidation, thereby increasing the insolvency risk for the contract as a whole. An insolvent
  //       contract is extremely risky for any sponsor or synthetic token holder for the contract.
  uint256 public withdrawalLiveness;

  // Minimum number of tokens in a sponsor's position.
  FixedPoint.Unsigned public minSponsorTokens;

  // Expiry price pulled from the DVM in the case of an emergency shutdown.
  FixedPoint.Unsigned public emergencyShutdownPrice;

  /****************************************
   *                EVENTS                *
   ****************************************/

  event Deposit(address indexed sponsor, uint256 indexed collateralAmount);
  event Withdrawal(address indexed sponsor, uint256 indexed collateralAmount);
  event RequestWithdrawal(
    address indexed sponsor,
    uint256 indexed collateralAmount
  );
  event RequestWithdrawalExecuted(
    address indexed sponsor,
    uint256 indexed collateralAmount
  );
  event RequestWithdrawalCanceled(
    address indexed sponsor,
    uint256 indexed collateralAmount
  );
  event PositionCreated(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount
  );
  event NewSponsor(address indexed sponsor);
  event EndedSponsorPosition(address indexed sponsor);
  event Redeem(
    address indexed sponsor,
    uint256 indexed collateralAmount,
    uint256 indexed tokenAmount
  );
  event Repay(
    address indexed sponsor,
    uint256 indexed numTokensRepaid,
    uint256 indexed newTokenCount
  );
  event EmergencyShutdown(address indexed caller, uint256 shutdownTimestamp);
  event SettleEmergencyShutdown(
    address indexed caller,
    uint256 indexed collateralReturned,
    uint256 indexed tokensBurned
  );

  /****************************************
   *               MODIFIERS              *
   ****************************************/

  modifier onlyCollateralizedPosition(address sponsor) {
    _onlyCollateralizedPosition(sponsor);
    _;
  }

  modifier noPendingWithdrawal(address sponsor) {
    _positionHasNoPendingWithdrawal(sponsor);
    _;
  }

  /**
   * @notice Construct the PerpetualPositionManager.
   * @dev Deployer of this contract should consider carefully which parties have ability to mint and burn
   * the synthetic tokens referenced by `_tokenAddress`. This contract's security assumes that no external accounts
   * can mint new tokens, which could be used to steal all of this contract's locked collateral.
   * We recommend to only use synthetic token contracts whose sole Owner role (the role capable of adding & removing roles)
   * is assigned to this contract, whose sole Minter role is assigned to this contract, and whose
   * total supply is 0 prior to construction of this contract.
   * @param _withdrawalLiveness liveness delay, in seconds, for pending withdrawals.
   * @param _collateralAddress ERC20 token used as collateral for all positions.
   * @param _tokenAddress ERC20 token used as synthetic token.
   * @param _finderAddress UMA protocol Finder used to discover other protocol contracts.
   * @param _priceIdentifier registered in the DVM for the synthetic.
   * @param _fundingRateIdentifier Unique identifier for DVM price feed ticker for child financial contract.
   * @param _minSponsorTokens minimum amount of collateral that must exist at any time in a position.
   * @param _tokenScaling initial scaling to apply to the token value (i.e. scales the tracking index).
   * @param _timerAddress Contract that stores the current time in a testing environment. Set to 0x0 for production.
   */
  constructor(
    uint256 _withdrawalLiveness,
    address _collateralAddress,
    address _tokenAddress,
    address _finderAddress,
    bytes32 _priceIdentifier,
    bytes32 _fundingRateIdentifier,
    FixedPoint.Unsigned memory _minSponsorTokens,
    address _configStoreAddress,
    FixedPoint.Unsigned memory _tokenScaling,
    address _timerAddress
  )
    public
    FundingRateApplier(
      _fundingRateIdentifier,
      _collateralAddress,
      _finderAddress,
      _configStoreAddress,
      _tokenScaling,
      _timerAddress
    )
  {
    require(_getIdentifierWhitelist().isIdentifierSupported(_priceIdentifier));

    withdrawalLiveness = _withdrawalLiveness;
    tokenCurrency = ExpandedIERC20(_tokenAddress);
    minSponsorTokens = _minSponsorTokens;
    priceIdentifier = _priceIdentifier;
  }

  /****************************************
   *          POSITION FUNCTIONS          *
   ****************************************/

  /**
   * @notice Transfers `collateralAmount` of `collateralCurrency` into the specified sponsor's position.
   * @dev Increases the collateralization level of a position after creation. This contract must be approved to spend
   * at least `collateralAmount` of `collateralCurrency`.
   * @param sponsor the sponsor to credit the deposit to.
   * @param collateralAmount total amount of collateral tokens to be sent to the sponsor's position.
   */
  function depositTo(
    address sponsor,
    FixedPoint.Unsigned memory collateralAmount
  )
    public
    notEmergencyShutdown()
    noPendingWithdrawal(sponsor)
    fees()
    nonReentrant()
  {}

  /**
   * @notice Transfers `collateralAmount` of `collateralCurrency` into the caller's position.
   * @dev Increases the collateralization level of a position after creation. This contract must be approved to spend
   * at least `collateralAmount` of `collateralCurrency`.
   * @param collateralAmount total amount of collateral tokens to be sent to the sponsor's position.
   */
  function deposit(FixedPoint.Unsigned memory collateralAmount) public {
    // This is just a thin wrapper over depositTo that specified the sender as the sponsor.
  }

  /**
   * @notice Transfers `collateralAmount` of `collateralCurrency` from the sponsor's position to the sponsor.
   * @dev Reverts if the withdrawal puts this position's collateralization ratio below the global collateralization
   * ratio. In that case, use `requestWithdrawal`. Might not withdraw the full requested amount to account for precision loss.
   * @param collateralAmount is the amount of collateral to withdraw.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function withdraw(FixedPoint.Unsigned memory collateralAmount)
    public
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
    returns (FixedPoint.Unsigned memory amountWithdrawn)
  {}

  /**
   * @notice Starts a withdrawal request that, if passed, allows the sponsor to withdraw from their position.
   * @dev The request will be pending for `withdrawalLiveness`, during which the position can be liquidated.
   * @param collateralAmount the amount of collateral requested to withdraw
   */
  function requestWithdrawal(FixedPoint.Unsigned memory collateralAmount)
    public
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    nonReentrant()
  {}

  /**
   * @notice After a passed withdrawal request (i.e., by a call to `requestWithdrawal` and waiting
   * `withdrawalLiveness`), withdraws `positionData.withdrawalRequestAmount` of collateral currency.
   * @dev Might not withdraw the full requested amount in order to account for precision loss or if the full requested
   * amount exceeds the collateral in the position (due to paying fees).
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function withdrawPassedRequest()
    external
    notEmergencyShutdown()
    fees()
    nonReentrant()
    returns (FixedPoint.Unsigned memory amountWithdrawn)
  {}

  /**
   * @notice Cancels a pending withdrawal request.
   */
  function cancelWithdrawal() external notEmergencyShutdown() nonReentrant() {}

  /**
   * @notice Creates tokens by creating a new position or by augmenting an existing position. Pulls `collateralAmount
   * ` into the sponsor's position and mints `numTokens` of `tokenCurrency`.
   * @dev This contract must have the Minter role for the `tokenCurrency`.
   * @dev Reverts if minting these tokens would put the position's collateralization ratio below the
   * global collateralization ratio. This contract must be approved to spend at least `collateralAmount` of
   * `collateralCurrency`.
   * @param collateralAmount is the number of collateral tokens to collateralize the position with
   * @param numTokens is the number of tokens to mint from the position.
   */
  function create(
    FixedPoint.Unsigned memory collateralAmount,
    FixedPoint.Unsigned memory numTokens
  ) public notEmergencyShutdown() fees() nonReentrant() {}

  /**
   * @notice Burns `numTokens` of `tokenCurrency` and sends back the proportional amount of `collateralCurrency`.
   * @dev Can only be called by a token sponsor. Might not redeem the full proportional amount of collateral
   * in order to account for precision loss. This contract must be approved to spend at least `numTokens` of
   * `tokenCurrency`.
   * @dev This contract must have the Burner role for the `tokenCurrency`.
   * @param numTokens is the number of tokens to be burnt for a commensurate amount of collateral.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function redeem(FixedPoint.Unsigned memory numTokens)
    public
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
    returns (FixedPoint.Unsigned memory amountWithdrawn)
  {}

  /**
   * @notice Burns `numTokens` of `tokenCurrency` to decrease sponsors position size, without sending back `collateralCurrency`.
   * This is done by a sponsor to increase position CR. Resulting size is bounded by minSponsorTokens.
   * @dev Can only be called by token sponsor. This contract must be approved to spend `numTokens` of `tokenCurrency`.
   * @dev This contract must have the Burner role for the `tokenCurrency`.
   * @param numTokens is the number of tokens to be burnt from the sponsor's debt position.
   */
  function repay(FixedPoint.Unsigned memory numTokens)
    public
    notEmergencyShutdown()
    noPendingWithdrawal(msg.sender)
    fees()
    nonReentrant()
  {}

  /**
   * @notice If the contract is emergency shutdown then all token holders and sponsors can redeem their tokens or
   * remaining collateral for underlying at the prevailing price defined by a DVM vote.
   * @dev This burns all tokens from the caller of `tokenCurrency` and sends back the resolved settlement value of
   * `collateralCurrency`. Might not redeem the full proportional amount of collateral in order to account for
   * precision loss. This contract must be approved to spend `tokenCurrency` at least up to the caller's full balance.
   * @dev This contract must have the Burner role for the `tokenCurrency`.
   * @dev Note that this function does not call the updateFundingRate modifier to update the funding rate as this
   * function is only called after an emergency shutdown & there should be no funding rate updates after the shutdown.
   * @return amountWithdrawn The actual amount of collateral withdrawn.
   */
  function settleEmergencyShutdown()
    external
    isEmergencyShutdown()
    fees()
    nonReentrant()
    returns (FixedPoint.Unsigned memory amountWithdrawn)
  {}

  /****************************************
   *        GLOBAL STATE FUNCTIONS        *
   ****************************************/

  /**
   * @notice Premature contract settlement under emergency circumstances.
   * @dev Only the governor can call this function as they are permissioned within the `FinancialContractAdmin`.
   * Upon emergency shutdown, the contract settlement time is set to the shutdown time. This enables withdrawal
   * to occur via the `settleEmergencyShutdown` function.
   */
  function emergencyShutdown()
    external
    override
    notEmergencyShutdown()
    fees()
    nonReentrant()
  {}

  /**
   * @notice Theoretically supposed to pay fees and move money between margin accounts to make sure they
   * reflect the NAV of the contract. However, this functionality doesn't apply to this contract.
   * @dev This is supposed to be implemented by any contract that inherits `AdministrateeInterface` and callable
   * only by the Governor contract. This method is therefore minimally implemented in this contract and does nothing.
   */
  function remargin() external override {}

  /**
   * @notice Accessor method for a sponsor's collateral.
   * @dev This is necessary because the struct returned by the positions() method shows
   * rawCollateral, which isn't a user-readable value.
   * @dev This method accounts for pending regular fees that have not yet been withdrawn from this contract, for
   * example if the `lastPaymentTime != currentTime`.
   * @param sponsor address whose collateral amount is retrieved.
   * @return collateralAmount amount of collateral within a sponsors position.
   */
  function getCollateral(address sponsor)
    external
    view
    nonReentrantView()
    returns (FixedPoint.Unsigned memory collateralAmount)
  {}

  /**
   * @notice Accessor method for the total collateral stored within the PerpetualPositionManager.
   * @return totalCollateral amount of all collateral within the position manager.
   */
  function totalPositionCollateral()
    external
    view
    nonReentrantView()
    returns (FixedPoint.Unsigned memory totalCollateral)
  {}

  function getFundingRateAppliedTokenDebt(
    FixedPoint.Unsigned memory rawTokenDebt
  )
    external
    view
    nonReentrantView()
    returns (FixedPoint.Unsigned memory totalCollateral)
  {}

  /****************************************
   *          INTERNAL FUNCTIONS          *
   ****************************************/

  // Reduces a sponsor's position and global counters by the specified parameters. Handles deleting the entire
  // position if the entire position is being removed. Does not make any external transfers.
  function _reduceSponsorPosition(
    address sponsor,
    FixedPoint.Unsigned memory tokensToRemove,
    FixedPoint.Unsigned memory collateralToRemove,
    FixedPoint.Unsigned memory withdrawalAmountToRemove
  ) internal {}

  // Deletes a sponsor's position and updates global counters. Does not make any external transfers.
  function _deleteSponsorPosition(address sponsor)
    internal
    returns (FixedPoint.Unsigned memory)
  {}

  function _pfc()
    internal
    view
    virtual
    override
    returns (FixedPoint.Unsigned memory)
  {}

  function _getPositionData(address sponsor)
    internal
    view
    onlyCollateralizedPosition(sponsor)
    returns (PositionData storage)
  {}

  function _getIdentifierWhitelist()
    internal
    view
    returns (IdentifierWhitelistInterface)
  {}

  function _getOracle() internal view returns (OracleInterface) {}

  function _getFinancialContractsAdminAddress()
    internal
    view
    returns (address)
  {}

  // Requests a price for `priceIdentifier` at `requestedTime` from the Oracle.
  function _requestOraclePrice(uint256 requestedTime) internal {}

  // Fetches a resolved Oracle price from the Oracle. Reverts if the Oracle hasn't resolved for this request.
  function _getOraclePrice(uint256 requestedTime)
    internal
    view
    returns (FixedPoint.Unsigned memory price)
  {}

  // Fetches a resolved Oracle price from the Oracle. Reverts if the Oracle hasn't resolved for this request.
  function _getOracleEmergencyShutdownPrice()
    internal
    view
    returns (FixedPoint.Unsigned memory)
  {}

  // Reset withdrawal request by setting the withdrawal request and withdrawal timestamp to 0.
  function _resetWithdrawalRequest(PositionData storage positionData)
    internal
  {}

  // Ensure individual and global consistency when increasing collateral balances. Returns the change to the position.
  function _incrementCollateralBalances(
    PositionData storage positionData,
    FixedPoint.Unsigned memory collateralAmount
  ) internal returns (FixedPoint.Unsigned memory) {}

  // Ensure individual and global consistency when decrementing collateral balances. Returns the change to the
  // position. We elect to return the amount that the global collateral is decreased by, rather than the individual
  // position's collateral, because we need to maintain the invariant that the global collateral is always
  // <= the collateral owned by the contract to avoid reverts on withdrawals. The amount returned = amount withdrawn.
  function _decrementCollateralBalances(
    PositionData storage positionData,
    FixedPoint.Unsigned memory collateralAmount
  ) internal returns (FixedPoint.Unsigned memory) {}

  // Ensure individual and global consistency when decrementing collateral balances. Returns the change to the position.
  // This function is similar to the _decrementCollateralBalances function except this function checks position GCR
  // between the decrements. This ensures that collateral removal will not leave the position undercollateralized.
  function _decrementCollateralBalancesCheckGCR(
    PositionData storage positionData,
    FixedPoint.Unsigned memory collateralAmount
  ) internal returns (FixedPoint.Unsigned memory) {}

  // These internal functions are supposed to act identically to modifiers, but re-used modifiers
  // unnecessarily increase contract bytecode size.
  // source: https://blog.polymath.network/solidity-tips-and-tricks-to-save-gas-and-reduce-bytecode-size-c44580b218e6
  function _onlyCollateralizedPosition(address sponsor) internal view {}

  // Note: This checks whether an already existing position has a pending withdrawal. This cannot be used on the
  // `create` method because it is possible that `create` is called on a new position (i.e. one without any collateral
  // or tokens outstanding) which would fail the `onlyCollateralizedPosition` modifier on `_getPositionData`.
  function _positionHasNoPendingWithdrawal(address sponsor) internal view {}

  /****************************************
   *          PRIVATE FUNCTIONS          *
   ****************************************/

  function _checkPositionCollateralization(PositionData storage positionData)
    private
    view
    returns (bool)
  {}

  // Checks whether the provided `collateral` and `numTokens` have a collateralization ratio above the global
  // collateralization ratio.
  function _checkCollateralization(
    FixedPoint.Unsigned memory collateral,
    FixedPoint.Unsigned memory numTokens
  ) private view returns (bool) {}

  function _getCollateralizationRatio(
    FixedPoint.Unsigned memory collateral,
    FixedPoint.Unsigned memory numTokens
  ) private pure returns (FixedPoint.Unsigned memory ratio) {}

  function _getTokenAddress() internal view override returns (address) {}
}
