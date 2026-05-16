import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <form className="flex flex-col gap-2 max-w-sm mx-auto mt-20">
      <label className="flex flex-col gap-1">
        Email
        <input
          name="email"
          type="email"
          required
          className="border p-2 w-full"
        />
      </label>
      <label className="flex flex-col gap-1">
        Password
        <input
          name="password"
          type="password"
          required
          className="border p-2 w-full"
        />
      </label>
      <button formAction={login} className="bg-black text-white p-2">
        Log in
      </button>
      <button formAction={signup} className="border p-2">
        Sign up
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {message && <p className="text-green-700 text-sm">{message}</p>}
    </form>
  )
}
