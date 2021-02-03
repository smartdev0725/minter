// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './uma/common/SyntheticToken.sol';
//import './common/implementation/FixedPoint.sol';
//import './uma/perpetual-multiparty/Perpetual.sol';
import './uma/expiring-multiparty/ExpiringMultiParty.sol';

contract Minter is Lockable {
  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  bool private initialized;
  address private _phmAddress;
  address private _contractCreator;
  address public _perpetualContractAddress;

  // TODO: To be removed after debugging
  address public constant collateralAddressUMA =
    0x25D02115bd67258a406A0F676147E6C3598a91a9;

  // TODO: to be removed upon integrating with DVM
  uint256 internal constant phpDaiStubExchangeRate = 48000000000000000000;

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

  constructor(address phmAddress, address empContractAddress)
    public
    nonReentrant()
  {
    _phmAddress = phmAddress;
    _perpetualContractAddress = empContractAddress;
    _contractCreator = msg.sender;
    //  positionManager = ExpiringMultiParty(empContractAddress);
    // perpetualCreator = PerpetualCreator(_perpetualContractAddress);
  }

  function initialize() public nonReentrant() {
    initialized = true;
  }

  function sendEther() public payable {
    return;
  }

  function approveCollateralSpend(address _collateralAddress, uint256 amount)
    public
    isInitialized()
  {
    // TODO: Add role/admin, check MultiRole.sol
    //require(isAdmin() == true, 'Sender is not allowed to do this action');
    IERC20 token = ExpandedIERC20(_collateralAddress);
    token.approve(_perpetualContractAddress, amount);

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
    token.transferFrom(msg.sender, address(this), _collateralAmount);

    // Update collateral balance deposited in this contract
    _addCollateralBalances(_collateralAmount, _collateralAddress);

    // Emit successful deposit event
    emit DepositedCollateral(msg.sender, _collateralAmount, _collateralAddress);
  }

  function mintFromUMA(
    address _collateralAddress,
    uint256 _collateralAmount,
    uint256 _mintedTokens
  ) public payable {
    // Check if we have enough collateral inside the contract
    // TODO: integrate with the deposit function
    require(
      getTotalCollateralByCollateralAddress(_collateralAddress) > 0,
      'Not enough collateral in contract'
    );

    // Instance of the collateral token
    IERC20 token = ExpandedIERC20(_collateralAddress);

    // Approve perpetual to do safeTransfer from this contract with the collateral amount as limit
    token.approve(_perpetualContractAddress, _collateralAmount);

    // Check if there is enough allowance for transfer
    uint256 allowance =
      token.allowance(address(this), _perpetualContractAddress);
    require(allowance >= _collateralAmount, 'Check the token allowance');

    // Check if right collateral address
    require(
      _collateralAddress == collateralAddressUMA,
      'Check collateral address'
    );

    // Check if parameters are 0
    require(_mintedTokens > 100000000000000, 'Less than minimum tokens');
    require(_collateralAmount > 0, 'No collateral');

    // Create new instance of the EMP
    ExpiringMultiParty emp = ExpiringMultiParty(_perpetualContractAddress);

    // Convert uint256 values from parameters to FixedPoint.Unsigned
    FixedPoint.Unsigned memory collateral =
      FixedPoint.fromUnscaledUint(_collateralAmount);
    FixedPoint.Unsigned memory tokens =
      FixedPoint.fromUnscaledUint(_mintedTokens);

    emp.create(collateral, tokens);

    /*
    //========= Call version ========= //

    bytes memory data =
      abi.encodeWithSignature(
        'create((uint256),(uint256))',
        collateral,
        tokens
      );

    (bool success, bytes memory result) =
      address(_perpetualContractAddress).call(data);

    //require(success == true, 'Low level call failed');

    */

    // TODO: Send back synthetic to user
    // phmToken.approve(address(this), mintedTokens);
    // phmToken.transfer(msg.sender, mintedTokens);

    // emit Mint event
    emit Mint(msg.sender, _mintedTokens);
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

    /* 
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

    */
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
    // Check transformprice
    return phpDaiStubExchangeRate;
  }

  function getFinancialContractAddresss()
    public
    nonReentrant()
    returns (address)
  {
    return _perpetualContractAddress;
  }

  function setFinancialContractAddress(address contractAddress)
    public
    nonReentrant()
  {
    require(
      msg.sender == _contractCreator,
      'You are not the owner of the contract'
    );
    _perpetualContractAddress = contractAddress;
  }

  function addCollateralAddress(address _collateralAddress)
    public
    isInitialized()
    nonReentrant()
  {
    if (isWhitelisted(_collateralAddress) == false) {
      collateralAddresses.push(_collateralAddress);
      IERC20 token = ExpandedIERC20(_collateralAddress);
    }
  }

  function removeCollateralAddress(address _collateralAddress)
    public
    isInitialized()
    nonReentrant()
  {
    uint256 i;

    for (i = 0; i < collateralAddresses.length; i++) {
      if (collateralAddresses[i] == _collateralAddress) {
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

  // Functions for interacting with UMA in this smart contract
  // TODO: Check data types
  function _requestWithdrawal(uint256 denominatedCollateralAmount) internal {
    // TODO: parse to fixed point
    // TODO: send withdrawal requests
  }

  function _executeWithdrawal(uint256 amountWithdrawn) internal {}

  function _cancelWithdrawal() internal {}

  function _calculateRewards(
    uint256 entryTimestamp,
    uint256 currentTimestamp,
    uint256 value
  ) internal {}
}
