export function Button({ variant = 'primary', size = 'md', className = '', loading, children, ...props }) {
  const variants = { primary: 'bg-brand-600 text-white hover:bg-brand-700 border-brand-600', secondary: 'bg-white text-[#26352e] hover:bg-gray-50 border-[#d5dcd7]', danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600', ghost: 'bg-transparent border-transparent hover:bg-gray-100 text-[#34423b]' }
  const sizes = { sm: 'min-h-8 px-3 text-xs', md: 'min-h-10 px-4 text-sm', lg: 'min-h-12 px-5 text-sm' }
  return <button className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${className}`} disabled={loading || props.disabled} {...props}>{loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}{children}</button>
}
