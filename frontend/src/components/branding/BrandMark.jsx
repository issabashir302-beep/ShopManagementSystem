export function BrandMark({ className = '', title = 'Dukani' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${title} logo`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="12" fill="#145c49" />
      <path d="M10 18.2 13.5 10h21l3.5 8.2v2.1a5 5 0 0 1-8 4 5 5 0 0 1-6 0 5 5 0 0 1-6 0 5 5 0 0 1-8-4v-2.1Z" fill="#f4f3ec" />
      <path d="M14 27.2v10.3h20V27.2a7.8 7.8 0 0 1-4-1.2 7.8 7.8 0 0 1-6 0 7.8 7.8 0 0 1-6 0 7.8 7.8 0 0 1-4 1.2Z" fill="#f4f3ec" />
      <path d="M17.5 30.3h8v7.2h-8z" fill="#8fcbb4" />
      <path d="M28.5 29.2h3v8.3h-3z" fill="#145c49" />
      <circle cx="30" cy="33.3" r=".75" fill="#f0bd62" />
      <path d="M18 18.2 19.4 10h4.4l.2 8.2v2.1a3 3 0 0 1-6 0v-2.1Zm12 0L28.6 10h-4.4l-.2 8.2v2.1a3 3 0 0 0 6 0v-2.1Z" fill="#8fcbb4" />
    </svg>
  )
}
