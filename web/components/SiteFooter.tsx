import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-hair">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-[13px] text-ink-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>Built on Arc Testnet · Settled by Pyth Network · USDC parimutuel</div>
          <div className="flex flex-wrap items-center gap-5">
            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-arc-glow"
            >
              Arcscan
            </a>
            <a
              href={`https://testnet.arcscan.app/address/${PREDICTION_MARKET_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-arc-glow"
            >
              Contract
            </a>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-arc-glow"
            >
              Faucet
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
