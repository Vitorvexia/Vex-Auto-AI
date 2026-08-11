import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  chat: (
    <>
      <path d="M4 4h16v11H8l-4 4V4Z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  score: (
    <>
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 2v10l7-7" />
    </>
  ),
  loop: (
    <>
      <path d="M4 12a8 8 0 0 1 14.5-4.6M20 12a8 8 0 0 1-14.5 4.6" />
      <path d="M18.5 3v4.4H14M5.5 21v-4.4H10" />
    </>
  ),
  handoff: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="16" r="3" />
      <path d="M10.5 9.5 14.5 13.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2 20h20" />
    </>
  ),
};

export function StepIcon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
