import { Download, RefreshCw } from 'lucide-react'
import type { UpdateInfo } from '../store'

interface Props {
  version: string
  status: {
    status: 'idle' | 'checking' | 'none' | 'found' | 'error' | 'dev'
    version?: string
    message?: string
  }
  downloaded: UpdateInfo | null
  onCheck: () => Promise<void>
  onInstall: () => void
}

export default function LoginUpdatePanel({ version, status, downloaded, onCheck, onInstall }: Props) {
  const busy = status.status === 'checking' || status.status === 'found'
  const currentVersion = version === 'dev' || version === 'Browser preview'
    ? 'Browser preview'
    : version ? `Current version: v${version}` : 'Current version: Loading…'
  const messages: Record<Props['status']['status'], string> = {
    idle: 'Check for a newer version before signing in.',
    checking: 'Checking for updates…',
    none: "You're using the latest version.",
    found: status.version ? `Downloading v${status.version}…` : 'Downloading update…',
    error: 'Could not check for updates. Please try again.',
    dev: 'Updates are available in the installed app.',
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold text-neutral-700">{currentVersion}</p>
        <p role="status" className={`mt-1 text-[11px] font-medium ${status.status === 'error' && !downloaded ? 'text-red-500' : 'text-neutral-400'}`}>
          {downloaded ? `Update v${downloaded.version} is ready to install.` : messages[status.status]}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void onCheck()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-[11px] font-extrabold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
        >
          <RefreshCw size={13} className={busy ? 'animate-spin' : undefined} />
          Check for Updates
        </button>
        {downloaded && (
          <button
            onClick={onInstall}
            className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-[11px] font-extrabold text-white hover:bg-primary-dark"
          >
            <Download size={13} />
            Restart & Update
          </button>
        )}
      </div>
    </div>
  )
}
