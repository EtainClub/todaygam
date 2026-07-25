import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: Props & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const TodayIcon = (props: Props) => (
  <Icon {...props}><path d="M5 5.5h14v14H5z" /><path d="M8 3.5v4M16 3.5v4M5 9.5h14" /><path d="m9 14 2 2 4-4" /></Icon>
);
export const StatsIcon = (props: Props) => (
  <Icon {...props}><path d="M5 19V9M12 19V5M19 19v-7" /><path d="M3 19.5h18" /></Icon>
);
export const SettingsIcon = (props: Props) => (
  <Icon {...props}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.5 1a7 7 0 0 0-1.7-1L14.4 3h-4l-.5 3.1a7 7 0 0 0-1.7 1l-2.5-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.5-1a7 7 0 0 0 1.7 1l.5 3.1h4l.5-3.1a7 7 0 0 0 1.7-1l2.5 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></Icon>
);
export const LockIcon = (props: Props) => (
  <Icon {...props}><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
);
export const PlusIcon = (props: Props) => (
  <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>
);
export const ChevronRightIcon = (props: Props) => (
  <Icon {...props}><path d="m9 5 7 7-7 7" /></Icon>
);
export const CloseIcon = (props: Props) => (
  <Icon {...props}><path d="m5 5 14 14M19 5 5 19" /></Icon>
);
export const CheckIcon = (props: Props) => (
  <Icon {...props}><path d="m4 12 5 5L20 6" /></Icon>
);
export const ArrowLeftIcon = (props: Props) => (
  <Icon {...props}><path d="m15 5-7 7 7 7" /></Icon>
);
export const DownloadIcon = (props: Props) => (
  <Icon {...props}><path d="M12 3v12M7 10l5 5 5-5M5 20h14" /></Icon>
);
export const TrashIcon = (props: Props) => (
  <Icon {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></Icon>
);
export const BellIcon = (props: Props) => (
  <Icon {...props}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></Icon>
);
export const CloudIcon = (props: Props) => (
  <Icon {...props}><path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 4.8 4.8 0 0 0 7 18Z" /></Icon>
);
