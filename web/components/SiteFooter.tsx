import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';

export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto mt-16 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-hair px-8 py-6 text-xs text-ink-2">
      <div>Built on Arc Testnet · Settled by Pyth Network · USDC parimutuel</div>
      <div className="flex flex-wrap items-center gap-5">
        <a
          href="https://testnet.arcscan.app"
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-ink"
        >
          Arcscan
        </a>
        <a
          href={`https://testnet.arcscan.app/address/${PREDICTION_MARKET_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-ink"
        >
          Contract
        </a>
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-ink"
        >
          Faucet
        </a>
      </div>
    </footer>
  );
}
