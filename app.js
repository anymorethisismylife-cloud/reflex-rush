// Reflex Rush — frontend logic (ethers v6, window.ethereum only).
// No auto-approvals: every transaction is sent only after the user clicks a
// button and then explicitly confirms it in their own wallet.

"use strict";

// ---------- state ----------
let provider = null;        // ethers BrowserProvider (wallet) or JsonRpcProvider (reads)
let readProvider = null;    // public RPC provider for reads, no wallet needed
let signer = null;
let userAddress = null;
let networkKey = localStorage.getItem(CONFIG.STORAGE_KEY_NETWORK) || "bsc";
let contract = null;        // AgentArcade (signer) or null
let readContract = null;    // AgentArcade (read-only) or null
let agentIdContract = null; // Agent ID ERC-721 (read-only)
let isAgentIdHolder = false;
let userAiName = null;
let nameCache = new Map();  // address (lowercase) -> display name

// Game state
let mode = null;            // "ranked" | "practice" | null
let sessionId = null;
let sessionStartedAt = null; // Date.now() ms when the ranked session tx confirmed
let round = 0;              // current round number (1-based while playing)
let roundScores = [];       // points per finished round
let waitingTimer = null;
let greenAt = null;         // performance.now() when target turned green
let earlyClick = false;

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

function shortAddress(addr) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
}

function setTxStatus(msg, kind) {
  const el = $("txStatus");
  el.textContent = msg || "";
  el.className = "tx-status" + (kind ? " " + kind : "");
}

function totalScore() {
  return roundScores.reduce((a, b) => a + b, 0) * 2;
}

function contractAddressFor(key) {
  const override = (localStorage.getItem(CONFIG.STORAGE_KEY_ADDRESS + "." + key) || "").trim();
  if (override) return override;
  return CONFIG.NETWORKS[key].contractAddress || "";
}

// Resolve a .ai name for an address (best effort). Falls back to truncated address.
async function resolveAiName(address) {
  const key = address.toLowerCase();
  if (nameCache.has(key)) return nameCache.get(key);
  let display = shortAddress(address);
  try {
    if (!agentIdContract) throw new Error("no agent id contract");
    const tokenId = await agentIdContract.tokenOfOwnerByIndex(address, 0);
    const uri = await agentIdContract.tokenURI(tokenId);
    const url = uri.startsWith("ipfs://")
      ? "https://ipfs.io/ipfs/" + uri.slice("ipfs://".length)
      : uri;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("metadata fetch failed: " + res.status);
    const meta = await res.json();
    if (meta && typeof meta.name === "string" && meta.name.trim()) {
      display = meta.name.trim();
    }
  } catch (e) {
    // Best effort only — truncated address is the fallback.
  }
  nameCache.set(key, display);
  return display;
}

// ---------- providers / contract wiring ----------
function buildReadProviders() {
  const net = CONFIG.NETWORKS[networkKey];
  readProvider = new ethers.JsonRpcProvider(net.rpcUrl);
  const agentIdAddr = net.agentIdAddress || CONFIG.AGENT_ID_ADDRESS;
  agentIdContract = new ethers.Contract(agentIdAddr, CONFIG.AGENT_ID_ABI, readProvider);
  const addr = contractAddressFor(networkKey);
  readContract = addr && ethers.isAddress(addr)
    ? new ethers.Contract(addr, CONFIG.AGENT_ARCADE_ABI, readProvider)
    : null;
  contract = null;
  if (signer && addr && ethers.isAddress(addr)) {
    contract = new ethers.Contract(addr, CONFIG.AGENT_ARCADE_ABI, signer);
  }
}

function refreshAddressHint() {
  const addr = contractAddressFor(networkKey);
  const input = $("contractAddressInput");
  if (document.activeElement !== input) input.value = addr;
  $("addressHint").textContent = addr
    ? "Using contract " + shortAddress(addr) + " on " + CONFIG.NETWORKS[networkKey].label + "."
    : "No contract address set for " + CONFIG.NETWORKS[networkKey].label +
      " yet — paste one above (or wait for the deploy). Ranked play and the leaderboard need it.";
  updateButtons();
}

function updateButtons() {
  const hasContract = !!readContract;
  $("startRankedBtn").disabled = !(userAddress && isAgentIdHolder && hasContract && !mode);
  $("startPracticeBtn").disabled = !!mode;
  $("submitScoreBtn").classList.toggle("hidden", !(mode === "ranked" && sessionId && roundScores.length === CONFIG.ROUNDS));
}

// ---------- wallet ----------
async function connectWallet() {
  if (!window.ethereum) {
    setTxStatus("No wallet found. Install MetaMask or Binance Wallet, then reload this page.", "error");
    return;
  }
  try {
    setTxStatus("Waiting for you to connect in your wallet…");
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = accounts[0];
    await ensureNetwork();
    await afterConnect();
    setTxStatus("");
  } catch (e) {
    setTxStatus("Connection cancelled or failed: " + (e && e.message ? e.message : e), "error");
  }
}

async function ensureNetwork() {
  const net = CONFIG.NETWORKS[networkKey];
  const current = await provider.getNetwork();
  if (Number(current.chainId) === net.chainId) return;
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: net.chainIdHex }]);
  } catch (e) {
    if (e && e.code === 4902 && networkKey === "bsc") {
      await provider.send("wallet_addEthereumChain", [{
        chainId: net.chainIdHex,
        chainName: "BNB Smart Chain",
        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
        rpcUrls: [net.rpcUrl],
        blockExplorerUrls: ["https://bscscan.com"],
      }]);
    } else {
      throw e;
    }
  }
}

async function afterConnect() {
  $("networkBadge").textContent = shortAddress(userAddress);
  $("connectBtn").textContent = "Connected";
  $("connectBtn").disabled = true;
  $("accountInfo").textContent = "Connected as " + userAddress;
  buildReadProviders();
  await checkAgentId();
  await refreshPersonalStats();
  await loadLeaderboard();
  refreshAddressHint();
}

async function checkAgentId() {
  const statusEl = $("agentIdStatus");
  const noAgentEl = $("noAgentPanel");
  isAgentIdHolder = false;
  userAiName = null;
  try {
    const bal = await agentIdContract.balanceOf(userAddress);
    if (bal > 0n) {
      isAgentIdHolder = true;
      userAiName = await resolveAiName(userAddress);
      statusEl.innerHTML = "&#10003; <strong>Agent ID holder</strong> — " + escapeHtml(userAiName);
      statusEl.className = "agent-status ok";
      noAgentEl.classList.add("hidden");
    } else {
      statusEl.innerHTML = "&#10007; No Agent ID on this address.";
      statusEl.className = "agent-status no";
      noAgentEl.classList.remove("hidden");
    }
  } catch (e) {
    statusEl.textContent = "Could not check Agent ID status: " + (e && e.message ? e.message : e);
    statusEl.className = "agent-status no";
  }
  updateButtons();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// ---------- personal stats & leaderboard ----------
async function refreshPersonalStats() {
  if (!readContract || !userAddress) {
    $("personalBest").textContent = "—";
    $("totalPlays").textContent = "—";
    return;
  }
  try {
    const [best, plays] = await Promise.all([
      readContract.bestScore(userAddress),
      readContract.totalPlays(userAddress),
    ]);
    $("personalBest").textContent = best.toString();
    $("totalPlays").textContent = plays.toString();
  } catch (e) {
    $("personalBest").textContent = "—";
    $("totalPlays").textContent = "—";
  }
}

async function loadLeaderboard() {
  const list = $("leaderboard");
  if (!readContract) {
    list.innerHTML = "<li class='muted'>Set a contract address to load the leaderboard.</li>";
    return;
  }
  list.innerHTML = "<li class='muted'>Loading…</li>";
  try {
    const [players, scores] = await readContract.getLeaderboard();
    if (players.length === 0) {
      list.innerHTML = "<li class='muted'>No ranked scores yet — be the first.</li>";
      return;
    }
    const names = await Promise.all(players.map((p) => resolveAiName(p)));
    list.innerHTML = "";
    players.forEach((player, i) => {
      const li = document.createElement("li");
      const isMe = userAddress && player.toLowerCase() === userAddress.toLowerCase();
      li.className = "lb-row" + (isMe ? " me" : "");
      li.innerHTML =
        "<span class='lb-rank'>#" + (i + 1) + "</span>" +
        "<span class='lb-name'>" + escapeHtml(names[i]) + (isMe ? " (you)" : "") + "</span>" +
        "<span class='lb-addr'>" + shortAddress(player) + "</span>" +
        "<span class='lb-score'>" + scores[i].toString() + "</span>";
      list.appendChild(li);
    });
  } catch (e) {
    list.innerHTML = "<li class='muted'>Could not load leaderboard: " + escapeHtml(e && e.message ? e.message : e) + "</li>";
  }
}

// ---------- game ----------
function resetGameUi(message) {
  const area = $("gameArea");
  area.className = "game-area idle";
  $("gameMessage").textContent = message || "Press Start to play";
  $("gameSub").textContent = "";
}

function renderRounds() {
  const el = $("roundResults");
  el.innerHTML = "";
  for (let i = 0; i < CONFIG.ROUNDS; i++) {
    const div = document.createElement("div");
    div.className = "round" + (i < roundScores.length ? " done" : "") + (i === round - 1 && mode ? " active" : "");
    const ms = i < roundScores.length ? (1000 - roundScores[i]) : null;
    div.textContent = "Round " + (i + 1) + ": " + (ms === null ? "—" : ms + " ms · " + roundScores[i] + " pts");
    el.appendChild(div);
  }
  $("totalScore").textContent = totalScore().toString();
}

function startRound() {
  round += 1;
  renderRounds();
  const area = $("gameArea");
  area.className = "game-area waiting";
  $("gameMessage").textContent = "Wait for green…";
  $("gameSub").textContent = "Round " + round + " of " + CONFIG.ROUNDS + " — don't click yet!";
  greenAt = null;
  const delay = 1000 + Math.random() * 2000; // 1–3 s
  waitingTimer = setTimeout(() => {
    area.className = "game-area green";
    $("gameMessage").textContent = "CLICK!";
    $("gameSub").textContent = "";
    greenAt = performance.now();
  }, delay);
}

function onTargetClick() {
  if (!mode) return;
  const area = $("gameArea");
  if (area.classList.contains("waiting")) {
    // Clicked too early — restart this round's wait.
    clearTimeout(waitingTimer);
    earlyClick = true;
    $("gameMessage").textContent = "Too early!";
    $("gameSub").textContent = "Wait for green, then click. Restarting this round…";
    area.className = "game-area early";
    setTimeout(() => { if (mode) startRound(); }, 900);
    round -= 1; // startRound() increments again
    return;
  }
  if (!area.classList.contains("green") || greenAt === null) return;
  const reactionMs = Math.round(performance.now() - greenAt);
  greenAt = null;
  const points = Math.max(0, CONFIG.MAX_ROUND_POINTS - reactionMs);
  roundScores.push(points);
  renderRounds();
  if (roundScores.length >= CONFIG.ROUNDS) {
    endGame();
  } else {
    area.className = "game-area idle";
    $("gameMessage").textContent = reactionMs + " ms — " + points + " pts";
    $("gameSub").textContent = "Next round starting…";
    setTimeout(() => { if (mode) startRound(); }, 900);
  }
}

function endGame() {
  const area = $("gameArea");
  area.className = "game-area idle";
  $("gameMessage").textContent = "Done! Total score: " + totalScore();
  $("gameSub").textContent = mode === "ranked"
    ? "Submit your score on-chain to record it."
    : "Practice run — nothing was submitted.";
  if (mode === "ranked") {
    updateSubmitWarning();
    updateButtons();
  } else {
    mode = null;
    updateButtons();
  }
}

// Contract rejects submitScore before MIN_SESSION_SECONDS have elapsed.
function updateSubmitWarning() {
  const warn = $("submitWarning");
  if (mode !== "ranked" || !sessionStartedAt) { warn.classList.add("hidden"); return; }
  const elapsed = (Date.now() - sessionStartedAt) / 1000;
  if (elapsed < CONFIG.MIN_SESSION_SECONDS) {
    const remain = Math.ceil(CONFIG.MIN_SESSION_SECONDS - elapsed);
    warn.textContent = "The session is only " + elapsed.toFixed(1) + " s old — the contract rejects " +
      "submissions before " + CONFIG.MIN_SESSION_SECONDS + " s. Wait " + remain + " s more.";
    warn.classList.remove("hidden");
    $("submitScoreBtn").disabled = true;
    setTimeout(updateSubmitWarning, 500);
  } else {
    warn.classList.add("hidden");
    $("submitScoreBtn").disabled = false;
  }
}

async function startRankedGame() {
  if (!contract || !userAddress || !isAgentIdHolder) return;
  mode = "ranked";
  round = 0;
  roundScores = [];
  sessionId = null;
  sessionStartedAt = null;
  renderRounds();
  updateButtons();
  try {
    setTxStatus("Confirm the startSession transaction in your wallet…");
    const tx = await contract.startSession();
    setTxStatus("Waiting for the session transaction to confirm…");
    const receipt = await tx.wait();
    // SessionStarted(sessionId, player, startTime) is the first log.
    const parsed = receipt.logs
      .map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } })
      .find((e) => e && e.name === "SessionStarted");
    if (!parsed) throw new Error("SessionStarted event not found in receipt.");
    sessionId = parsed.args.sessionId;
    sessionStartedAt = Date.now();
    $("sessionInfo").textContent = "Session " + sessionId.slice(0, 10) + "… started on-chain. Play all 5 rounds, then submit.";
    setTxStatus("Session started. Good luck!", "ok");
    startRound();
  } catch (e) {
    mode = null;
    setTxStatus("Could not start ranked session: " + (e && e.message ? e.message : e), "error");
    resetGameUi("Press Start to play");
    updateButtons();
  }
}

function startPracticeGame() {
  mode = "practice";
  round = 0;
  roundScores = [];
  sessionId = null;
  sessionStartedAt = null;
  $("sessionInfo").textContent = "Practice mode — off-chain, nothing is submitted.";
  renderRounds();
  updateButtons();
  startRound();
}

async function submitScore() {
  if (!contract || mode !== "ranked" || !sessionId) return;
  const score = totalScore();
  if (score < 0 || score > 10000) {
    setTxStatus("Score out of range (0–10000).", "error");
    return;
  }
  const elapsed = (Date.now() - sessionStartedAt) / 1000;
  if (elapsed < CONFIG.MIN_SESSION_SECONDS) {
    updateSubmitWarning();
    return;
  }
  try {
    $("submitScoreBtn").disabled = true;
    setTxStatus("Confirm the submitScore transaction in your wallet…");
    const tx = await contract.submitScore(sessionId, score);
    setTxStatus("Waiting for the score transaction to confirm…");
    await tx.wait();
    setTxStatus("Score " + score + " recorded on-chain!", "ok");
    $("sessionInfo").textContent = "";
    mode = null;
    sessionId = null;
    updateButtons();
    await refreshPersonalStats();
    await loadLeaderboard();
    resetGameUi("Score submitted. Play again?");
  } catch (e) {
    $("submitScoreBtn").disabled = false;
    setTxStatus("Score submission failed: " + (e && e.message ? e.message : e), "error");
  }
}

// ---------- network / address UI ----------
function onNetworkChange() {
  networkKey = $("networkSelect").value;
  localStorage.setItem(CONFIG.STORAGE_KEY_NETWORK, networkKey);
  buildReadProviders();
  refreshAddressHint();
  if (userAddress) {
    // Wallet network should follow the selection.
    ensureNetwork().catch((e) => setTxStatus("Switch network in your wallet: " + (e && e.message ? e.message : e), "error"));
    refreshPersonalStats();
    loadLeaderboard();
  }
}

function onSaveAddress() {
  const value = $("contractAddressInput").value.trim();
  if (value && !ethers.isAddress(value)) {
    setTxStatus("That doesn't look like a valid contract address.", "error");
    return;
  }
  localStorage.setItem(CONFIG.STORAGE_KEY_ADDRESS + "." + networkKey, value);
  buildReadProviders();
  refreshAddressHint();
  setTxStatus(value ? "Contract address saved." : "Contract address cleared.", "ok");
  if (userAddress) { refreshPersonalStats(); loadLeaderboard(); }
}

// ---------- init ----------
function init() {
  $("networkSelect").value = networkKey;
  $("networkSelect").addEventListener("change", onNetworkChange);
  $("connectBtn").addEventListener("click", connectWallet);
  $("saveAddressBtn").addEventListener("click", onSaveAddress);
  $("refreshLbBtn").addEventListener("click", loadLeaderboard);
  $("startRankedBtn").addEventListener("click", startRankedGame);
  $("startPracticeBtn").addEventListener("click", startPracticeGame);
  $("submitScoreBtn").addEventListener("click", submitScore);
  $("gameArea").addEventListener("click", onTargetClick);
  $("gameArea").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTargetClick(); }
  });
  buildReadProviders();
  refreshAddressHint();
  renderRounds();
  resetGameUi();
  loadLeaderboard();
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }
}

document.addEventListener("DOMContentLoaded", init);
