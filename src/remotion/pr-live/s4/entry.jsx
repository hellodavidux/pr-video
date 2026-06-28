import { MessageActions } from './src/features/ask-cal/components/MessageActions.tsx';

export default function PRComponentPreview({ demoState = {} }) {
  const highlight = demoState.highlightTarget ?? '';
  const phase = demoState.demoPhase ?? '';
  const focusRef = demoState.focusRef ?? '';
  const hideRest = demoState.hideRest ? 'true' : 'false';
  const targetScale = demoState.targetScale ?? 1;
  const focusCss = focusRef
    ? `#pr-preview-root[data-demo-focus-ref="${focusRef}"] [data-demo-ref="${focusRef}"] { opacity: 1 !important; filter: none !important; transform: scale(${targetScale}); z-index: 40; position: relative; }`
    : '';
  return (
    <>
      {focusCss ? <style dangerouslySetInnerHTML={{ __html: focusCss }} /> : null}
      <div
        className="min-h-screen p-4"
        style={{ minHeight: '100vh', background: '#101010', '--demo-target-scale': targetScale }}
        data-demo-highlight={highlight}
        data-demo-phase={phase}
        data-demo-focus-ref={focusRef}
        data-demo-hide-rest={hideRest}
        id="pr-preview-root"
      >
        <MessageActions
          demoState={demoState} />
      </div>
    </>
  );
}
