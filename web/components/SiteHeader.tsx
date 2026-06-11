import { WalletPill } from './WalletPill';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hair bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 sm:px-8 py-3.5">
        <div className="min-w-0 flex items-center gap-3">
          <span
            className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-arc"
            aria-hidden="true"
          >
            <span className="arc-ring-dot h-[7px] w-[7px] rounded-full bg-arc" />
          </span>
          <span className="font-display text-[22px] leading-none text-ink" aria-label="ArcPredict">
            Arc<em className="text-arc not-italic">Predict</em>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-paper px-3 py-1.5 text-[13px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-arc shadow-[0_0_0_3px_theme(colors.arc-tint)]" />
            <span>Arc Testnet</span>
            <span className="hidden md:inline font-mono text-[12px] text-ink">·5042002</span>
          </span>
          <WalletPill />
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(22, 82, 240, 0.35);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(22, 82, 240, 0);
          }
        }

        .arc-ring-dot {
          animation: pulse 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }
      `}</style>
    </header>
  );
}
