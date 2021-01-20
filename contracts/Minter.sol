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
  using SafeERC20 for SyntheticToken;
  using SafeMath for uint256;

  bool private initialized;
  address private _phmAddress;
  address private _contractCreator;

  // stores the collateral address
  address private _collateralAddress;

  uint256 internal constant phpDaiStubExchangeRate = 50;

  // map collateralAddress balance to user
  mapping(address => mapping(address => uint256)) collateralBalances;

  // stores the diff collateral types that can mint synthetics
  address[] private collateralAddresses;

  /****************************************
   *                EVENTS                *
   ****************************************/
  event DepositedCollateral(
    address indexed user,
    uint256 collateral,
    address collateralAddress
  );
  event WithdrawnCollateral(
    address indexed user,
    uint256 collateral,
    address collateralAddress
  );
  event Mint(address indexed user, uint256 value);
  event Burn(address indexed user, uint256 value);
  event ApprovedAllowance(address indexed user, uint256 value);

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

  constructor(address phmAddress) public nonReentrant() {
    _phmAddress = phmAddress;
    _contractCreator = msg.sender;
  }

  function initialize() public nonReentrant() {
    initialized = true;
  }

  function approveCollateralSpend(address _collateralAddress, uint256 amount)
    public
    isInitialized()
  {
    // TODO: Add role/admin, check MultiRole.sol
    //require(isAdmin() == true, 'Sender is not allowed to do this action');
    IERC20 token = ExpandedIERC20(_collateralAddress);
    token.approve(address(this), amount);

    emit ApprovedAllowance(_collateralAddress, amount);
  }

  function depositByCollateralAddress(
    uint256 _collateralAmount,
    address _collateralAddress
  ) public isInitialized() nonReentrant() {
    // Check if collateral amount is greater than 0
    require(_collateralAmount > 0, 'Invalid collateral amount.');

    // Check if collateral is whitelisted
    require(
      isWhitelisted(_collateralAddress) == true,
      'This is not allowed as collateral.'
    );

    // Collateral token
    IERC20 token = ExpandedIERC20(_collateralAddress);
    // PHM token
    SyntheticToken phmToken = SyntheticToken(_phmAddress);

    // Check if user has enough balance
    require(
      token.balanceOf(msg.sender) >= _collateralAmount,
      'Not enough collateral amount'
    );

    // Transfer collateral from user to this contract

    token.safeTransferFrom(msg.sender, address(this), _collateralAmount);

    // Update collateral balance deposited in this contract
    _addCollateralBalances(_collateralAmount, _collateralAddress);

    // Emit successful deposit event
    emit DepositedCollateral(msg.sender, _collateralAmount, _collateralAddress);

    // Check current contract if enough balance
    require(
      getTotalCollateralByCollateralAddress(_collateralAddress) > 0,
      'Not enough collateral in contract'
    );

    // Calculate conversion rate + fees, make a price identifier @ 50 pesos (Might be UMA part)

    uint256 mintedTokens = _collateralAmount.mul(phpDaiStubExchangeRate);

    // TODO: replace with UMA implementation
    // 1 - Send DAI to UMA financial contract
    // 2 - Confirm minting event
    phmToken.mint(msg.sender, mintedTokens);

    // emit Mint event
    emit Mint(msg.sender, mintedTokens);
  }

  function redeemByCollateralAddress(
    uint256 _tokenAmount,
    address _collateralAddress
  ) public payable isInitialized() nonReentrant() {
    // Check if collateral amount is greater than 0
    require(_tokenAmount > 0, 'Invalid token amount.');

    // Check if collateral is whitelisted
    require(
      isWhitelisted(_collateralAddress) == true,
      'This is not allowed as collateral.'
    );
    // Collateral token
    IERC20 token = ExpandedIERC20(_collateralAddress);
    // PHM token
    SyntheticToken phmToken = SyntheticToken(_phmAddress);

    require(
      phmToken.balanceOf(msg.sender) >= _tokenAmount,
      'Not enough PHM balance'
    );

    // TODO: UMA -- burn phm token
    // user transfer PHM to contract for burning
    phmToken.approve(address(this), _tokenAmount);
    // phmToken.safeApprove(msg.sender, _tokenAmou);

    phmToken.safeTransferFrom(msg.sender, address(this), _tokenAmount);

    require(
      phmToken.balanceOf(address(this)) >= _tokenAmount,
      'PHM transfer failed.'
    );

    phmToken.burn(_tokenAmount);

    // Emit the burning/ redemption of PHM
    emit Burn(msg.sender, _tokenAmount);

    // TODO: UMA -- check the conversion Rate
    uint256 redeemedCollateral = _tokenAmount.div(phpDaiStubExchangeRate);

    // TODO: Integrate with UMA  -- Check if redeemedCollateral is less than or equal to total user collateral
    require(
      getUserCollateralByCollateralAddress(_collateralAddress) >=
        redeemedCollateral,
      'Not enough collateral from user'
    );

    require(
      getTotalCollateralByCollateralAddress(_collateralAddress) > 0,
      'No collateral in contract'
    );
    // Remove collateral from record
    _removeCollateralBalances(redeemedCollateral, _collateralAddress);

    // Transfer collateral from Minter contract to msg.sender
    approveCollateralSpend(_collateralAddress, redeemedCollateral);
    token.safeTransfer(msg.sender, redeemedCollateral);

    emit WithdrawnCollateral(
      msg.sender,
      redeemedCollateral,
      _collateralAddress
    );
  }

  /**
   * Returns total collateral in contract
   */
  function getTotalCollateralByCollateralAddress(address _collateralAddress)
    public
    view
    returns (uint256)
  {
    require(
      isWhitelisted(_collateralAddress) == true,
      'Collateral address is not whitelisted.'
    );
    IERC20 token = ExpandedIERC20(_collateralAddress);
    return token.balanceOf(address(this));
  }

  /**
   * Returns total user collateral in the contract
   */
  function getUserCollateralByCollateralAddress(address _collateralAddress)
    public
    view
    returns (uint256)
  {
    require(
      isWhitelisted(_collateralAddress) == true,
      'Collateral address is not whitelisted.'
    );
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
      IERC20 token = ExpandedIERC20(_collateralAddress);
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

  function isAdmin() public view returns (bool) {
    if (msg.sender == _contractCreator) {
      return true;
    } else {
      return false;
    }
  }

  /****************************************
   *          INTERNAL FUNCTIONS          *
   ****************************************/

  function _isInitialized() internal view {
    require(initialized, 'Uninitialized contract');
  }

  function _addCollateralBalances(uint256 value, address _collateralAddress)
    internal
  {
    uint256 collateralBalance =
      collateralBalances[msg.sender][_collateralAddress];
    collateralBalances[msg.sender][_collateralAddress] = collateralBalance.add(
      value
    );
  }

  function _removeCollateralBalances(uint256 value, address _collateralAddress)
    internal
  {
    uint256 collateralBalance =
      collateralBalances[msg.sender][_collateralAddress];
    collateralBalances[msg.sender][_collateralAddress] = collateralBalance.sub(
      value
    );
  }

  function _calculateRewards(
    uint256 entryTimestamp,
    uint256 currentTimestamp,
    uint256 value
  ) internal virtual {}

  // Functions for interacting with UMA in this smart contract
  // TODO: Check data types
  function _requestWithdrawal(uint256 denominatedCollateralAmount) internal {
    // TODO: parse to fixed point
    // TODO: send withdrawal requests
  }

  function _executeWithdrawal(uint256 amountWithdrawn) internal {}

  function _cancelWithdrawal() internal {}

  /****************************************
   *          SECURITY  FUNCTIONS         *
   ****************************************/
}
