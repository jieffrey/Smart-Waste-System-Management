"use client";

import { useEffect, useEffectEvent, useState } from "react";

const SEARCH_DELAY_MS = 400;

type Props = {
  value: string; // the search currently in the URL
  onSearch: (q: string) => void; // called with the trimmed text after typing pauses
  placeholder: string;
  className?: string;
};

// A search box that keeps its own text while typing and reports it after a short pause, so the URL isn't
// updated on every keystroke. Remount it (change its key) to clear what the user has typed.
export function SearchInput({ value, onSearch, placeholder, className = "" }: Props) {
  const [search, setSearch] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [reportedValue, setReportedValue] = useState(value);

  // When the URL's value changes because of something else (back button, reset), show it. When it's the
  // value we just reported, keep what the user has typed since.
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== reportedValue) {
      setSearch(value);
      setReportedValue(value);
    }
  }

  const report = useEffectEvent((q: string) => {
    setReportedValue(q);
    onSearch(q);
  });

  useEffect(() => {
    const q = search.trim();
    if (q === value) {
      return;
    }
    const timer = setTimeout(() => report(q), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, value]);

  return (
    <input
      type="search"
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      placeholder={placeholder}
      maxLength={100}
      className={className}
    />
  );
}
