import { LogoMark } from './LogoMark';

type Size = 'md' | 'lg' | 'xl';

const sizeMap: Record<Size, { mark: number; text: string }> = {
  md: { mark: 24, text: 'text-[22px]' },
  lg: { mark: 32, text: 'text-[30px]' },
  xl: { mark: 64, text: 'text-[56px]' },
};

export function Logo({
  size = 'md',
  animate = true,
  withWordmark = true,
}: {
  size?: Size;
  animate?: boolean;
  withWordmark?: boolean;
}) {
  const cfg = sizeMap[size];
  return (
    <span className="inline-flex items-start gap-[10px]" aria-label="ArcPredict">
      <LogoMark size={cfg.mark} animate={animate} />
      {withWordmark ? (
        <span className={`font-display leading-none text-ink ${cfg.text}`}>
          Arc<span className="bg-aurora-text bg-clip-text text-transparent">Predict</span>
        </span>
      ) : null}
    </span>
  );
}
