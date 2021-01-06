// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import './SyntheticToken.sol';
import './interfaces/ExpandedIERC20.sol';
import './implementation/Lockable.sol';

contract Minter is Lockable {
  using SafeERC20 for IERC20;

  bool private initialized;

  // TODO: check if needed - stores total collateral
  uint256 private _totalCollateral;

  // stores the collateral address
  address private _collateralAddress;

  // model for the collateral balance per address
  struct CollateralBalance {
    address collateralAddress;
    uint256 balance;
  }

  // stores the diff collateral types that can mint synthetics
  address[] private collateralAddresses;

  // stores the user deposits per collateral address
  mapping(address => CollateralBalance) collateralBalances;

  /****************************************
   *                EVENTS                *
   ****************************************/
  event DepositedCollateral(
    address indexed user,
    uint256 collateral,
    address collateralAddress
  );
  event Mint(address indexed user, uint256 value);
  event RequestWithdrawal(
    address user,
    uint256 collateral,
    address collateralAddresss,
    uint256 requestPassTimeStamp
  );
  event RequestWithdrawalExecuted(
    address user,
    uint256 collateral,
    address collateralAddress,
    uint256 exchangeRate,
    uint256 requestPassTimeStamp
  );
  /****************************************
   *               MODIFIERS              *
   ****************************************/

  modifier isInitialized() {
    _isInitialized();
    _;
  }

  /****************************************
   *           PUBLIC FUNCTIONS           *
   ****************************************/

  constructor() public {}

  function initialize() public nonReentrant() {
    initialized = true;
  }

  function depositByCollateralAddress(
    uint256 _collateralAmount,
    address _collateralAddress
  )
    public
    isInitialized()
    // fees()
    nonReentrant()
  {
    // 1 - check if collateral amount is greater than 0
    require(_collateralAmount > 0, 'Invalid Collateral');

    IERC20 token = ExpandedIERC20(_collateralAddress);

    // Check if user has enough balance
    require(token.balanceOf(msg.sender) > 0, 'Not enough collateral amount');

    token.safeTransferFrom(msg.sender, address(this), _collateralAmount);

    // collateralBalances[msg.sender].collateralAddress = _collateralAddress
    // collateralBalances[msg.sender].balance = _collateralAmount

    // 3 - Emit successful deposit event
    emit DepositedCollateral(msg.sender, _collateralAmount, _collateralAddress);

    // 5 - Check current contract if enough balance
    //require(getTotalCollateral() > 0, 'Not enough collateral in contract');

    // TODO: 6 - Calculate conversion rate + fees, make a price identifier @ 50 pesos

    // TODO: 7 - Call mint function to create tokens based on the collateral
    // TODO: Deploy synthetic token address
    // TODO: 8 - Emit successful minting event
    // emit Mint(msg.sender, mintedTokens)
  }

  /**
   * Returns total collateral in contract
   */
  function getTotalCollateralByCollateralAddress(address _collateralAddress)
    public
    view
    returns (uint256)
  {
    IERC20 token = ExpandedIERC20(_collateralAddress);
    return token.balanceOf(address(this));
  }

  /**
   * Returns total user collateral in the contract
   */
  function getUserCollateralByUserAddressCollateralAddress(
    address _user,
    address _collateralAddress
  ) public view returns (uint256) {
    IERC20 token = ExpandedIERC20(_collateralAddress);
    return token.balanceOf(_user);
  }

  /****************************************
   *          INTERNAL FUNCTIONS          *
   ****************************************/

  function _isInitialized() internal view {
    require(initialized, 'Uninitialized contract');
  }

  function _mintToken(address recipient, uint256 value) internal virtual {}

  function _addCollateralBalances(uint256 value) internal {
    // TODO: use safe math
    collateralBalances[msg.sender].balance =
      collateralBalances[msg.sender].balance +
      value;
  }

  function _removeCollateralBalances(uint256 value) internal {
    // TODO: use safe math
    collateralBalances[msg.sender].balance =
      collateralBalances[msg.sender].balance -
      value;
  }

  function _calculateRewards(
    uint256 entryTimestamp,
    uint256 currentTimestamp,
    uint256 value
  ) internal virtual {}
}
