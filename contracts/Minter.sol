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
  using SafeMath for uint256;
  // TODO: Do encapsulation private internal functions on get

  bool private initialized;
  address private _phmAddress;

  // stores the collateral address
  address private _collateralAddress;

  uint256 internal constant phpDaiStubExchangeRate = 50;

  // model for the collateral balance per address
  struct CollateralBalance {
    address collateralAddress;
    mapping(address => uint256) collateralBalance;
  }

  // stores the diff collateral types that can mint synthetics
  address[] private collateralAddresses;

  // stores the user deposits per collateral address
  // TODO: Check support for multiple collateral addresses
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

  constructor(address phmAddress) public {
    _phmAddress = phmAddress;
  }

  function initialize() public nonReentrant() {
    initialized = true;
  }

  function depositByCollateralAddress(
    uint256 _collateralAmount,
    address _collateralAddress
  ) public isInitialized() nonReentrant() {
    // Check if collateral amount is greater than 0
    require(_collateralAmount > 0, 'Invalid Collateral');

    // Check if collateral is whitelisted
    require(
      isWhitelisted(_collateralAddress) == true,
      'This is not allowed as collateral.'
    );
    // TODO: Check if there is collateral balance already, else add a new collateral entry

    IERC20 token = ExpandedIERC20(_collateralAddress);
    SyntheticToken phmToken = SyntheticToken(_phmAddress);

    // Check if user has enough balance
    require(token.balanceOf(msg.sender) > 0, 'Not enough collateral amount');

    token.safeTransferFrom(msg.sender, address(this), _collateralAmount);

    // Emit successful deposit event
    emit DepositedCollateral(msg.sender, _collateralAmount, _collateralAddress);

    // Check current contract if enough balance
    require(
      getTotalCollateralByCollateralAddress(_collateralAddress) > 0,
      'Not enough collateral in contract'
    );

    // Check current contract is a minter of the synthetic token
    // require(
    //   phmToken.isMinter(address(this)) == true,
    //   'This contract is not a minter of the synthetic token'
    // );

    // 6 - Calculate conversion rate + fees, make a price identifier @ 50 pesos (Might be UMA part)

    uint256 mintedTokens = _collateralAmount.div(phpDaiStubExchangeRate);

    // TODO: replace with UMA implementation
    phmToken.mint(msg.sender, mintedTokens);

    // emit Mint event
    emit Mint(msg.sender, mintedTokens);
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
    return token.balanceOf(_collateralAddress);
  }

  /**
   * Returns total user collateral in the contract
   */
  function getUserCollateralByUserAddressCollateralAddress(
    address _user,
    address _collateralAddress
  ) public view returns (uint256) {
    uint256 i;

    //  for (i = 0; i < collateralBalances[msg.sender].length; i++) {
    //    if (
    //      _collateralAddress ==
    //      collateralBalances[msg.sender][i].collateralAddress
    //    ) {
    //      return collateralBalances[msg.sender][i].balance;
    //    }
    //  }

    return collateralBalances[msg.sender][_collateralAddress];
  }

  function getConversionRate(address _collateralAddress)
    public
    view
    returns (uint256)
  {
    // TODO: conversion rate per collateral address
    return phpDaiStubExchangeRate;
  }

  function addCollateralAddress(address collateralAddress)
    public
    isInitialized()
    nonReentrant()
  {
    if (isWhitelisted(collateralAddress) == false) {
      collateralAddresses.push(collateralAddress);
    }
  }

  function removeCollateralAddress(address collateralAddress)
    public
    isInitialized()
    nonReentrant()
  {
    uint256 i;

    for (i = 0; i < collateralAddresses.length; i++) {
      if (collateralAddresses[i] == collateralAddress) {
        delete collateralAddresses[i];
      }
    }
  }

  function isWhitelisted(address _collateralAddress)
    public
    view
    returns (bool)
  {
    uint256 i;

    for (i = 0; i < collateralAddresses.length; i++) {
      if (collateralAddresses[i] == _collateralAddress) {
        return true;
      }
    }

    if (i >= collateralAddresses.length) {
      return false;
    }
  }

  function isCollateralBalanceAdded(address _collateralAddress)
    public
    view
    returns (bool)
  {
    uint256 i;
    for (i = 0; i < collateralBalances[msg.sender].length; i++) {
      if (
        collateralBalances[msg.sender][i].collateralAddress ==
        _collateralAddress
      ) {
        return true;
      }
    }

    // TODO: double check behavior
    return false;
  }

  /****************************************
   *          INTERNAL FUNCTIONS          *
   ****************************************/

  function _isInitialized() internal view {
    require(initialized, 'Uninitialized contract');
  }

  function _addNewCollateralEntry(
    address _collateralAddress,
    uint256 _collateralAmount
  ) internal {
    CollateralBalance memory newCollateral;
    newCollateral.collateralAddress = _collateralAddress;
    newCollateral.balance = _collateralAmount;

    collateralBalances[msg.sender].push(newCollateral);
  }

  function _addCollateralBalances(uint256 value, address _collateralAddress)
    internal
  {
    uint256 i;
    // TODO: make internal function
    uint256 collateralBalance =
      getUserCollateralByUserAddressCollateralAddress(
        msg.sender,
        _collateralAddress
      );
    uint256 newCollateralBalance = collateralBalance.add(value);

    for (i = 0; i < collateralBalances[msg.sender].length; i++) {
      if (
        collateralBalances[msg.sender][i].collateralAddress ==
        _collateralAddress
      ) {
        collateralBalances[msg.sender][i].balance = newCollateralBalance;
      }
    }
  }

  function _removeCollateralBalances(uint256 value, address _collateralAddress)
    internal
  {
    uint256 i;
    // TODO: make internal function
    uint256 collateralBalance =
      getUserCollateralByUserAddressCollateralAddress(
        msg.sender,
        _collateralAddress
      );
    uint256 newCollateralBalance = collateralBalance.sub(value);

    require(newCollateralBalance > 0, 'Not enough collateral to remove');
    for (i = 0; i < collateralBalances[msg.sender].length; i++) {
      if (
        collateralBalances[msg.sender][i].collateralAddress ==
        _collateralAddress
      ) {
        collateralBalances[msg.sender][i].balance = newCollateralBalance;
      }
    }
  }

  function _calculateRewards(
    uint256 entryTimestamp,
    uint256 currentTimestamp,
    uint256 value
  ) internal virtual {}
}
