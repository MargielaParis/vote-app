import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ToastProvider } from './components/Toast.jsx'
import HomePage from './routes/HomePage.jsx'
import CreatePage from './routes/CreatePage.jsx'
import CreatedPage from './routes/CreatedPage.jsx'
import PollPage from './routes/PollPage.jsx'
import ResultsPage from './routes/ResultsPage.jsx'
import ManagePage from './routes/ManagePage.jsx'
import HistoryPage from './routes/HistoryPage.jsx'
import NotFoundPage from './routes/NotFoundPage.jsx'

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/new', element: <CreatePage /> },
  { path: '/mine', element: <HistoryPage /> },
  { path: '/p/:id', element: <PollPage /> },
  { path: '/p/:id/share', element: <CreatedPage /> },
  { path: '/p/:id/result', element: <ResultsPage /> },
  { path: '/p/:id/manage', element: <ManagePage /> },
  { path: '*', element: <NotFoundPage /> },
])

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
