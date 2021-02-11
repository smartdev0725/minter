# Setup checklist

[ ] Clone UMA protocol from [here](https://github.com/HaloDAO/protocol)

# Setup environment variables

1. Go to https://infura.io/ and make an account
2. Paste the kovan project ID into your .env as the value for `INFURA_PROJECT_ID` key
3. Generate a 12 word mnemonic seed phrase (can use ganache to get one or ask project admin for current seed used for remote envs)
4. Paste 12 word mnemonic seed phrase as value for `MNEMONIC_SEED` key
5. Go to https://alchemyapi.io/ and setup an account then take the api key for the relevant network (like mainnet, kovan or ropsten) or ask the team for an existing API key and paste under `ALCHEMY_KEY`

# Metamask

1. Be sure to have metamask plugin installed in your browser (recommended browser is Chrome)
2. Login to Metamask and point the network to localhost and port 9545 before starting the frontend app

## Quickstart: Running local

1. Setup UMA locally by running `git clone https://github.com/HaloDAO/protocol` and following the quick start steps in that repo
2. Run the Ganache node using this command `npx ganache-cli -p 9545 -e 1000000 -l 10000000`
3. While still in the `protocol` project root, run `yarn truffle console --network test` to enter the truffle console.
4. Run `migrate` to migrate UMA contract in local Ganache node inside the truffle console.
5. Make an EMP following steps 3-8 [here](https://docs.umaproject.org/build-walkthrough/mint-locally#parameterize-and-deploy-a-contract)
6. Get the emp address by entering `emp.address`
7. Create an instance of the collateral token to get its address. Run `const collateralToken = await TestnetERC20.deployed()` then `collateralToken.address`
8. Create an instance of the synthetic token to get its address. Run `const syntheticToken = await SyntheticToken.at(await emp.tokenCurrency())` then `syntheticToken.address`
9. Replace or add the addresses in the deploy script. `empContractAddress = {the emp address}`, `collateralAddressUMA = {collateralToken address}`, and `ubeAddressUma = {synthetic token address}`
10. Open a new terminal window and run `git clone https://github.com/HaloDAO/minter && cd minter`
11. run `npm i` to install backend dependencies
12. run `npm run test:local` to run contract test suite to run smart contract test cases
13. run `npm run deploy:local` to compile and deploy the Minter contract to the ganache node that UMA was deployed on
14. cd to frontend `cd frontend`
15. run `npm i` to install frontend dependencies
16. run `npm start` to serve the app locally

## Environment Setup

#### Quickstart Setup

- [ ] Install all dependencies
- [ ] Deployed a local ethereum network with Ganache on the uma protocol/ protocol folder
- [ ] Compliled and deployed smart contract to the blockchain
- [ ] Contract artifact and typechain is auto generated in the front end folder

#### Terminal Setup Checklist

- [ ] Terminal 1 - React Front End for the dapp
- [ ] Terminal 2 - Ganache node deploy from the uma protocol folder
- [ ] Terminal 3 (Optional) - Truffle console to migrate and interact with the UMA Contracts in local

#### Dapp Setup Checklist

- [ ] Deploy the local ganache inside the uma protocol
- [ ] Metamask set to the network you are developing to (localhost:9545 for local, testnet of choice)
- [ ] Run a local react server

#### Smart Contract Development Setup Checklist

- [ ] Contract and other dependencies are in the same folder

## Tutorials

#### Deploying contracts in Kovan Testnet

1. Ensure you have added the following env variables: INFURA_PROJECT_ID and MNEMONIC SEED
2. Make sure the account in your mnemonic seed has enough balance to deploy the contract
3. Run `npm run test:local` to ensure all tests are passing (make sure you have the setup your local environment first)
4. If tests are passing, check deploy.ts if the addresses are pointed to kovan.
5. If all addresses are on kovan, deploy the code by running `npm run deploy:kovan`
6. The minter address should appear in the console.
7. Run the dApp: `cd frontend && npm run start`
8. Change your metamask network to Kovan
9. The minter dApp UI should load

#### Local developlment: How to update the smart contract code w/ hot reloading

1. Ensure your local environment has been set up (ganache node, truffle console)
2. Do updates in the smart contract solidity code in the contracts folder located in root
3. Add tests in the test folder when necessary
4. Run `npm run test:local`
5. If tests are passing, deploy the code by running `npm run deploy:local`
6. If successful, the front end dApp should reload and smart contract changes can be read/utilized by the dApp.

#### Resources

[HardHat Documentation](https://hardhat.org/getting-started/) - Hardhat tutorials, config, network, and plugin references

## Troubleshooting

1. Error: Cannot use JSX unless the '--jsx' flag is provided

- Follow: https://vscode.readthedocs.io/en/latest/languages/typescript/#using-the-workspace-version-of-typescript - "Using the workspace version of TypeScript" section

2. Warning: Calling an account which is not a contract

- Compile and deploy your contract first. Run `npm run deploy:local` for local deployments.

3. If you get `ProviderError: Must be authenticated!` or https://hardhat.org/errors/#HH604 then make sure you've entered a key and value in `.env` for `ALCHEMY_KEY`
4. If you've accidentally started a background process for a node then you can use `sudo lsof -i :<port number>` to find the PID then kill it using `kill -9 <PID>` (from https://stackoverflow.com/questions/3855127/find-and-kill-process-locking-port-3000-on-mac)

5. UMA tests don't run due to `No tests configured` err: try `npm uninstall -g ganache-cli`, make sure `yarn ganache-cli --version` returns `Ganache CLI v6.12.2 (ganache-core: 2.13.2)` (or the same version as specified in `protocol` repo's root package.json) then run `yarn test` again
