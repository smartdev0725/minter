import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Token } from '../typechain/Token'

describe('Token contract', () => {
  let hardhatToken: Token
  let owner: SignerWithAddress
  let addr1: SignerWithAddress
  let addr2: SignerWithAddress

  beforeEach(async () => {
    const factory = await ethers.getContractFactory('Token')
    ;[owner, addr1, addr2] = await ethers.getSigners()
    hardhatToken = (await factory.deploy()) as Token
  })

  describe('Deployment', () => {
    it('Should set the right owner', async () => {
      expect(await hardhatToken.owner()).to.equal(owner.address)
    })

    it('Should assign the total supply of tokens to the owner', async () => {
      const ownerBalance = await hardhatToken.balanceOf(owner.address)
      expect(await hardhatToken.totalSupply()).to.equal(ownerBalance)
    })
  })

  describe('Transactions', () => {
    it('Should transfer tokens between accounts', async () => {
      await hardhatToken.transfer(addr1.address, 50)
      const addr1Balance = await hardhatToken.balanceOf(addr1.address)
      expect(addr1Balance).to.equal(50)

      await hardhatToken.connect(addr1).transfer(addr2.address, 50)
      const addr2Balance = await hardhatToken.balanceOf(addr2.address)
      expect(addr2Balance).to.equal(50)
    })

    it('Should fail if sender doesn’t have enough tokens', async () => {
      const initialOwnerBalance = await hardhatToken.balanceOf(owner.address)

      await expect(
        hardhatToken.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith('Not enough tokens')

      expect(await hardhatToken.balanceOf(owner.address)).to.equal(
        initialOwnerBalance
      )
    })

    it('Should update balances after transfers', async () => {
      const initialOwnerBalance = await hardhatToken.balanceOf(owner.address)

      await hardhatToken.transfer(addr1.address, 100)
      await hardhatToken.transfer(addr2.address, 50)

      const finalOwnerBalance = await hardhatToken.balanceOf(owner.address)
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.toNumber() - 150)

      const addr1Balance = await hardhatToken.balanceOf(addr1.address)
      expect(addr1Balance).to.equal(100)

      const addr2Balance = await hardhatToken.balanceOf(addr2.address)
      expect(addr2Balance).to.equal(50)
    })
  })
})
