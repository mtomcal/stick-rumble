export function RotateDeviceGate({
  title = 'Rotate Device',
  body = 'Landscape is required for phone gameplay.',
  actionLabel,
  onAction,
}: {
  title?: string
  body?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rotate-device-gate" data-testid="rotate-device-gate">
      <div className="rotate-device-gate__card">
        <h2>{title}</h2>
        <p>{body}</p>
        {actionLabel && onAction ? (
          <button className="rotate-device-gate__action" onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
