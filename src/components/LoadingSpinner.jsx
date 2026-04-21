export default function LoadingSpinner({ size = 'md', light = false }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div
      className={`${sizes[size]} animate-spin rounded-full border-2 ${
        light
          ? 'border-white/30 border-t-white'
          : 'border-navy/20 border-t-navy'
      }`}
    />
  )
}
