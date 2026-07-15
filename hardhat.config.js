require("@nomicfoundation/hardhat-toolbox");
// Loads .env into process.env. The .env file is gitignored: it holds the
// Sepolia RPC url and the deployer's private key — secrets never enter git.
require("dotenv").config();

const { SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // The sepolia network only exists if .env provides the credentials,
    // so the local workflow works with no .env at all.
    ...(SEPOLIA_RPC_URL && SEPOLIA_PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [SEPOLIA_PRIVATE_KEY] } }
      : {}),
  },
  // For `hardhat verify`: publishes the source code on Etherscan so anyone
  // can read the deployed contract.
  etherscan: { apiKey: ETHERSCAN_API_KEY ?? "" },
};
