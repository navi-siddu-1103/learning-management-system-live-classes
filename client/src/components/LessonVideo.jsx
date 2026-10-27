import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

// Same base URL the rest of the app uses
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function LessonVideo({ videoJobId }) {
  const videoRef = useRef(null);
  const [playbackError, setPlaybackError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (!videoJobId) {
      setPlaybackError('Video job ID is missing.');
      return undefined;
    }

    const token = localStorage.getItem('learnlive_token');
    if (!token) {
      setPlaybackError('Please sign in again to watch this video.');
      return undefined;
    }

    const playlistUrl = `${API}/uploads/video/${encodeURIComponent(videoJobId)}/playlist`;
    let hls = null;
    let cancelled = false;

    setPlaybackError('');

    async function start() {
      // Pre-flight check: shows the real HTTP status instead of a vague HLS error.
      // You can delete this block once playback works.
      try {
        const res = await fetch(playlistUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (!res.ok) {
          setPlaybackError(`Playlist request failed (HTTP ${res.status}).`);
          return;
        }

        const text = await res.text();
        if (!text.trimStart().startsWith('#EXTM3U')) {
          setPlaybackError(
            'Server did not return an HLS playlist. Check the API URL / Vite proxy.'
          );
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setPlaybackError('Cannot reach the video server (network or CORS error).');
        }
        return;
      }

      if (Hls.isSupported()) {
        hls = new Hls({
          // Sent on the playlist AND every .ts segment request
          xhrSetup: (xhr) => {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          },
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => setPlaybackError(''));

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error('HLS error:', data.type, data.details, data.response?.code);

          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            const code = data.response?.code;
            setPlaybackError(
              code
                ? `Video request failed (HTTP ${code}). Check the .ts segment requests in Network.`
                : 'Network error while loading the video.'
            );
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setPlaybackError('Unable to play this video.');
            hls.destroy();
          }
        });

        hls.loadSource(playlistUrl);
        hls.attachMedia(video);
      } else {
        // Safari's native HLS can't send an Authorization header
        setPlaybackError('This browser needs a different playback method for protected videos.');
      }
    }

    start();

    return () => {
      cancelled = true;
      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [videoJobId]);

  return (
    <div className="lesson-video">
      <video ref={videoRef} controls width="100%" preload="metadata">
        Your browser does not support video playback.
      </video>

      {playbackError && (
        <p role="alert" style={{ color: '#c0392b', marginTop: 8 }}>
          {playbackError}
        </p>
      )}
    </div>
  );
}