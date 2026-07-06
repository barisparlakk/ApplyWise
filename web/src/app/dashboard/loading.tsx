export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="h-5 w-28 rounded-md bg-muted" />
        <div className="mt-3 h-9 w-full max-w-xl rounded-md bg-muted" />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div className="rounded-md border border-border bg-white p-4" key={item}>
              <div className="h-4 w-32 rounded-md bg-muted" />
              <div className="mt-4 h-9 w-16 rounded-md bg-muted" />
              <div className="mt-3 h-4 w-44 rounded-md bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div className="rounded-md border border-border bg-white p-5" key={item}>
              <div className="h-5 w-40 rounded-md bg-muted" />
              <div className="mt-5 space-y-3">
                <div className="h-16 rounded-md bg-muted" />
                <div className="h-16 rounded-md bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
