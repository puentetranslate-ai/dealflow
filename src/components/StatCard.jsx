export default function StatCard({ label, value, warning = false, small = false }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm flex flex-col items-center justify-center text-center min-h-[80px]">
      <p className={`font-bold leading-tight ${small ? 'text-base' : 'text-2xl'} ${warning ? 'text-orange-500' : 'text-navy'}`}>
        {value}
      </p>
      <p className="text-muted text-xs mt-1 leading-tight">{label}</p>
    </div>
  )
}
