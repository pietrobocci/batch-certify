// Picks the right contract address for the chain the app is currently on.
//
// The address map comes from the generated contract.ts (one deployment
// per chain). If the current chain has no deployment, `address` is
// undefined — the wagmi hooks receiving it stay disabled, and components
// can show a friendly message instead of failing.
import { useChainId } from "wagmi";
import { contractAddresses, contractAbi } from "../generated/contract";

export function useContract() {
  const chainId = useChainId();
  return {
    chainId,
    address: contractAddresses[chainId], // may be undefined
    abi: contractAbi,
  };
}
