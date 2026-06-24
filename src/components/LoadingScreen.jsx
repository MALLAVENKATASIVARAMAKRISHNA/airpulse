import Logo from './Logo'

export default function LoadingScreen() {
  return (
    <main className="loading-screen">
      <Logo />
      <span className="spinner" aria-label="Loading" />
    </main>
  )
}
