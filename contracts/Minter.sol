pragma solidity ^0.7.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import './implementation/Lockable.sol';
import './implementation/FixedPoint.sol';

contract Minter is Lockable {
  bool private initialized;

  // The collateral currency used to back the positions in this contract.
  IERC20 public collateralCurrency;

  /****************************************
   *                EVENTS                *
   ****************************************/
  event Deposit(address indexed user, uint256 collateral);
  event RequestWithdrawal(
    address user,
    uint256 collateral,
    uint256 requestPassTimeStamp
  );
  event RequestWithdrawalExecuted(
    address user,
    uint256 collateral,
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

  constructor(address _collateralAddress)
    public
    // address _finderAddress,
    // bytes32 _priceIdentifier,
    // address _timerAddress
    // ContractCreator(_finderAddress)
    // FeePayer(_collateralAddress, _finderAddress, _timerAddress)
    nonReentrant()
  {}

  function initialize() public nonReentrant() {
    initialized = true;
  }

  function deposit(uint256 collateralAmount)
    public
    isInitialized()
    // fees()
    nonReentrant()
  {
    // check if collateral amount is greater than 0
    // TODO: require(collateralAmount.isGreaterThan(0), 'Invalid collateral amount');

    // Emit deposit event
    // TODO: implement collateral amount with FixedPoint.unsigned
    emit Deposit(msg.sender, collateralAmount);

    // Move collateral currency from sender to contract.
    // TODO: Check FeePayer.sol
    collateralCurrency.safeTransferFrom(
      msg.sender,
      address(this),
      collateralAmount
    );
  }

  /****************************************
   *          INTERNAL FUNCTIONS          *
   ****************************************/

  function _isInitialized() internal view {
    require(initialized, 'Uninitialized contract');
  }
}
