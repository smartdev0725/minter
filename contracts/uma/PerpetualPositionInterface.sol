// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

//import '../implementation/FixedPoint.sol';

abstract contract PerpetualPositionManager {
  struct Unsigned {
    uint256 rawValue;
  }

  function create(Unsigned memory collateralAmount, Unsigned memory numTokens)
    public
    virtual;

  //function totalPositionCollateral()
  //  external
  //  view
  //  virtual
  //  returns (FixedPoint.Unsigned memory totalCollateral);
}
