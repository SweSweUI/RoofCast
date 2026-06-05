import { redirect } from 'next/navigation';

// Dashboard-first: no landing page. The CFO 13-week view is the home screen.
export default function Home() {
  redirect('/cfo');
}
