/**
 * SignalDecisionReasoningCrisper — warm_profile_1_crisper, left/right cards.
 *
 * 1-signal variant of SignalDecisionReasoning. Skips Signal 2 entirely.
 *
 * Flow:
 *   1. Signal reveals (blur → sharp, 3200ms)
 *   2. Dots appear — 5s hold
 *   3. Dots hide; Signal fades out (700ms)
 *   4. Reasoning reveals (7000ms)
 *   5. 5s hold after reasoning done
 *   6. onSequenceDone fires
 *
 * Timing from playing=true:
 *       0ms   Signal reveal starts (3200ms)
 *    3200ms   Signal done → dots appear
 *    8200ms   5s hold ends → dots hide; Signal fades (700ms)
 *    8900ms   Signal gone
 *    9300ms   Reasoning reveal starts (400ms gap, 7000ms)
 *   16300ms   Reasoning fully visible
 *   21300ms   onSequenceDone fires (5s hold)
 */

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import GlanceTextReveal from '../Shared/GlanceTextReveal';

const RESOLVE_MS_SIGNAL    = 3200;
const PAUSE_AFTER_SIGNAL   = 5000;
const SIGNAL_FADE_MS       = 700;
const GAP_BEFORE_REASONING = 400;
const RESOLVE_MS_REASONING = 7000;
const PAUSE_AFTER_REASONING= 5000;

const SIGNAL_DONE_MS       = RESOLVE_MS_SIGNAL;                                  // 3200
const SIGNAL_FADE_START_MS = SIGNAL_DONE_MS + PAUSE_AFTER_SIGNAL;                // 8200
const SIGNAL_GONE_MS       = SIGNAL_FADE_START_MS + SIGNAL_FADE_MS;              // 8900
const REASONING_START_MS   = SIGNAL_GONE_MS + GAP_BEFORE_REASONING;              // 9300

function WaitingDots({ visible, textAlign }: { visible: boolean; textAlign: 'left' | 'center' | 'right' }) {
  const dot1 = useRef<HTMLSpanElement>(null);
  const dot2 = useRef<HTMLSpanElement>(null);
  const dot3 = useRef<HTMLSpanElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    tlRef.current?.kill();
    if (!visible) {
      [dot1, dot2, dot3].forEach(r => r.current && gsap.set(r.current, { opacity: 0 }));
      return;
    }
    [dot1, dot2, dot3].forEach(r => r.current && gsap.set(r.current, { opacity: 0.15 }));
    const tl = gsap.timeline({ repeat: -1 });
    [dot1, dot2, dot3].forEach((r, i) => {
      if (!r.current) return;
      tl.to(r.current, { opacity: 0.85, duration: 0.45, ease: 'power1.out' }, i * 0.28)
        .to(r.current, { opacity: 0.15, duration: 0.45, ease: 'power1.in'  }, i * 0.28 + 0.45);
    });
    tlRef.current = tl;
    return () => { tl.kill(); };
  }, [visible]);

  const dotStyle: React.CSSProperties = {
    display: 'inline-block',
    width: 4, height: 4,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.85)',
    margin: '0 2.5px',
    verticalAlign: 'middle',
    opacity: 0,
  };

  return (
    <div style={{
      display: visible ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent:
        textAlign === 'right'  ? 'flex-end' :
        textAlign === 'center' ? 'center'   : 'flex-start',
      marginTop: 12,
      height: 16,
    }}>
      <span ref={dot1} style={dotStyle} />
      <span ref={dot2} style={dotStyle} />
      <span ref={dot3} style={dotStyle} />
    </div>
  );
}

type Props = {
  playing:        boolean;
  onSequenceDone: () => void;
  textAlign:      'left' | 'center' | 'right';
  signal:         string;
  signalHls:      string[];
  reasoning:      string;
  reasoningHls:   string[];
};

export default function SignalDecisionReasoningCrisper({
  playing, onSequenceDone, textAlign,
  signal, signalHls, reasoning, reasoningHls,
}: Props) {
  const [signalVisible,    setSignalVisible]    = useState(false);
  const [signalPlaying,    setSignalPlaying]    = useState(false);
  const [dotsVisible,      setDotsVisible]      = useState(false);
  const [reasoningVisible, setReasoningVisible] = useState(false);
  const [reasoningPlaying, setReasoningPlaying] = useState(false);

  const signalWrapperRef = useRef<HTMLDivElement>(null);
  const timersRef        = useRef<ReturnType<typeof setTimeout>[]>([]);
  const doneRef          = useRef(false);

  function addTimer(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }

  useEffect(() => {
    if (!playing) return;
    doneRef.current = false;

    /* Phase 1 — Signal reveals */
    setSignalVisible(true);
    setSignalPlaying(true);

    /* Phase 2 — dots after signal done */
    addTimer(() => setDotsVisible(true), SIGNAL_DONE_MS);

    /* Phase 3 — 5s hold ends: dots hide, signal fades */
    addTimer(() => {
      setDotsVisible(false);
      const el = signalWrapperRef.current;
      if (el) {
        gsap.to(el, {
          opacity: 0, duration: SIGNAL_FADE_MS / 1000, ease: 'power2.in',
          onComplete: () => setSignalVisible(false),
        });
      }
    }, SIGNAL_FADE_START_MS);

    /* Phase 4 — Reasoning reveals */
    addTimer(() => {
      setReasoningVisible(true);
      setReasoningPlaying(true);
    }, REASONING_START_MS);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      doneRef.current = false;
    };
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReasoningDone() {
    addTimer(() => {
      if (!doneRef.current) { doneRef.current = true; onSequenceDone(); }
    }, PAUSE_AFTER_REASONING);
  }

  const signalStyle: React.CSSProperties = {
    margin: 0,
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    fontWeight: 400,
    fontSize: 'clamp(15px, 1.75vw, 26px)',
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.92)',
    textShadow: '0 1px 6px rgba(0,0,0,0.4)',
    textAlign,
    letterSpacing: 0.1,
    maxWidth: '100%',
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>

      {signalVisible && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <div ref={signalWrapperRef} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <p style={signalStyle}>
              <GlanceTextReveal
                text={signal}
                highlights={signalHls}
                twoLine={false}
                playing={signalPlaying}
                resolvedOpacity={0.92}
                resolveMs={RESOLVE_MS_SIGNAL}
                onDone={() => {}}
              />
            </p>
            <WaitingDots visible={dotsVisible} textAlign={textAlign} />
          </div>
        </div>
      )}

      {reasoningVisible && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <p style={{
            margin: 0,
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(14px, 1.55vw, 24px)',
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.82)',
            textShadow: '0 1px 6px rgba(0,0,0,0.4), 0 0 20px rgba(192,132,252,0.18)',
            textAlign,
            maxWidth: '100%',
          }}>
            <GlanceTextReveal
              text={reasoning}
              highlights={reasoningHls}
              twoLine={false}
              playing={reasoningPlaying}
              resolvedOpacity={0.82}
              resolveMs={RESOLVE_MS_REASONING}
              onDone={handleReasoningDone}
            />
          </p>
        </div>
      )}

      {/* Invisible spacer — holds container height stable */}
      <div aria-hidden="true" style={{ visibility: 'hidden', pointerEvents: 'none' }}>
        <p style={{
          margin: 0,
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          fontWeight: 400,
          fontSize: 'clamp(14px, 1.55vw, 24px)',
          lineHeight: 1.65,
          maxWidth: '100%',
          whiteSpace: 'pre-wrap',
        }}>
          {reasoning}
        </p>
      </div>

    </div>
  );
}
