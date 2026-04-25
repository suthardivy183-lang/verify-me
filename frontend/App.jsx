function AppShell() {
  const {
    HashRouter,
    NavLink,
    Navigate,
    Routes,
    Route,
  } = ReactRouterDOM;
  const {
    BackgroundGlow,
    ShieldIcon,
    DashboardIcon,
    VerifyIcon,
    HistoryIcon,
    ReportsIcon,
    SettingsIcon,
    MenuIcon,
    CloseIcon,
  } = window.VerifyMeUI;

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: <DashboardIcon className="h-5 w-5" /> },
    { to: "/verify", label: "Verify New", icon: <VerifyIcon className="h-5 w-5" /> },
    { to: "/history", label: "History", icon: <HistoryIcon className="h-5 w-5" /> },
    { to: "/reports", label: "Reports", icon: <ReportsIcon className="h-5 w-5" />, disabled: true },
    { to: "/settings", label: "Settings", icon: <SettingsIcon className="h-5 w-5" />, disabled: true },
  ];

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/20 text-accent ring-1 ring-accent/35">
              <ShieldIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">VerifyMe</p>
              <p className="text-xs tracking-[0.2em] text-muted">Trust Engine</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6">
          <div className="space-y-2">
            {navItems.map((item) => (
              item.disabled ? (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-muted/70"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? "bg-white/[0.08] text-accent ring-1 ring-accent/25"
                      : "text-muted hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-accent shadow-[0_0_18px_rgba(120,230,255,0.9)]" /> : null}
                      <span className="transition-transform duration-300 group-hover:translate-x-0.5">{item.icon}</span>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              )
            ))}
          </div>
        </nav>

        <div className="border-t border-white/10 px-5 py-5">
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">Org: demo_org</p>
            <p className="mt-1 text-xs text-sky-100/80">Live API connected to localhost:8000</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070e] text-ink">
      <BackgroundGlow />

      <div className="relative z-10 min-h-screen">
        <div className="lg:hidden">
          <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#070b14]/85 px-4 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-accent ring-1 ring-accent/35">
                <ShieldIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-white">VerifyMe</p>
                <p className="text-xs text-muted">Command Center</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="rounded-2xl border border-white/15 bg-white/[0.08] p-3 text-white"
            >
              {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>

          {mobileOpen ? (
            <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
              <aside
                className="h-full w-[280px] border-r border-white/10 bg-[#090f1b]/95 backdrop-blur-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <SidebarContent />
              </aside>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-screen">
          <aside className="hidden w-[224px] shrink-0 border-r border-white/10 bg-[#090f1b]/85 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:block">
            <SidebarContent />
          </aside>

          <main className="w-full px-4 py-5 sm:px-6 lg:ml-[224px] lg:px-8 lg:py-8">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<window.DashboardPage />} />
              <Route path="/verify" element={<window.VerifyPage />} />
              <Route path="/history" element={<window.HistoryPage />} />
              <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
              <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function renderBootError(message) {
  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#091016;color:#e5eef7;font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;">
      <div style="max-width:640px;width:100%;border:1px solid rgba(239,68,68,.2);background:rgba(127,29,29,.18);border-radius:24px;padding:28px;">
        <div style="font-size:24px;font-weight:800;">Frontend failed to load</div>
        <div style="margin-top:12px;font-size:14px;line-height:1.6;color:#fecaca;">${message}</div>
      </div>
    </div>
  `;
}

function bootstrapApp(attempt = 0) {
  const ready =
    typeof React !== "undefined" &&
    typeof ReactDOM !== "undefined" &&
    typeof ReactRouterDOM !== "undefined" &&
    window.VerifyMeUI &&
    window.DashboardPage &&
    window.VerifyPage &&
    window.HistoryPage;

  if (!ready) {
    if (attempt >= 80) {
      renderBootError("One or more frontend scripts did not finish loading. Hard refresh the page once, and if it still fails open the browser console to see which script/CDN request failed.");
      return;
    }

    window.setTimeout(() => bootstrapApp(attempt + 1), 50);
    return;
  }

  const { HashRouter } = ReactRouterDOM;
  ReactDOM.createRoot(document.getElementById("root")).render(
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

bootstrapApp();
