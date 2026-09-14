import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Square,
  Volume2,
  FastForward,
} from "lucide-react";

interface NoteAudioPlayerProps {
  title: string;
  content: string;
  category?: string;
  className?: string;
}

/** Pre-cleans medical text for natural speech synthesis */
function cleanTextForSpeech(raw: string, title: string, category?: string): string[] {
  if (!raw) return [];

  const text = raw
    // Strip markdown images & links
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    // Strip markdown formatting
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "and")
    .replace(/&nbsp;/g, " ")
    // Medical abbreviations
    .replace(/\be\.g\.,?\s*/gi, "for example, ")
    .replace(/\bi\.e\.,?\s*/gi, "that is, ")
    .replace(/\bvs\.?\s*/gi, "versus ")
    .replace(/\bMCQ(s)?\b/gi, "multiple choice questions")
    .replace(/\bCAT(s)?\b/g, "Continuous Assessment Test")
    .replace(/\bmg\/dL\b/gi, "milligrams per deciliter")
    .replace(/\bmmHg\b/gi, "millimeters of mercury")
    .replace(/\bIV\b/g, "intravenous")
    .replace(/\bIM\b/g, "intramuscular")
    .replace(/\bPO\b/g, "by mouth")
    .replace(/\bPRN\b/g, "as needed")
    .replace(/\bBID\b/g, "twice daily")
    .replace(/\bTID\b/g, "three times daily")
    .replace(/\bQID\b/g, "four times daily")
    .replace(/\bSOB\b/g, "shortness of breath")
    .replace(/\bMI\b/g, "myocardial infarction")
    .replace(/—/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  // Intro header
  const intro = category
    ? `Topic: ${title}. Category: ${category}.`
    : `Topic: ${title}.`;

  // Split into chunks of around 1-2 sentences so speech synthesis doesn't hang
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && !/^[-*•]/.test(s));

  return [intro, ...sentences];
}

const SPEEDS = [1.0, 1.25, 1.5, 2.0];

export default function NoteAudioPlayer({
  title,
  content,
  category,
  className = "",
}: NoteAudioPlayerProps) {
  const [supported, setSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1); // Default 1.25x (popular for med students)

  const chunksRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const speedRef = useRef(SPEEDS[speedIndex]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSupported(true);
    }
  }, []);

  useEffect(() => {
    chunksRef.current = cleanTextForSpeech(content, title, category);
  }, [content, title, category]);

  useEffect(() => {
    speedRef.current = SPEEDS[speedIndex];
  }, [speedIndex]);

  const stopAudio = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
  }, []);

  const speakChunk = useCallback((index: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const chunks = chunksRef.current;
    if (index >= chunks.length) {
      stopAudio();
      return;
    }

    window.speechSynthesis.cancel();

    const chunk = chunks[index];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = speedRef.current;
    utterance.lang = "en-US";

    utterance.onend = () => {
      if (!isPlayingRef.current) return;
      const next = index + 1;
      currentIndexRef.current = next;
      setCurrentIndex(next);
      speakChunk(next);
    };

    utterance.onerror = (e) => {
      if (e.error === "canceled" || e.error === "interrupted") return;
      console.warn("Speech synthesis error:", e);
      const next = index + 1;
      currentIndexRef.current = next;
      setCurrentIndex(next);
      if (isPlayingRef.current) speakChunk(next);
    };

    window.speechSynthesis.speak(utterance);
  }, [stopAudio]);

  const handlePlay = () => {
    if (!supported || chunksRef.current.length === 0) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);
    speakChunk(currentIndexRef.current);
  };

  const handlePause = () => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    isPlayingRef.current = false;
  };

  const handleNext = () => {
    const next = Math.min(currentIndexRef.current + 1, chunksRef.current.length - 1);
    currentIndexRef.current = next;
    setCurrentIndex(next);
    if (isPlayingRef.current) {
      speakChunk(next);
    }
  };

  const cycleSpeed = () => {
    const nextIdx = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIdx);
    speedRef.current = SPEEDS[nextIdx];
    if (isPlayingRef.current) {
      speakChunk(currentIndexRef.current);
    }
  };

  // Stop on unmount so audio doesn't linger across page navigation
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  const totalChunks = chunksRef.current.length;
  const progressPercent = totalChunks > 0 ? Math.round(((currentIndex + 1) / totalChunks) * 100) : 0;

  return (
    <div
      className={`no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-card-foreground shadow-sm transition-all dark:bg-primary/10 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Volume2 className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              Listen to Note (Offline Audio)
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
              100% Offline
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isPlaying
              ? `Reading section ${currentIndex + 1} of ${totalChunks} (${progressPercent}%)`
              : isPaused
              ? `Paused at section ${currentIndex + 1} of ${totalChunks}`
              : "Listen on hospital walks or commutes"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {!isPlaying ? (
          <Button
            size="sm"
            onClick={handlePlay}
            className="h-8 gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {isPaused ? "Resume" : "Play Audio"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePause}
            className="h-8 gap-1.5 rounded-lg border-primary/30 px-3 text-xs font-semibold hover:bg-primary/10"
          >
            <Pause className="h-3.5 w-3.5 fill-current" />
            Pause
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={cycleSpeed}
          title="Playback speed"
          className="h-8 rounded-lg px-2 text-xs font-bold text-foreground hover:bg-muted"
        >
          {SPEEDS[speedIndex]}x
        </Button>

        {(isPlaying || isPaused) && (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleNext}
              disabled={currentIndex >= totalChunks - 1}
              title="Skip to next sentence"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <FastForward className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={stopAudio}
              title="Stop audio"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500"
            >
              <Square className="h-3 w-3 fill-current" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
