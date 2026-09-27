type CheckIconProps = {
  className?: string;
};

export function CheckIcon({ className = "size-2.5" }: CheckIconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill="none">
      <path
        d="m3.5 8.3 2.8 2.7 6.2-6.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}
