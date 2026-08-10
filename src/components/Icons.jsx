function Icon({ children, className = '', size = 24 }) {
  return (
    <svg
      className={`line-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function WaymarkIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="6" r="2.5" />
      <path d="M8.2 16.2c2.4-1.3 1.8-4.3 4.1-5.3 1.7-.7 3.2.1 4-2.5" />
      <path d="m15.2 4.8 2.5 1.2-1.2 2.5" />
    </Icon>
  )
}

export function TextPollIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 3.5h10l4 4V20.5H5z" />
      <path d="M15 3.5v4h4M8.2 11h7.6M8.2 14.5h5.6M8.2 18h3.5" />
    </Icon>
  )
}

export function DatePollIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
      <circle cx="8" cy="14" r="1" />
      <circle cx="12" cy="14" r="1" />
      <circle cx="16" cy="14" r="1" />
    </Icon>
  )
}

export function AppointmentPollIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="13.5" height="14" rx="2" />
      <path d="M7 2.5v4M13.5 2.5v4M3.5 8.5H17" />
      <circle cx="16.5" cy="16.5" r="4" />
      <path d="M16.5 14.3v2.4l1.6 1" />
    </Icon>
  )
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 12h15M14 7l5 5-5 5" />
    </Icon>
  )
}

export function LinkIcon(props) {
  return (
    <Icon {...props}>
      <path d="m9.5 14.5 5-5" />
      <path d="M7.2 17.8 5.7 19.3a3.5 3.5 0 0 1-5-5l3.1-3.1a3.5 3.5 0 0 1 4.9 0" transform="translate(2)" />
      <path d="m14.8 6.2 1.5-1.5a3.5 3.5 0 0 1 5 5l-3.1 3.1a3.5 3.5 0 0 1-4.9 0" transform="translate(-2)" />
    </Icon>
  )
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.2 4L19 6.8" />
    </Icon>
  )
}
