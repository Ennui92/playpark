import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { DICTS, LangCode, TranslationKey, LANGUAGES } from "./translations";

export { LANGUAGES } from "./translations";
export type { LangCode, TranslationKey } from "./translations";

const STORAGE_KEY = "outside.lang";
const DEFAULT_LANG: LangCode = "en";

type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

interface LangContextValue {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: TFn;
}

const LangContext = createContext<LangContextValue | undefined>(undefined);

// Simple {placeholder} interpolation. Missing vars are left as-is so a
// forgotten arg is visible (e.g. "Hi, {name}") rather than silently blank.
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    k in vars ? String(vars[k]) : m
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);
  const [ready, setReady] = useState(false);

  // Load the persisted choice once. Gating render until loaded avoids an
  // English→German flash on cold start for users who picked German.
  useEffect(() => {
    let mounted = true;
    // Safety net: never block the app on the stored-language read. If
    // SecureStore stalls, fall back to the default after a short grace.
    const safety = setTimeout(() => {
      if (mounted) setReady(true);
    }, 2000);
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        if (stored && stored in DICTS) setLangState(stored as LangCode);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          clearTimeout(safety);
          setReady(true);
        }
      });
    return () => {
      mounted = false;
      clearTimeout(safety);
    };
  }, []);

  const setLang = useCallback((next: LangCode) => {
    setLangState(next);
    // Fire-and-forget persist; the in-memory state is the source of truth
    // for this session regardless of whether the write succeeds.
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      const dict = DICTS[lang] ?? DICTS[DEFAULT_LANG];
      const template = dict[key] ?? DICTS[DEFAULT_LANG][key] ?? key;
      return interpolate(template, vars);
    },
    [lang]
  );

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t]
  );

  if (!ready) return null;

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

// Sugar for the common case where a component only needs `t`.
export function useT(): TFn {
  return useLang().t;
}

// Number of supported languages, handy for UI.
export const SUPPORTED_LANG_COUNT = LANGUAGES.length;
