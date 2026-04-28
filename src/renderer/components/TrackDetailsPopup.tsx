import React, { useEffect, useRef, useState } from 'react';
import type { Track, TrackDetails } from '../../shared/types';
import { CloseIcon } from './Icons';
import { AlbumCover } from './AlbumCover';
import { formatTime } from '../hooks/usePlayer';

interface Props {
  track: Track;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSampleRate(hz: number): string {
  const k = hz / 1000;
  return Number.isInteger(k) ? `${k} kHz` : `${k.toFixed(1)} kHz`;
}

function formatChannels(n: number): string {
  if (n === 1) return 'Mono';
  if (n === 2) return 'Stereo';
  if (n === 6) return '5.1 surround';
  if (n === 8) return '7.1 surround';
  return `${n} channels`;
}

export const TrackDetailsPopup: React.FC<Props> = ({ track, onClose }) => {
  const [details, setDetails] = useState<TrackDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Notes state
  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const lastSavedNotes = useRef('');
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    window.api.getTrackDetails(track.filePath).then((d) => {
      if (cancelled) return;
      if (d) setDetails(d); else setError(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [track.filePath]);

  // Load notes for this track
  useEffect(() => {
    let cancelled = false;
    setNotesLoaded(false);
    window.api.getNote(track.filePath).then((existing) => {
      if (cancelled) return;
      setNotes(existing);
      lastSavedNotes.current = existing;
      setNotesLoaded(true);
    });
    return () => { cancelled = true; };
  }, [track.filePath]);

  // Persist notes (debounced) when text changes after initial load.
  // We persist on every meaningful change after a 600ms quiet period, AND on
  // popup close — see the cleanup function below.
  useEffect(() => {
    if (!notesLoaded) return;
    if (notes === lastSavedNotes.current) return;

    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      setNotesSaving(true);
      window.api.setNote(track.filePath, notes)
        .then(() => { lastSavedNotes.current = notes; })
        .finally(() => setNotesSaving(false));
      saveTimer.current = null;
    }, 600);

    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [notes, notesLoaded, track.filePath]);

  // Force-save on close if there's a pending change
  useEffect(() => {
    return () => {
      if (notesLoaded && notes !== lastSavedNotes.current) {
        // Fire-and-forget — popup is closing
        window.api.setNote(track.filePath, notes).catch(() => {});
      }
    };
  }, [notes, notesLoaded, track.filePath]);

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const showInFolder = () => {
    window.api.showInFolder(track.filePath);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onBackdropClick}>
      <div className="modal track-details-modal">
        <div className="modal-header">
          <div className="modal-title">Track details</div>
          <button className="modal-close" onClick={onClose} title="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="track-details-top">
            <AlbumCover trackPath={track.filePath} alt={track.album} className="track-details-cover" />
            <div className="track-details-summary">
              <div className="track-details-eyebrow">{track.artist}</div>
              <div className="track-details-title">{track.title}</div>
              <div className="track-details-album">{track.album}</div>
              {track.year && (
                <div className="track-details-meta-line">
                  {track.year}{track.genre ? ` • ${track.genre}` : ''}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="track-details-loading">Reading file…</div>
          ) : error || !details ? (
            <div className="track-details-error">Couldn't read file. It may have moved or been deleted.</div>
          ) : (
            <div className="track-details-grid">
              <DetailRow label="Format" value={details.format.toUpperCase()} />
              <DetailRow label="Duration" value={formatTime(details.duration)} />
              <DetailRow label="Bitrate" value={details.bitrate ? `${details.bitrate} kbps` : 'Unknown'} />
              <DetailRow label="Sample rate" value={details.sampleRate ? formatSampleRate(details.sampleRate) : 'Unknown'} />
              <DetailRow label="Channels" value={details.channels ? formatChannels(details.channels) : 'Unknown'} />
              <DetailRow label="File size" value={formatBytes(details.fileSize)} />
              <DetailRow label="Track number" value={track.trackNumber > 0 ? `${track.trackNumber}` : '—'} />
              <DetailRow label="Disc number" value={track.diskNumber > 0 ? `${track.diskNumber}` : '—'} />
              <DetailRow label="Album artist" value={track.albumArtist} />
              <DetailRow label="File name" value={details.fileName} mono />

              <div className="detail-row detail-row-full">
                <div className="detail-label">File path</div>
                <button
                  type="button"
                  className="detail-value detail-value-mono detail-value-link"
                  onClick={showInFolder}
                  title="Show in folder"
                >
                  {details.filePath}
                </button>
              </div>
            </div>
          )}

          {/* ---------- Notes ---------- */}
          <div className="track-details-notes">
            <div className="track-details-notes-header">
              <div className="detail-label">Notes</div>
              <div className="track-details-notes-status">
                {notesSaving ? 'Saving…' : notesLoaded && notes !== lastSavedNotes.current ? 'Unsaved' : ''}
              </div>
            </div>
            <textarea
              className="track-details-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this track…"
              disabled={!notesLoaded}
              rows={4}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string; mono?: boolean; full?: boolean }> = ({ label, value, mono, full }) => (
  <div className={`detail-row ${full ? 'detail-row-full' : ''}`}>
    <div className="detail-label">{label}</div>
    <div className={`detail-value ${mono ? 'detail-value-mono' : ''}`}>{value}</div>
  </div>
);
