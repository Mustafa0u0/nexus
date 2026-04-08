'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Mic,
  RefreshCcw,
  SkipForward,
  Sparkles,
  Video,
} from 'lucide-react';
import { chatLoop, completeInterview, getInterviewState, setupInterview, startInterview, uploadVideo } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  InterviewTranscript,
  LoadingState,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeader,
  StatusBadge,
  TopNav,
  fadeUp,
  stagger,
} from '@/components/nexus-ui';

const navItems = [{ href: '/employee', label: 'Dashboard', icon: LayoutDashboard }];

const phaseProgress = {
  loading: 12,
  setup: 28,
  ready: 48,
  interviewing: 78,
  complete: 100,
};

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus';
  return 'video/webm';
}

export default function InterviewPage() {
  const { id: appId } = useParams();
  const user = useStoredUser('employee');
  const [phase, setPhase] = useState('loading');
  const [sessionId, setSessionId] = useState(null);
  const [statusText, setStatusText] = useState('Initializing interview session…');
  const [transcript, setTranscript] = useState('Preparing your personalized AI interview.');
  const [speakerLabel, setSpeakerLabel] = useState('Mihna');
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [isResumingSession, setIsResumingSession] = useState(false);
  const [recordingSavedPath, setRecordingSavedPath] = useState('');
  const [localRecordingUrl, setLocalRecordingUrl] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);
  const currentAudioUrlRef = useRef(null);
  const currentAiSourceRef = useRef(null);
  const sessionStreamRef = useRef(null);
  const sessionAudioStreamRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const webcamVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const mixedAudioDestinationRef = useRef(null);

  const releaseCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }

    if (currentAiSourceRef.current) {
      try {
        currentAiSourceRef.current.disconnect();
      } catch {
        // no-op
      }
      currentAiSourceRef.current = null;
    }

    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
  }, []);

  const cleanupSessionMedia = useCallback(async () => {
    releaseCurrentAudio();

    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
    }

    if (sessionStreamRef.current) {
      sessionStreamRef.current.getTracks().forEach(track => track.stop());
      sessionStreamRef.current = null;
    }

    sessionAudioStreamRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close().catch(() => {});
    }

    audioContextRef.current = null;
    mixedAudioDestinationRef.current = null;
  }, [releaseCurrentAudio]);

  const restoreInterviewState = useCallback(async (currentAppId, currentSessionId) => {
    const state = await getInterviewState(currentAppId);

    setSessionId(state.session_id || currentSessionId);
    setSpeakerLabel(state.prompt_speaker || 'Mihna');
    setRecordingSavedPath(state.video_path || '');

    if (state.status === 'completed') {
      setPhase('complete');
      setStatusText('Interview complete');
      setTranscript(state.current_prompt || 'Thank you. Your interview has been submitted successfully.');
      return state;
    }

    if (state.status === 'interviewing') {
      setPhase('interviewing');
      setStatusText('Session restored. Press start answer.');
      setTranscript(state.current_prompt || 'Your current question was restored.');
      return state;
    }

    setPhase('ready');
    setStatusText('Ready to begin');
    setTranscript('Everything is prepared. When you are in a quiet place, start the interview.');
    return state;
  }, []);

  useEffect(() => {
    return () => {
      cleanupSessionMedia();
      if (localRecordingUrl) URL.revokeObjectURL(localRecordingUrl);
    };
  }, [cleanupSessionMedia, localRecordingUrl]);

  const startSessionRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const audioContext = new window.AudioContext();
    await audioContext.resume().catch(() => {});

    const mixedAudioDestination = audioContext.createMediaStreamDestination();
    const microphoneSource = audioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    microphoneSource.connect(mixedAudioDestination);

    const recorderStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...mixedAudioDestination.stream.getAudioTracks(),
    ]);

    sessionStreamRef.current = stream;
    sessionAudioStreamRef.current = new MediaStream(stream.getAudioTracks());
    recordingStreamRef.current = recorderStream;
    audioContextRef.current = audioContext;
    mixedAudioDestinationRef.current = mixedAudioDestination;

    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = stream;
    }

    setRecordingSavedPath('');
    setLocalRecordingUrl(previousUrl => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return '';
    });

    const recorder = new MediaRecorder(recorderStream, { mimeType: getSupportedMimeType() });
    videoChunksRef.current = [];
    recorder.ondataavailable = event => {
      if (event.data.size > 0) videoChunksRef.current.push(event.data);
    };
    recorder.start(1000);
    videoRecorderRef.current = recorder;
  }, []);

  const ensureSessionMedia = useCallback(async () => {
    if (sessionAudioStreamRef.current && sessionStreamRef.current) {
      if (webcamVideoRef.current && webcamVideoRef.current.srcObject !== sessionStreamRef.current) {
        webcamVideoRef.current.srcObject = sessionStreamRef.current;
      }
      return true;
    }

    setIsResumingSession(true);
    setError('');
    try {
      await startSessionRecording();
      return true;
    } catch (resumeError) {
      setError(resumeError.message || 'Camera and microphone access are required to resume the interview.');
      return false;
    } finally {
      setIsResumingSession(false);
    }
  }, [startSessionRecording]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadInterview() {
      setError('');
      setPhase('setup');
      setStatusText('Analyzing CV and role brief…');
      setTranscript('Your interview session is being prepared.');

      try {
        const data = await setupInterview(appId);
        if (!mounted) return;
        if (data.error) {
          setError(data.error);
          return;
        }

        setSessionId(data.session_id);

        if (data.status === 'interviewing' || data.status === 'completed') {
          setStatusText('Restoring interview session…');
          const state = await restoreInterviewState(appId, data.session_id);
          if (!mounted || !state) return;

          if (state.status === 'interviewing') {
            const mediaReady = await ensureSessionMedia();
            if (!mounted) return;
            setStatusText(mediaReady ? 'Session restored. Press start answer.' : 'Allow camera and mic, then press resume session.');
          }
          return;
        }

        setPhase('ready');
        setStatusText('Ready to begin');
        setTranscript('Everything is prepared. When you are in a quiet place, start the interview.');
      } catch (setupError) {
        if (mounted) setError(setupError.message);
      }
    }

    loadInterview();

    return () => {
      mounted = false;
    };
  }, [appId, ensureSessionMedia, restoreInterviewState, user]);

  const stopSessionRecording = useCallback(async () => {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoRecorderRef.current.stop();
      await new Promise(resolve => {
        videoRecorderRef.current.onstop = resolve;
      });
    }

    const blob = videoChunksRef.current.length > 0 ? new Blob(videoChunksRef.current, { type: 'video/webm' }) : null;
    await cleanupSessionMedia();

    if (!blob) return;

    const objectUrl = URL.createObjectURL(blob);
    setLocalRecordingUrl(previousUrl => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return objectUrl;
    });

    try {
      const uploadResult = await uploadVideo(appId, blob);
      setRecordingSavedPath(uploadResult.video_path || '');
    } catch (uploadError) {
      console.error('Interview video upload failed:', uploadError);
      setError('The full interview recording was captured, but the upload failed. Download the local copy below.');
    }
  }, [appId, cleanupSessionMedia]);

  async function handleInterviewComplete() {
    setPhase('complete');
    setStatusText('Interview complete');
    setSpeakerLabel('Mihna');
    setTranscript('Thank you. Your interview has been submitted successfully.');
    setIsAiSpeaking(false);
    setIsProcessingAnswer(false);
    await stopSessionRecording();

    try {
      await completeInterview(appId);
    } catch {
      // Session completion is already handled server-side in common cases.
    }
  }

  async function playResponse(response) {
    const responseText = response.headers.get('X-Response') || '';
    const isComplete = response.headers.get('X-Complete') === 'true';

    setSpeakerLabel('Mihna');
    setTranscript(responseText || 'Processing…');
    setStatusText('Mihna is speaking');
    setIsAiSpeaking(true);

    try {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      currentAudioRef.current = audio;
      currentAudioUrlRef.current = url;

      if (audioContextRef.current && mixedAudioDestinationRef.current) {
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume().catch(() => {});
        }
        const aiSource = audioContextRef.current.createMediaElementSource(audio);
        aiSource.connect(mixedAudioDestinationRef.current);
        aiSource.connect(audioContextRef.current.destination);
        currentAiSourceRef.current = aiSource;
      }

      return new Promise(resolve => {
        audio.onended = async () => {
          releaseCurrentAudio();
          setIsAiSpeaking(false);
          if (isComplete) {
            await handleInterviewComplete();
          } else {
            setStatusText('Your turn. Press start answer.');
          }
          resolve();
        };

        audio.onerror = () => {
          releaseCurrentAudio();
          setIsAiSpeaking(false);
          setStatusText('Your turn. Press start answer.');
          resolve();
        };

        audio.play().catch(() => {
          releaseCurrentAudio();
          setIsAiSpeaking(false);
          setStatusText('Your turn. Press start answer.');
          resolve();
        });
      });
    } catch {
      releaseCurrentAudio();
      setIsAiSpeaking(false);
      setStatusText('Your turn. Press start answer.');
    }
  }

  async function handleStart() {
    if (!sessionId) return;

    setPhase('interviewing');
    setStatusText('Starting interview…');
    setError('');

    try {
      await startSessionRecording();
      const response = await startInterview(sessionId);
      if (!response.ok) throw new Error('Failed to start interview');
      await playResponse(response);
    } catch (startError) {
      await cleanupSessionMedia();
      setPhase('ready');
      setStatusText('Ready to begin');
      setError(startError.message || 'Camera and microphone access are required to record the full interview.');
    }
  }

  async function handleResumeSession() {
    const mediaReady = await ensureSessionMedia();
    if (mediaReady) {
      setStatusText('Session restored. Press start answer.');
    } else {
      setStatusText('Allow camera and mic, then press resume session.');
    }
  }

  async function handleStartAnswer() {
    if (phase !== 'interviewing' || isRecording || isAiSpeaking || isProcessingAnswer) return;

    if (!sessionAudioStreamRef.current) {
      setError('Interview audio stream is unavailable. Restart the interview to record the full session.');
      return;
    }

    try {
      const recorder = new MediaRecorder(sessionAudioStreamRef.current, { mimeType: 'audio/webm' });

      audioChunksRef.current = [];
      recorder.ondataavailable = event => audioChunksRef.current.push(event.data);
      recorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessingAnswer(true);
        setStatusText('Processing your response…');
        setSpeakerLabel('Processing');
        setTranscript('Transcribing and scoring your answer.');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        try {
          const response = await chatLoop(sessionId, audioBlob, []);
          if (!response.ok) throw new Error('Interview exchange failed');
          const userTranscript = response.headers.get('X-Transcript') || '';
          if (userTranscript) {
            setSpeakerLabel('You');
            setTranscript(userTranscript);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          setIsProcessingAnswer(false);
          await playResponse(response);
        } catch (chatError) {
          setIsProcessingAnswer(false);
          setError(chatError.message);
          setStatusText('Something went wrong. Press start answer to retry.');
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setStatusText('Recording answer… press stop when done.');
      setSpeakerLabel('You');
      setTranscript('Listening…');
    } catch (micError) {
      console.error('Microphone unavailable:', micError);
      setError('Microphone access was unavailable.');
    }
  }

  function handleStopAnswer() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  if (!user) return null;

  return (
    <div className="page-container">
      <TopNav
        activeHref="/employee"
        helperText="Voice interview session"
        items={navItems}
        rightSlot={phase === 'complete' ? <StatusBadge tone="success">Interview submitted</StatusBadge> : null}
        user={user}
      />

      <main className="page-shell interview-shell stack-xl">
        {error ? <div className="alert alert-error">{error}</div> : null}

        <motion.section initial="hidden" animate="visible" variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <PageHeader
              eyebrow="Candidate interview"
              title="Focused, calm, and voice-first"
              subtitle="Listen to the question, press start answer, then press stop when you finish."
              compact
            />
          </motion.div>

          <motion.div variants={fadeUp}>
            <Panel className="panel-brand stack-md">
              <div className="interview-status">
                <Sparkles size={14} />
                {statusText}
              </div>
              <ProgressBar value={phaseProgress[phase] || 0} />
            </Panel>
          </motion.div>
        </motion.section>

        {phase === 'loading' ? (
          <LoadingState label="Preparing interview session…" />
        ) : (
          <section className="interview-grid">
            <motion.div initial="hidden" animate="visible" variants={stagger} className="interview-main">
              <motion.div variants={fadeUp}>
                <Panel className="interview-stage">
                  {(phase === 'setup' || phase === 'loading') && <LoadingState label="Analyzing candidate and role data…" />}

                  {phase === 'ready' ? (
                    <>
                      <div className="interview-status">Ready when you are</div>
                      <InterviewTranscript speaker="System" text={transcript} />
                      <button className="btn btn-primary btn-lg" onClick={handleStart} type="button">
                        Begin interview
                        <Mic size={16} />
                      </button>
                    </>
                  ) : null}

                  {phase === 'interviewing' ? (
                    <>
                      <div className="interview-orb-wrap">
                        <div className={`interview-orb${isRecording ? ' recording' : ''}`}>
                          <Mic size={34} />
                        </div>
                      </div>
                      <div className="interview-orb-label">
                        {isAiSpeaking
                          ? 'Mihna is asking the question.'
                          : isResumingSession
                            ? 'Restoring camera and microphone…'
                          : isProcessingAnswer
                            ? 'Processing your answer…'
                            : isRecording
                              ? 'Recording answer… press stop when done.'
                              : sessionAudioStreamRef.current
                                ? 'Press start answer when you are ready.'
                                : 'Press resume session to continue this question.'}
                      </div>
                      <div className="page-actions" style={{ justifyContent: 'center' }}>
                        {isAiSpeaking ? (
                          <button className="btn btn-secondary btn-lg" disabled type="button">
                            Waiting for AI question…
                          </button>
                        ) : isResumingSession ? (
                          <button className="btn btn-secondary btn-lg" disabled type="button">
                            Restoring session…
                          </button>
                        ) : isProcessingAnswer ? (
                          <button className="btn btn-secondary btn-lg" disabled type="button">
                            Processing answer…
                          </button>
                        ) : isRecording ? (
                          <button className="btn btn-danger btn-lg" onClick={handleStopAnswer} type="button">
                            Stop Answer
                          </button>
                        ) : !sessionAudioStreamRef.current ? (
                          <button className="btn btn-secondary btn-lg" onClick={handleResumeSession} type="button">
                            Resume Session
                            <RefreshCcw size={16} />
                          </button>
                        ) : (
                          <button className="btn btn-primary btn-lg" onClick={handleStartAnswer} type="button">
                            Start Answer
                            <Mic size={16} />
                          </button>
                        )}
                      </div>
                      <InterviewTranscript speaker={speakerLabel} text={transcript} />
                      {isAiSpeaking ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            releaseCurrentAudio();
                            setIsAiSpeaking(false);
                            setStatusText('Your turn. Press start answer.');
                          }}
                          type="button"
                        >
                          <SkipForward size={14} />
                          Skip AI response
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  {phase === 'complete' ? (
                    <>
                      <div className="landing-role-icon">
                        <CheckCircle2 size={24} />
                      </div>
                      <PageHeader
                        centered
                        compact
                        eyebrow="Submission complete"
                        subtitle="Your full interview recording, transcript, and scoring flow have been captured successfully."
                        title="Interview complete"
                      />
                      {(recordingSavedPath || localRecordingUrl) ? (
                        <Panel className="panel-muted stack-md" style={{ width: '100%', maxWidth: '36rem' }}>
                          <div className="preview-kicker">Recording saved</div>
                          {recordingSavedPath ? (
                            <p className="card-copy" style={{ margin: 0 }}>
                              Server copy saved at: <span className="mono-text">{recordingSavedPath}</span>
                            </p>
                          ) : null}
                          {localRecordingUrl ? (
                            <a className="btn btn-secondary" download={`mihna-interview-${appId}.webm`} href={localRecordingUrl}>
                              Download local copy
                            </a>
                          ) : null}
                        </Panel>
                      ) : null}
                      <Link className="btn btn-primary btn-lg" href="/employee">
                        Back to dashboard
                        <ArrowRight size={16} />
                      </Link>
                    </>
                  ) : null}
                </Panel>
              </motion.div>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={stagger} className="interview-side">
              <motion.div variants={fadeUp}>
                <Panel className="webcam-panel stack-md">
                  <div className="card-toolbar">
                    <div>
                      <div className="interview-side-title">Live camera preview</div>
                      <p className="card-copy">Full session video is saved locally.</p>
                    </div>
                    <StatusBadge tone="accent">
                      <Video size={14} />
                      Preview
                    </StatusBadge>
                  </div>
                  <div className="webcam-preview">
                    <video autoPlay muted playsInline ref={webcamVideoRef} />
                  </div>
                  {phase === 'interviewing' ? <div className="rec-indicator">Recording</div> : null}
                </Panel>
              </motion.div>

              <motion.div variants={fadeUp}>
                <Panel className="stack-md">
                  <SectionHeader
                    eyebrow="Instructions"
                    title="Start, answer, stop"
                    subtitle="One question at a time."
                  />
                  <ul className="list-points">
                    <li className="list-point">
                      <span className="list-point-dot" />
                      <div>
                        <strong>Use a quiet room</strong>
                        <p className="card-copy">Clear audio helps accuracy.</p>
                      </div>
                    </li>
                    <li className="list-point">
                      <span className="list-point-dot" />
                      <div>
                        <strong>Press start, then stop</strong>
                        <p className="card-copy">Answer one question at a time.</p>
                      </div>
                    </li>
                    <li className="list-point">
                      <span className="list-point-dot" />
                      <div>
                        <strong>Stay framed on camera</strong>
                        <p className="card-copy">The full interview is recorded locally.</p>
                      </div>
                    </li>
                  </ul>
                </Panel>
              </motion.div>
            </motion.div>
          </section>
        )}
      </main>
    </div>
  );
}
