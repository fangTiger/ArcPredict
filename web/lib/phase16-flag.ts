// 仅在显式开启时渲染 Phase 16+ 新组件。
export function isPhase16Enabled(): boolean {
  return process.env.NEXT_PUBLIC_PHASE16_ENABLED === 'true';
}
