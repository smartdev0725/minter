// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './uma/common/SyntheticToken.sol';
import './uma/expiring-multiparty/ExpiringMultiParty.sol';

contract Minter is Lockable {
  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Unsigned;
  using SafeERC20 for IERC20;
  using SafeERC20 for ExpandedIERC20;

  bool private initialized;
  address private _phmAddress;
  address private _contractCreator;
  address public _financialContractAddress;

  // EMP Contract reference
  ExpiringMultiParty emp;

  // PHM/ UBE token reference
  SyntheticToken phmToken;

  // Enables the dApp to send upto 2 decimal points
  FixedPoint.Unsigned decimalPadding = FixedPoint.fromUnscaledUint(100);
  uint256 private constant FP_SCALING_FACTOR = 10**18;

  // map collateralAddress balance to user
  mapping(address => mapping(address => CollateralPositions)) collateralBalances;

  // stores the diff collateral types that can mint synthetics
  address[] private collateralAddresses;

  // This struct acts as bookkeeping for how much of that collateral is allocated to each sponsor and how much tokens was minted by that sponsor
  struct CollateralPositions {
    FixedPoint.Unsigned totalTokensMinted;
    FixedPoint.Unsigned totalCollateralAmount;
  }

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
  event ChangedFinancialContractAddress(
    address indexed newFinancialContractAddress,
    address indexed oldFinancialContractAddress
  );

  /****************************************
   *               MODIFIERS              *
   ****************************************/

  modifier isInitialized() {
    _isInitialized();
    _;
  }

  modifier isAdmin() {
    _isAdmin();
    _;
  }

  /****************************************
   *           PUBLIC FUNCTIONS           *
   ****************************************/

  constructor(address phmAddress, address payable empContractAddress)
    public
    nonReentrant()
  {
    _phmAddress = phmAddress;
    _financialContractAddress = empContractAddress;
    _contractCreator = msg.sender;
    emp = ExpiringMultiParty(empContractAddress);
    phmToken = SyntheticToken(_phmAddress);
  }

  function initialize() public nonReentrant() {
    initialized = true;
  }

  function depositByCollateralAddress(
    uint256 _collateralAmount,
    uint256 _numTokens,
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
    IERC20 collateralToken = ExpandedIERC20(_collateralAddress);

    // Convert uint256 values from parameters to FixedPoint.Unsigned
    // FixedPoint.fromUnscaledUint converts ether value to wei
    FixedPoint.Unsigned memory collateral =
      FixedPoint.fromUnscaledUint(_collateralAmount).divCeil(decimalPadding);

    FixedPoint.Unsigned memory tokens =
      FixedPoint.fromUnscaledUint(_numTokens).divCeil(decimalPadding);

    // Check if user has enough balance
    require(
      collateralToken.balanceOf(msg.sender) >= collateral.rawValue,
      'Not enough collateral amount'
    );

    // Transfer collateral from user to this contract
    collateralToken.transferFrom(
      msg.sender,
      address(this),
      collateral.rawValue
    );

    // Emit successful deposit event
    emit DepositedCollateral(
      msg.sender,
      collateral.rawValue,
      _collateralAddress
    );

    collateralToken.approve(_financialContractAddress, collateral.rawValue);
    emp.create(collateral, tokens);

    phmToken.approve(address(this), tokens.rawValue);
    phmToken.transfer(msg.sender, tokens.rawValue);

    // Update collateral balance deposited in this contract
    _addCollateralBalances(collateral, tokens, _collateralAddress);
    // emit Mint event
    emit Mint(msg.sender, tokens.rawValue);
  }

  function redeemByCollateralAddress(
    uint256 _tokenAmount,
    address _collateralAddress
  ) public payable isInitialized() nonReentrant() {
    // Check if collateral is whitelisted
    require(
      isWhitelisted(_collateralAddress) == true,
      'This is not allowed as collateral.'
    );

    // Convert uint256 values from parameters to FixedPoint.Unsigned
    // FixedPoint.fromUnscaledUint converts ether value to wei
    FixedPoint.Unsigned memory tokenAmount =
      FixedPoint.fromUnscaledUint(_tokenAmount).divCeil(decimalPadding);
    IERC20 collateralToken = ExpandedIERC20(_collateralAddress);

    // Approve financial contract to transfer synthetic from minter to emp for burning
    phmToken.approve(_financialContractAddress, tokenAmount.rawValue);

    // Transfer phm/ube tokens from user to minter contract
    phmToken.transferFrom(msg.sender, address(this), tokenAmount.rawValue);

    require(
      phmToken.balanceOf(address(this)) >= tokenAmount.rawValue,
      'Not enough tokens'
    );

    // Redeem collateral and burn synthetic token
    FixedPoint.Unsigned memory redeemedCollateral = emp.redeem(tokenAmount);

    // Burn event
    emit Burn(msg.sender, tokenAmount.rawValue);

    // Transfer withdrawn collateral to user
    collateralToken.transfer(msg.sender, redeemedCollateral.rawValue);

    //update balances
    _removeCollateralBalances(
      redeemedCollateral,
      tokenAmount,
      _collateralAddress
    );

    emit WithdrawnCollateral(
      msg.sender,
      redeemedCollateral.rawValue,
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

    return emp.totalPositionCollateral().rawValue;
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

    CollateralPositions storage position =
      collateralBalances[msg.sender][_collateralAddress];
    return position.totalCollateralAmount.rawValue;
  }

  /**
   * Returns total user minted tokens from Minter
   */
  function getUserTotalMintedTokensByCollateralAddress(
    address _collateralAddress
  ) public view returns (uint256) {
    require(
      isWhitelisted(_collateralAddress) == true,
      'Collateral address is not whitelisted.'
    );

    CollateralPositions storage position =
      collateralBalances[msg.sender][_collateralAddress];

    return position.totalTokensMinted.rawValue;
  }

  /**
   * Returns the latest GCR
   */
  function getGCR() public view returns (uint256) {
    return _getGCRValue().rawValue;
  }

  /**
   * Returns the financial contract address (EMP/Perpetual)
   */
  function getFinancialContractAddress() public view returns (address) {
    return _financialContractAddress;
  }

  /**
   * Sets the financial contract if you are the admin (contract creator)
   */
  function setFinancialContractAddress(address payable contractAddress)
    public
    nonReentrant()
    isAdmin()
  {
    address oldContractAddress = _financialContractAddress;
    _financialContractAddress = contractAddress;
    emit ChangedFinancialContractAddress(contractAddress, oldContractAddress);
  }

  /**
   * Whitelist collateral in the minter contract (this doesnt whitelist it on the uma contracts)
   */
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

  /**
   * Remove whitelisted collateral in the minter contract (this doesnt remove whitelist on the uma contracts)
   */
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

  /**
   * Check if contract address is a whitelisted collateral in the minter contract (this doesnt check whitelisted collaterals on the UMA contracts)
   */
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

  /****************************************
   *          INTERNAL FUNCTIONS          *
   ****************************************/

  function _isInitialized() internal view {
    require(initialized, 'Uninitialized contract');
  }

  function _isAdmin() internal view returns (bool) {
    require(msg.sender == _contractCreator, 'You are not the contract owner.');
  }

  function _addCollateralBalances(
    FixedPoint.Unsigned memory value,
    FixedPoint.Unsigned memory numTokens,
    address _collateralAddress
  ) internal {
    CollateralPositions storage position =
      collateralBalances[msg.sender][_collateralAddress];

    position.totalCollateralAmount = position.totalCollateralAmount.add(value);
    position.totalTokensMinted = position.totalTokensMinted.add(numTokens);
  }

  function _removeCollateralBalances(
    FixedPoint.Unsigned memory value,
    FixedPoint.Unsigned memory numTokens,
    address _collateralAddress
  ) internal {
    CollateralPositions storage position =
      collateralBalances[msg.sender][_collateralAddress];

    position.totalCollateralAmount = position.totalCollateralAmount.sub(value);
    position.totalTokensMinted = position.totalTokensMinted.sub(numTokens);
  }

  function _getGCRValue() internal view returns (FixedPoint.Unsigned memory) {
    FixedPoint.Unsigned memory gcrValue =
      emp.totalPositionCollateral().mul(FP_SCALING_FACTOR).div(
        emp.totalTokensOutstanding()
      );

    return gcrValue;
  }
}
