import { useEffect, useRef, useState } from "react";

type Recognizer = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export function useTraderDictation(append: (text: string) => void, reportFailure: () => void) {
  const current = useRef<Recognizer | null>(null);
  const [listening, setListening] = useState(false);
  function abort() {
    const instance = current.current;
    current.current = null;
    instance?.abort();
  }
  useEffect(() => abort, []);

  function toggle() {
    if (current.current) {
      current.current.stop();
      return;
    }
    const browser = window as Window & {
      SpeechRecognition?: new () => Recognizer;
      webkitSpeechRecognition?: new () => Recognizer;
    };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) return reportFailure();
    const instance = new Recognition();
    current.current = instance;
    instance.lang = "ar-SA";
    instance.onresult = event => {
      if (current.current === instance) append(Array.from(event.results, result => result[0].transcript).join(" "));
    };
    instance.onerror = () => { if (current.current === instance) reportFailure(); };
    instance.onend = () => {
      if (current.current !== instance) return;
      current.current = null;
      setListening(false);
    };
    try {
      instance.start();
      setListening(true);
    } catch {
      current.current = null;
      reportFailure();
    }
  }
  return { listening, toggle, reset: () => { abort(); setListening(false); } };
}
