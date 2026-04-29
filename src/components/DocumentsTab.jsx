import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'
import LoadingSpinner from './LoadingSpinner'
import { CameraIcon, FileIcon, TrashIcon, ArrowRightIcon, InfoIcon } from './Icon'

const BUCKET = 'deal-documents'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ACCEPT = 'image/jpeg,image/png,image/heic,application/pdf'

// Documents tab body. Uploads files to Supabase Storage at
//   {user_id}/{deal_id}/{timestamp}-{filename}
// then writes a metadata row to the `documents` table. Files are listed
// from the table; downloads use signed URLs (since the bucket is private).

export default function DocumentsTab({ deal }) {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const fetchDocs = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('deal_id', deal.id)
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
    if (!error) setDocs(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchDocs() }, [deal.id])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so the same file can be picked twice
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError(`File too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB.`)
      return
    }
    setError(null)
    setUploading(true)

    const ts = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${deal.id}/${ts}-${safeName}`

    const { error: uploadErr } = await supabase
      .storage.from(BUCKET).upload(path, file, { contentType: file.type })

    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }

    const { data: row, error: dbErr } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        deal_id: deal.id,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        storage_path: path,
      })
      .select().single()

    if (dbErr) {
      // Roll back the storage upload to avoid orphans
      await supabase.storage.from(BUCKET).remove([path])
      setError(dbErr.message)
      setUploading(false)
      return
    }

    setDocs((prev) => [row, ...prev])
    setUploading(false)
  }

  const handleView = async (doc) => {
    // Signed URL valid for 1 hour
    const { data, error } = await supabase
      .storage.from(BUCKET).createSignedUrl(doc.storage_path, 3600)
    if (error || !data?.signedUrl) {
      setError('Could not generate file URL.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    await supabase.storage.from(BUCKET).remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id).eq('user_id', user.id)
  }

  return (
    <div className="space-y-5">
      {/* Compliance disclaimer */}
      <div className="flex items-start gap-2 px-1 text-muted text-xs italic">
        <InfoIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p className="leading-snug">
          For personal reference only. Maintain official records with your broker of record per your state's requirements.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Upload dropzone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-navy/20 hover:border-gold rounded-2xl p-8 text-center transition-colors bg-white disabled:opacity-60"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileChange}
          capture="environment"
          className="hidden"
        />
        <div className="w-14 h-14 mx-auto rounded-xl bg-gold/15 text-gold-dark flex items-center justify-center">
          {uploading ? <LoadingSpinner /> : <CameraIcon className="w-6 h-6" />}
        </div>
        <p className="font-display text-lg font-bold text-navy mt-3">
          {uploading ? 'Uploading…' : 'Tap to upload or take photo'}
        </p>
        <p className="text-muted text-xs mt-1">
          Images (JPG, PNG, HEIC) or PDF · max 10MB
        </p>
      </button>

      {/* Documents list */}
      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : docs.length === 0 ? (
        <div className="card text-center py-10 px-4">
          <FileIcon className="w-10 h-10 text-navy/15 mx-auto mb-2" />
          <p className="text-navy font-semibold">No documents uploaded yet</p>
          <p className="text-muted text-sm mt-1">
            Tap above to add inspection reports, contracts, or photos.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-navy/[0.05]">
          {docs.map((doc) => (
            <div key={doc.id} className="p-4 flex items-center gap-3">
              <span className="text-2xl shrink-0">{fileEmoji(doc.file_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-navy font-semibold text-sm truncate">{doc.file_name}</p>
                <p className="text-muted text-xs">
                  {formatBytes(doc.file_size)} · {formatDate(doc.uploaded_at)}
                </p>
              </div>
              <button
                onClick={() => handleView(doc)}
                className="bg-gold/15 hover:bg-gold/25 text-gold-dark text-xs font-bold uppercase tracking-wider rounded-lg px-3 h-9 flex items-center gap-1 transition-colors"
              >
                View
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(doc)}
                aria-label="Delete"
                className="w-9 h-9 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fileEmoji(type) {
  if (!type) return '📄'
  if (type.startsWith('image/')) return '🖼️'
  if (type === 'application/pdf') return '📄'
  return '📎'
}

function formatBytes(b) {
  if (b == null) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
