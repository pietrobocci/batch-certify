import { ConnectWallet } from "./components/ConnectWallet";
import { IssueCertificate } from "./components/IssueCertificate";
import { VerifyCertificate } from "./components/VerifyCertificate";
import { RevokeCertificate } from "./components/RevokeCertificate";
import { CertificateHistory } from "./components/CertificateHistory";

export default function App() {
  return (
    <div className="page">
      <header>
        <h1>Batch Certify</h1>
        <p>
          On-chain certificates for production batches — the batch record
          stays private, its fingerprint becomes tamper-evident.
        </p>
      </header>

      <ConnectWallet />

      <main>
        <div className="stack">
          <IssueCertificate />
          <RevokeCertificate />
        </div>
        <VerifyCertificate />
      </main>

      <CertificateHistory />

      <footer>
        <p>Local development build — contract on Hardhat chain 31337.</p>
      </footer>
    </div>
  );
}
