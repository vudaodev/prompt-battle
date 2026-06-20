import { useRef, useState } from 'react';

/**
 * Click-to-toggle microphone recorder over MediaRecorder. No silence detection:
 * start() opens the mic, stop() resolves a single audio/webm Blob and releases
 * the mic tracks. Used only to feed the ElevenLabs STT call — input-only.
 */
export function useRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    async function start(): Promise<void> {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
    }

    function stop(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const recorder = recorderRef.current;
            if (!recorder) {
                reject(new Error('Not recording.'));
                return;
            }
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                streamRef.current?.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
                recorderRef.current = null;
                setIsRecording(false);
                resolve(blob);
            };
            recorder.stop();
        });
    }

    return { isRecording, start, stop };
}
