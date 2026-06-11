export function ArcBackground() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <svg
          viewBox="0 0 900 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -right-[200px] -top-[200px] h-[900px] w-[900px] opacity-50"
        >
          <circle cx="450" cy="450" r="440" stroke="#1652F0" strokeWidth="1" strokeOpacity="0.12" />
          <circle cx="450" cy="450" r="360" stroke="#1652F0" strokeWidth="1" strokeOpacity="0.10" />
          <circle cx="450" cy="450" r="280" stroke="#1652F0" strokeWidth="1" strokeOpacity="0.08" />
          <circle cx="450" cy="450" r="200" stroke="#1652F0" strokeWidth="1" strokeOpacity="0.06" />
          <circle cx="450" cy="450" r="120" stroke="#1652F0" strokeWidth="1" strokeOpacity="0.05" />
          <path
            d="M 50 450 A 400 400 0 0 1 450 50"
            stroke="#1652F0"
            strokeWidth="1.5"
            strokeOpacity="0.18"
          />
        </svg>
      </div>

      <svg
        viewBox="0 0 700 700"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="pointer-events-none fixed -bottom-[300px] -left-[300px] z-0 h-[700px] w-[700px] opacity-40"
        aria-hidden="true"
      >
        <circle cx="350" cy="350" r="340" stroke="#1652F0" strokeWidth="1" strokeOpacity="0.08" />
        <circle cx="350" cy="350" r="260" stroke="#1652F0" strokeWidth="1" strokeOpacity="0.06" />
        <circle cx="350" cy="350" r="180" stroke="#1652F0" strokeWidth="1" strokeOpacity="0.05" />
      </svg>
    </>
  );
}
