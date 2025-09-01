import { useState, useEffect, useCallback, useRef } from "react";

interface SpeechToTextHook {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearTranscript: () => void;
  error: string | null;
  confidence: number;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
    | null;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

export const useSpeechToText = (
  language: string = "en-US"
): SpeechToTextHook => {
  const [transcript, setTranscript] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if speech recognition is supported
  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Business-specific correction function
  const applyBusinessCorrections = (text: string): string => {
    let corrected = text;

    // First, convert spoken punctuation to actual punctuation
    const punctuationMap: Record<string, string> = {
      "question mark": "?",
      period: ".",
      comma: ",",
      "exclamation mark": "!",
      "exclamation point": "!",
      semicolon: ";",
      colon: ":",
      dash: "-",
      hyphen: "-",
    };

    // Apply punctuation conversions
    for (const [spoken, symbol] of Object.entries(punctuationMap)) {
      const regex = new RegExp(`\\b${spoken}\\b`, "gi");
      corrected = corrected.replace(regex, symbol);
    }

    // Common business term corrections (case-insensitive)
    const corrections: Record<string, string> = {
      // Category variations
      kategory: "category",
      categorey: "category",
      catagory: "category",
      catergory: "category",

      // Performance variations
      performace: "performance",
      preformance: "performance",
      performence: "performance",

      // Chart variations - this is key for your issue
      chat: "chart",
      shart: "chart",
      chart: "chart", // Keep correct ones

      // Month variations - fix "Man" -> "month"
      man: "month",
      mont: "month",
      munth: "month",
      monts: "months",

      // Common business words
      inventery: "inventory",
      inventry: "inventory",
      analitics: "analytics",
      analitik: "analytics",
      analytic: "analytics",

      // Remove strange words like "sincloud"
      sincloud: "",
      "sin cloud": "",

      // Last variations
      las: "last",
      lst: "last",

      // And variations
      an: "and",
      "an ": "and ",
    };

    // Apply corrections word by word to preserve context
    const words = corrected.split(" ");
    const correctedWords = words.map((word) => {
      const lowerWord = word.toLowerCase().replace(/[.,!?]/g, "");
      const punctuation = word.match(/[.,!?]$/)?.[0] || "";

      // Check if word needs correction
      for (const [wrong, right] of Object.entries(corrections)) {
        if (lowerWord === wrong.toLowerCase()) {
          return right + punctuation;
        }
      }

      return word;
    });

    corrected = correctedWords.join(" ");

    // Fix excessive capitalization - only capitalize first letter and proper nouns
    corrected = corrected.toLowerCase();
    corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);

    // Capitalize after sentence-ending punctuation
    corrected = corrected.replace(
      /([.!?])\s+([a-z])/g,
      (match, punct, letter) => {
        return punct + " " + letter.toUpperCase();
      }
    );

    // Clean up extra spaces and strange artifacts
    corrected = corrected.replace(/\s+/g, " ").trim();
    corrected = corrected.replace(/\s+([.,!?])/g, "$1"); // Remove spaces before punctuation

    return corrected;
  };

  // Enhanced language code mapping
  const getLanguageCode = (lang: string): string => {
    // Always use US English for better business term recognition
    if (lang.startsWith("en")) {
      return "en-US";
    }

    const langMap: Record<string, string> = {
      fr: "fr-FR",
      nl: "nl-NL",
    };
    return langMap[lang] || "en-US";
  };

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getLanguageCode(language); // Use enhanced language mapping
    recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy

    recognition.onstart = () => {
      console.log(
        "🎤 Speech recognition started with language:",
        recognition.lang
      );
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log("🎤 Speech recognition ended");
      setIsListening(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      // Process all results to build complete transcript
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPart = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcriptPart;
          setConfidence(result[0].confidence || 0);
        } else {
          interimTranscript += transcriptPart;
        }
      }

      // Set the complete transcript (final + interim), don't append to previous
      const currentTranscript = finalTranscript + interimTranscript;

      // Apply business-specific corrections to improve accuracy
      const correctedTranscript = applyBusinessCorrections(
        currentTranscript.trim()
      );
      setTranscript(correctedTranscript);

      console.log("🎤 Raw transcript:", currentTranscript.trim());
      console.log("🎤 Corrected transcript:", correctedTranscript);

      // Auto-stop after 3 seconds of silence, but only reset timeout on new words
      if (finalTranscript || interimTranscript.length > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (recognitionRef.current && isListening) {
            recognition.stop();
          }
        }, 3000);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("🎤 Speech recognition error:", event.error);
      setError(event.error);
      setIsListening(false);

      // Provide user-friendly error messages
      switch (event.error) {
        case "no-speech":
          setError("No speech detected. Please try again.");
          break;
        case "audio-capture":
          setError("Microphone not accessible. Please check permissions.");
          break;
        case "not-allowed":
          setError(
            "Microphone access denied. Please enable microphone permissions."
          );
          break;
        case "network":
          setError("Network error. Please check your internet connection.");
          break;
        case "aborted":
          setError("Speech recognition was aborted.");
          break;
        default:
          setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognition) {
        recognition.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [language, isSupported, isListening]);

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) return;

    try {
      setError(null);
      setTranscript(""); // Clear previous transcript
      setConfidence(0);

      // Force English US for business terminology
      recognitionRef.current.lang = "en-US";
      console.log(
        "🎤 Starting speech recognition with language:",
        recognitionRef.current.lang
      );

      recognitionRef.current.start();
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      setError("Failed to start speech recognition.");
    }
  }, [isSupported, isListening]);

  const stopListening = useCallback(() => {
    console.log("🛑 Stop button clicked, isListening:", isListening);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log("🛑 Speech recognition stopped manually");

        // Clear timeout if exists
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Force state update
        setIsListening(false);
      } catch (err) {
        console.error("Error stopping speech recognition:", err);
      }
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setConfidence(0);
    setError(null);
  }, []);

  return {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    error,
    confidence,
  };
};
