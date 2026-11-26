import { Link } from 'react-router-dom'
import { store } from './store'

export function PracticeTitleLink({ id, title }: { id: string; title: string }) {
  const tab = store((state) => state.tab)
  const filter = store((state) => state.filter)
  return (
    <Link
      to={`/test-center/practice/${id}`}
      state={{ questionList: { tab, filter } }}
      className="block text-center font-medium hover:underline"
    >
      {title}
    </Link>
  )
}
