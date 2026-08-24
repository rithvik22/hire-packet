"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="desk">
      <div className="blotter">
        <h1>Something broke.</h1>
        <p className="lede">Reload the page or generate a new packet.</p>
        <button type="button" className="btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
