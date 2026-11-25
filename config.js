// Reflex Rush — configuration
// Fill in AGENT_ARCADE_ADDRESS after each deploy. The parent fills these in;
// the UI also lets the user paste/override the address (saved to localStorage).

const CONFIG = {
  // SPACE ID Agent ID (ERC-721, non-transferable) on BSC mainnet (chainId 56).
  AGENT_ID_ADDRESS: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",

  NETWORKS: {
    bsc: {
      label: "BSC Mainnet",
      chainId: 56,
      chainIdHex: "0x38",
      rpcUrl: "https://bsc-dataseed.binance.org",
      agentIdAddress: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
      // deployed on BSC mainnet 2026-11-18 ~19:15 WIB, tx 0xaac4f7889c80ea251699264505ffa0e78320f8e050973d2f17fed5b94b25a2c0
      contractAddress: "0xc3A85063330F810Dab7be9eb92E023aC47C81277",
    },
    anvil: {
      label: "Local Anvil",
      chainId: 31337,
      chainIdHex: "0x7a69",
      rpcUrl: "http://127.0.0.1:8545",
      // MockAgentId deployed locally 2026-11-18 (deployer holds "deployer.ai")
      agentIdAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      // deployed locally 2026-11-18 via contracts/script/Deploy.s.sol (DEPLOY_MOCK=true)
      contractAddress: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    },
  },

  // Minimal Agent ID ABI: balance + name resolution.
  AGENT_ID_ABI: [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
  ],

  // AgentArcade contract ABI (ethers v6 JSON format).
  AGENT_ARCADE_ABI: [{"inputs":[{"internalType":"address","name":"agentId_","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"NotAgentIdHolder","type":"error"},{"inputs":[],"name":"NotOwner","type":"error"},{"inputs":[],"name":"NotSessionOwner","type":"error"},{"inputs":[],"name":"ScoreOutOfRange","type":"error"},{"inputs":[],"name":"SessionAlreadySubmitted","type":"error"},{"inputs":[],"name":"SessionExpired","type":"error"},{"inputs":[],"name":"SessionTooEarly","type":"error"},{"inputs":[],"name":"UnknownSession","type":"error"},{"inputs":[],"name":"ZeroAddress","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldAgentId","type":"address"},{"indexed":true,"internalType":"address","name":"newAgentId","type":"address"}],"name":"AgentIdUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"sessionId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint256","name":"score","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bestScore","type":"uint256"}],"name":"ScoreSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"sessionId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint256","name":"startTime","type":"uint256"}],"name":"SessionStarted","type":"event"},{"inputs":[],"name":"LEADERBOARD_SIZE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAX_SCORE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAX_SESSION_SECONDS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MIN_SESSION_SECONDS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"agentId","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"bestScore","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getLeaderboard","outputs":[{"internalType":"address[]","name":"","type":"address[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"hasPlayed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"playerCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"players","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"sessions","outputs":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"bool","name":"submitted","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newAgentId","type":"address"}],"name":"setAgentId","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"startSession","outputs":[{"internalType":"bytes32","name":"sessionId","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"sessionId","type":"bytes32"},{"internalType":"uint256","name":"score","type":"uint256"}],"name":"submitScore","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"topPlayers","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"topScores","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"totalPlays","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],

  MIN_SESSION_SECONDS: 5, // contract rejects submitScore before this many seconds
  ROUNDS: 5,
  MAX_ROUND_POINTS: 1000, // points = max(0, 1000 - reactionMs); total = sum * 2 (0..10000)
  STORAGE_KEY_ADDRESS: "reflexRush.contractAddress",
  STORAGE_KEY_NETWORK: "reflexRush.network",
};
