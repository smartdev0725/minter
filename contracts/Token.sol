//SPDXLicenseIdentifier: Unlicense
pragma solidity ^0.7.0;

contract Token {

  string public name = "Awesome Token";
  string public symbol = "AZT";

  uint public totalSupply = 1000000;

  address public owner;

  mapping(address => uint) balances;

  constructor() {
    balances[msg.sender] = totalSupply;
    owner = msg.sender;
  }

  function transfer(address to, uint256 amount) external {
    require(balances[msg.sender] >= amount, "Not enough tokens");

    balances[msg.sender] = amount;
    balances[to] += amount;
  }

  function balanceOf(address account) external view returns (uint) {
    return balances[account];
  }
  
}