import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

interface Options {
  onResult: (text: string) => void;
  onError?: (kind: "permission" | "unavailable" | "other") => void;
}

export function useSpeechInput({ onResult, onError }: Options) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const isSupported =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );

  const start = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const r = new SpeechRecognition();
    r.lang = "en-US";
    // interimResults must be true on iOS Safari — with false, onresult often never fires
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;

    // Accumulate transcript across all result events
    let accumulated = "";

    r.onstart = () => setIsListening(true);

    r.onresult = (event: any) => {
      // Use indexed loop — Array.from(event.results) is unreliable on iOS Safari
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      accumulated = text.trim();
    };

    // Deliver the result on end — more reliable than delivering inside onresult on iOS
    r.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      if (accumulated) {
        onResultRef.current(accumulated);
        accumulated = "";
      }
    };

    r.onerror = (event: any) => {
      recognitionRef.current = null;
      setIsListening(false);
      accumulated = "";
      const err: string = event.error ?? "";
      if (err === "not-allowed" || err === "permission-denied") {
        onErrorRef.current?.("permission");
      } else if (err === "service-not-available" || err === "audio-capture") {
        onErrorRef.current?.("unavailable");
      } else if (err !== "aborted" && err !== "no-speech") {
        onErrorRef.current?.("other");
      }
    };

    recognitionRef.current = r;
    try {
      r.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const abort = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { isListening, isSupported, start, stop, abort };
}
