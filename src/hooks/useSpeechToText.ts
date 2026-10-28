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

    // We'll create recognition instances on-demand in startListening
    // This ensures fresh instances and avoids state issues

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [language, isSupported]); // Removed isListening dependency

  // State synchronization effect - ensure isListening matches reality
  useEffect(() => {
    const interval = setInterval(() => {
      const hasActiveRecognition = !!recognitionRef.current;
      if (hasActiveRecognition !== isListening) {
        console.log(
          "🔄 State sync: recognition exists:",
          hasActiveRecognition,
          "but isListening:",
          isListening,
          "FORCING UPDATE"
        );
        setIsListening(hasActiveRecognition);
      }
    }, 200); // Check every 200ms for faster correction

    return () => clearInterval(interval);
  }, [isListening]);

  // Create a fresh recognition instance
  const createRecognitionInstance = useCallback(() => {
    if (!isSupported) return null;

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
      console.log("🎤 Speech recognition ended, setting isListening to false");

      // Force state update with a slight delay to ensure it takes effect
      setTimeout(() => {
        setIsListening(false);
        console.log("🎤 isListening state forcefully set to false");
      }, 10);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Clear any "aborted" errors since ending is normal
      setError(null);

      // Clear the reference to allow for fresh instance next time
      recognitionRef.current = null;
      console.log("🎤 Recognition ended, reference cleared for fresh restart");
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
          if (recognitionRef.current) {
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
          // Don't show error for aborted - this is normal when manually stopped
          console.log(
            "Speech recognition was aborted (normal when manually stopped)"
          );
          setError(null); // Clear error for aborted state
          break;
        default:
          setError(`Speech recognition error: ${event.error}`);
      }
    };

    return recognition;
  }, [language, isSupported]); // Removed isListening dependency

  const startListening = useCallback(() => {
    console.log(
      "🎤 Start listening called, isSupported:",
      isSupported,
      "isListening:",
      isListening
    );

    if (!isSupported) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening && recognitionRef.current) {
      console.log("🎤 Already listening, ignoring start request");
      return;
    }

    // Stop any existing recognition first
    if (recognitionRef.current) {
      console.log("🎤 Stopping existing recognition before starting new one");
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Always create a fresh recognition instance
    console.log("🎤 Creating fresh recognition instance...");
    const newRecognition = createRecognitionInstance();

    if (!newRecognition) {
      setError("Failed to create speech recognition instance.");
      return;
    }

    try {
      setError(null);
      setTranscript(""); // Clear previous transcript
      setConfidence(0);

      // Force English US for business terminology
      newRecognition.lang = "en-US";
      console.log(
        "🎤 Starting fresh speech recognition with language:",
        newRecognition.lang
      );

      // Set the reference before starting
      recognitionRef.current = newRecognition;

      newRecognition.start();
      console.log("🎤 Fresh speech recognition started successfully");
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      console.log("🎤 Error details:", err);
      setError("Failed to start speech recognition.");
      setIsListening(false);
      recognitionRef.current = null; // Clear failed reference
    }
  }, [isSupported, createRecognitionInstance]); // Removed isListening dependency
  const stopListening = useCallback(() => {
    console.log(
      "🛑 Stop listening called, current recognitionRef:",
      !!recognitionRef.current
    );

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log("🛑 Speech recognition stopped manually");

        // Clear timeout if exists
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Force state update immediately with timeout fallback
        setIsListening(false);
        setTimeout(() => {
          setIsListening(false); // Double-check in case first one didn't take
          console.log("🛑 Double-checked isListening state set to false");
        }, 50);

        console.log("🛑 isListening state set to false");

        // Clear reference to ensure fresh instance next time
        recognitionRef.current = null;
        console.log("🛑 Recognition reference cleared");
      } catch (err) {
        console.error("Error stopping speech recognition:", err);
        // Even if stop fails, update state and clear reference
        setIsListening(false);
        recognitionRef.current = null;
      }
    } else {
      // Even if no recognition reference, ensure state is consistent
      setIsListening(false);
      console.log(
        "🛑 No recognition reference, but ensuring isListening is false"
      );
    }
  }, []); // No dependencies needed

  const toggleListening = useCallback(() => {
    // Use the recognition ref as the source of truth, not the state
    const currentlyActive = !!recognitionRef.current;
    console.log(
      "🔄 Toggle listening - recognitionRef exists:",
      currentlyActive,
      "isListening state:",
      isListening
    );

    if (currentlyActive) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

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
