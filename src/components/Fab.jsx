import { useNavigate } from 'react-router-dom'
import { PlusIcon } from './Icon'

export default function Fab({ to = '/deals/new', label = 'New Deal' }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="fab"
      aria-label={label}
    >
      <PlusIcon className="w-7 h-7 text-navy" />
    </button>
  )
}
