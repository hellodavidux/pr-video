/* __PR_GENERIC_DEMO__ */
type RichTextProps = {
  content: string;
};

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-medium text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("_") && part.endsWith("_")) {
      return (
        <em key={key} className="text-cal-subtle not-italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

export function RichText({ content , demoState = {}}: RichTextProps & { demoState?: Record<string, unknown> }) {
  const { open = false,  scheduleOpen = false,  redirectOpen = false,  typedText = '',  redirectTypedText = '',  demoHoverTrigger = false,  hoverInput = false,  demoHoverSubmit = false,  demoHoverExpand = false,  demoHoverDropdown = false,  modalEntrance = 0,  revealStep = -1,  dropdownOpen = false,  expanded = false,  showPayoff = false,  highlightTarget = '',  focusRef = '' } = demoState;
  return (
    <>
      {content.split("\n").map((line, index) => (
        <span key={index} className="block">
          {renderInline(line, `line-${index}`)}
        </span>
      ))}
    </>
  );
}
