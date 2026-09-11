import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bug,
  ClipboardCopy,
  DownloadCloud,
  FileText,
  FolderOpen,
  KeyRound,
  Printer,
  RefreshCw,
  ScrollText,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import {
  clearLog,
  isDesktop,
  listLogs,
  openLogsFolder,
  readLog,
  type LogContent,
  type LogFileInfo,
} from '../store'

const FILE_META: Record<string, { label: string; icon: LucideIcon; hint: string }> = {
  'printer-errors.txt': {
    label: 'Printer errors',
    icon: Printer,
    hint: 'Spooler, driver and drawer-kick failures',
  },
  'auth-errors.txt': {
    label: 'Sign-in errors',
    icon: KeyRound,
    hint: 'Failed logins and PIN lockouts',
  },
  'update-errors.txt': {
    label: 'Update errors',
    icon: DownloadCloud,
    hint: 'Auto-update check and download failures',
  },
  'app-errors.txt': {
    label: 'App errors',
    icon: Bug,
    hint: 'Crashes, save/load failures, anything unexpected',
  },
}
const metaFor = (name: string) =>
  FILE_META[name] ?? { label: name.replace(/\.(txt|log)$/i, ''), icon: FileText, hint: 'Log file' }

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)

interface Props {
  /** File-name fragment to preselect (e.g. 'printer' from the Printers page). */
  focus?: string | null
}

export default function LogsPage({ focus }: Props) {
  const [dir, setDir] = useState('')
  const [files, setFiles] = useState<LogFileInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [doc, setDoc] = useState<LogContent | null>(null)
  const [query, setQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [copied, setCopied] = useState(false)
  const focusUsed = useRef(false)

  const refresh = useCallback(async () => {
    const list = await listLogs()
    setDir(list.dir)
    setFiles(list.files)
    setSelected((cur) => {
      if (cur && list.files.some((f) => f.name === cur)) return cur
      if (!focusUsed.current && focus) {
        focusUsed.current = true
        const hit = list.files.find((f) => f.name.includes(focus))
        if (hit) return hit.name
      }
      return list.files[0]?.name ?? null
    })
  }, [focus])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!selected) return
    let live = true
    void readLog(selected).then((d) => live && setDoc(d))
    return () => {
      live = false
    }
  }, [selected])

  // Gentle live-poll so an error appears while you're watching the page
  useEffect(() => {
    const t = window.setInterval(() => {
      void refresh()
      if (selected) void readLog(selected).then((d) => d && setDoc(d))
    }, 5000)
    return () => window.clearInterval(t)
  }, [refresh, selected])

  // Clear is destructive: two-step confirm that auto-cancels
  useEffect(() => {
    if (!confirmClear) return
    const t = window.setTimeout(() => setConfirmClear(false), 3000)
    return () => window.clearTimeout(t)
  }, [confirmClear])

  // doc is keyed to its file — never show a stale file's content while switching
  const shown = doc && doc.name === selected ? doc : null

  const lines = useMemo(() => {
    const all = (shown?.content ?? '').split('\n').filter((l) => l.trim())
    const q = query.trim().toLowerCase()
    return (q ? all.filter((l) => l.toLowerCase().includes(q)) : all).reverse()
  }, [shown, query])

  const onClear = async () => {
    if (!selected) return
    if (!confirmClear) return setConfirmClear(true)
    setConfirmClear(false)
    await clearLog(selected)
    setDoc(null)
    setSelected(null)
    void refresh()
  }

  const onCopy = () => {
    if (!shown?.content) return
    void navigator.clipboard.writeText(shown.content).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  const sel = files.find((f) => f.name === selected)
  const selMeta = sel ? metaFor(sel.name) : null

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="flex items-start justify-between pt-6">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Logs</h1>
          <p className="text-[12px] font-medium text-neutral-400">
            One error file per problem area — created only when something actually goes wrong
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void refresh()}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[12px] font-bold text-neutral-600 hover:border-primary hover:text-primary"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {isDesktop && (
            <button
              onClick={() => void openLogsFolder()}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[12px] font-bold text-neutral-600 hover:border-primary hover:text-primary"
            >
              <FolderOpen size={14} />
              Open folder
            </button>
          )}
        </div>
      </header>

      {files.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-white px-6 py-16 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <ScrollText size={24} />
          </span>
          <p className="mt-4 text-[14px] font-extrabold">No errors logged</p>
          <p className="mx-auto mt-1 max-w-[420px] text-[11.5px] font-medium leading-relaxed text-neutral-400">
            {isDesktop
              ? `When a printer fails, a login is locked out, or the app hits a problem, a .txt file appears in ${dir || 'the app data folder'}.`
              : 'Error files are written by the desktop app — the browser preview only logs to the console.'}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-[250px_minmax(0,1fr)] items-start gap-4">
          {/* File list */}
          <aside className="flex flex-col gap-2.5">
            {files.map((f) => {
              const meta = metaFor(f.name)
              const Icon = meta.icon
              const active = f.name === selected
              return (
                <button
                  key={f.name}
                  onClick={() => {
                    setSelected(f.name)
                    setConfirmClear(false)
                  }}
                  className={`rounded-2xl border p-3.5 text-left shadow-sm transition-colors ${
                    active
                      ? 'border-primary/50 bg-primary-soft'
                      : 'border-transparent bg-white hover:border-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active ? 'bg-white text-primary' : 'bg-red-50 text-red-500'
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-extrabold">{meta.label}</p>
                      <p className="truncate text-[10px] font-medium text-neutral-400">
                        {fmtSize(f.size)} · {new Date(f.mtime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {meta.hint && (
                    <p className="mt-2 text-[10px] font-medium leading-snug text-neutral-400">{meta.hint}</p>
                  )}
                </button>
              )
            })}
          </aside>

          {/* Viewer */}
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold">
                  {selMeta?.label ?? 'Log'}
                  <span className="ml-2 font-mono text-[10.5px] font-medium text-neutral-400">{sel?.name}</span>
                </p>
                <p className="text-[10.5px] font-medium text-neutral-400">
                  {sel ? `${fmtSize(sel.size)}${shown?.truncated ? ' · showing last 256 KB' : ''} · newest entries first` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-2.5 py-1.5">
                <Search size={12} className="text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter lines…"
                  className="w-32 bg-transparent text-[11.5px] font-medium outline-none placeholder:text-neutral-300"
                />
              </div>
              <button
                onClick={onCopy}
                disabled={!shown?.content}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-bold text-neutral-500 hover:border-primary hover:text-primary disabled:opacity-40"
              >
                <ClipboardCopy size={12} />
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => void onClear()}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                  confirmClear
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'border border-neutral-200 text-neutral-500 hover:border-red-300 hover:text-red-500'
                }`}
              >
                <Trash2 size={12} />
                {confirmClear ? 'Delete file?' : 'Clear'}
              </button>
            </div>
            <pre className="thin-scroll max-h-[520px] min-h-[300px] select-text overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[11px] leading-relaxed text-neutral-700">
              {shown == null
                ? 'Loading…'
                : lines.length
                  ? lines.join('\n')
                  : query
                    ? 'No lines match the filter'
                    : 'File is empty'}
            </pre>
          </section>
        </div>
      )}
    </div>
  )
}
