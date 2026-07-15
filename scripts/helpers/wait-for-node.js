// On some machines (endpoint protection inspecting new connections) the
// first RPC call to a freshly started node times out; the next one goes
// through. Retry a few times instead of failing the whole script.
async function waitForNode(provider, attempts = 6, pauseMs = 2000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const block = await provider.getBlockNumber();
      if (i > 1) console.log(`Node reached on attempt ${i} (block ${block}).`);
      return;
    } catch (err) {
      if (i === attempts) {
        throw new Error(
          `Node unreachable after ${attempts} attempts. Is it running? ` +
          `Start it with: npm run node\n(${err.message})`
        );
      }
      console.log(`Node not reachable yet (attempt ${i}/${attempts}), retrying...`);
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
}

module.exports = { waitForNode };
