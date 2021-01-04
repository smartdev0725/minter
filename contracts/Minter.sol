// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './SyntheticToken.sol';
import './interfaces/ExpandedIERC20.sol';
import './implementation/Lockable.sol';

contract Minter is Lockable {
  bool private initialized;

  // stores total collateral
  uint256 private _totalCollateral;

  // The collateral currency used to back the positions in this contract.
  IERC20 public collateralCurrency;

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
  event DepositedCollateral(address indexed user, uint256 collateral, address collateralAddress);
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

  // TODO: Check extending Expanded ERC20.sol
  constructor() public {}

  function initialize() public nonReentrant() {
    initialized = true;
  }

  function depositByCollateralAddress(uint256 _collateralAmount, address _collateralAddress)
    public
    isInitialized()
    // fees()
    nonReentrant()
  {
    // 1- check if collateral amount is greater than 0
    require(_collateralAmount > 0, 'Invalid collateral amount');

    // check if collateralAddress is part of 'whitelisted' collateral types
    // check if users balance is enough for collateral adddress type (ERC20 balance)

    // TODO: 2 - Move collateral currency from sender to contract. (from erc20 safe math)
    // collateralCurrency.safeTransferFrom(
    //   msg.sender,
    //   address(this),
    //   _collateralAmount
    // );

    // collateralBalances[msg.sender].collateralAddress = _collateralAddress
    // collateralBalances[msg.sender].balance = _collateralAmount

    // 3 - Emit successful deposit event
    emit DepositedCollateral(msg.sender, _collateralAmount, _collateralAddress);

    // TODO: 4 - Calculate conversion rate + fees

    // TODO: 5 - Call mint function to create tokens based on the collateral

    // TODO: 6 - Emit successful minting event
    // emit Mint(msg.sender, mintedTokens)
  }

  /**
   * Returns total collateral in contract
   */
  function getTotalCollateralByCollateralAddress(address _collateralAddress) public view returns (uint256) {
    return _totalCollateral;
  }

  /**
   * TODO: Returns collateral of the user
   */
  function getUserCollateralByUserAddressCollateralAddress(address _user, address _collateralAddress) public view returns (uint256) {}

  /****************************************
   *          INTERNAL FUNCTIONS          *
   ****************************************/

  function _isInitialized() internal view {
    require(initialized, 'Uninitialized contract');
  }

  function _mintToken(address recipient, uint256 value) internal virtual {}

  function _calculateRewards(
    uint256 entryTimestamp,
    uint256 currentTimestamp,
    uint256 value
  ) internal virtual {}
}
