export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-6 text-white">
      <section className="w-full max-w-xl rounded-lg border border-white/10 bg-surface p-8 shadow-2xl shadow-black/30">
        <p className="text-sm uppercase tracking-[0.2em] text-accent">ArcPredict</p>
        <h1 className="mt-4 text-3xl font-semibold">前端骨架已就位</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          当前页面仅用于验证 Next.js、wagmi、RainbowKit 与 Tailwind 初始化成功，业务页面会在后续 Phase 实现。
        </p>
      </section>
    </main>
  );
}
