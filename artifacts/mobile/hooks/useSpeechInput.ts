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
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const r = new SpeechRecognition();
    r.lang = "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 1;

    r.onstart = () => setIsListening(true);

    r.onresult = (event: any) => {
      const text = Array.from(event.results as any[])
        .map((res: any) => res[0].transcript)
        .join(" ")
        .trim();
      if (text) onResultRef.current(text);
    };

    r.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    r.onerror = (event: any) => {
      recognitionRef.current = null;
      setIsListening(false);
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
