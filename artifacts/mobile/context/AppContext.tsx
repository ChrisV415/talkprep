import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Persona {
  emotional_intensity: number;
  defensiveness: number;
  communication: number;
  power: number;
  reaction: string;
  difficulty: string;
  extra: string;
}

export interface Scores {
  clarity: number;
  composure: number;
  outcome_score: number;
}

export interface Session {
  id: string;
  date: string;
  scenario: string;
  who: string;
  situation: string;
  response: string;
  scores?: Scores;
  debrief?: {
    outcome: string;
    happened: string;
    different: string;
    text: string;
  };
}

export interface RpMessage {
  role: "user" | "assistant";
  content: string;
}

const defaultPersona: Persona = {
  emotional_intensity: 50,
  defensiveness: 50,
  communication: 50,
  power: 50,
  reaction: "",
  difficulty: "Realistic",
  extra: "",
};

const defaultScores: Scores = {
  clarity: 0,
  composure: 0,
  outcome_score: 0,
};

interface AppState {
  scenario: string;
  who: string;
  situation: string;
  outcome: string;
  tone: string;
  fullResponse: string;
  persona: Persona;
  rpMessages: RpMessage[];
  rpSystemContext: string;
  scores: Scores;
  currentSessionId?: string;
  sessions: Session[];
}

interface AppContextType extends AppState {
  setScenario: (v: string) => void;
  setWho: (v: string) => void;
  setSituation: (v: string) => void;
  setOutcome: (v: string) => void;
  setTone: (v: string) => void;
  setFullResponse: (v: string) => void;
  setPersona: (p: Persona) => void;
  setRpMessages: (msgs: RpMessage[]) => void;
  setRpSystemContext: (ctx: string) => void;
  setScores: (s: Scores) => void;
  saveSession: () => Promise<string>;
  updateSessionScores: (id: string, scores: Scores) => Promise<void>;
  updateSessionDebrief: (id: string, debrief: Session["debrief"]) => Promise<void>;
  loadSession: (session: Session) => void;
  resetCurrentSession: () => void;
  getSessions: () => Session[];
}

const AppContext = createContext<AppContextType | null>(null);

const SESSIONS_KEY = "tp_sessions";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    scenario: "",
    who: "",
    situation: "",
    outcome: "",
    tone: "",
    fullResponse: "",
    persona: defaultPersona,
    rpMessages: [],
    rpSystemContext: "",
    scores: { ...defaultScores },
    currentSessionId: undefined,
    sessions: [],
  });

  useEffect(() => {
    AsyncStorage.getItem(SESSIONS_KEY).then((raw) => {
      if (raw) {
        try {
          const sessions = JSON.parse(raw) as Session[];
          setState((s) => ({ ...s, sessions }));
        } catch {}
      }
    });
  }, []);

  const saveSessions = useCallback(async (sessions: Session[]) => {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }, []);

  const saveSession = useCallback(async (): Promise<string> => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSession: Session = {
      id,
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      scenario: state.scenario,
      who: state.who,
      situation: state.situation.slice(0, 120) + (state.situation.length > 120 ? "..." : ""),
      response: state.fullResponse,
    };
    const updated = [newSession, ...state.sessions].slice(0, 50);
    setState((s) => ({ ...s, sessions: updated, currentSessionId: id }));
    await saveSessions(updated);
    return id;
  }, [state, saveSessions]);

  const updateSessionScores = useCallback(async (id: string, scores: Scores) => {
    const updated = state.sessions.map((s) =>
      s.id === id ? { ...s, scores } : s
    );
    setState((s) => ({ ...s, sessions: updated, scores }));
    await saveSessions(updated);
  }, [state.sessions, saveSessions]);

  const updateSessionDebrief = useCallback(async (id: string, debrief: Session["debrief"]) => {
    const updated = state.sessions.map((s) =>
      s.id === id ? { ...s, debrief } : s
    );
    setState((s) => ({ ...s, sessions: updated }));
    await saveSessions(updated);
  }, [state.sessions, saveSessions]);

  const loadSession = useCallback((session: Session) => {
    setState((s) => ({
      ...s,
      scenario: session.scenario,
      who: session.who,
      situation: session.situation,
      fullResponse: session.response,
      scores: session.scores ? { ...session.scores } : { ...defaultScores },
      currentSessionId: session.id,
    }));
  }, []);

  const resetCurrentSession = useCallback(() => {
    setState((s) => ({
      ...s,
      scenario: "",
      who: "",
      situation: "",
      outcome: "",
      tone: "",
      fullResponse: "",
      persona: { ...defaultPersona },
      rpMessages: [],
      rpSystemContext: "",
      scores: { ...defaultScores },
      currentSessionId: undefined,
    }));
  }, []);

  const ctx: AppContextType = {
    ...state,
    setScenario: (v) => setState((s) => ({ ...s, scenario: v })),
    setWho: (v) => setState((s) => ({ ...s, who: v })),
    setSituation: (v) => setState((s) => ({ ...s, situation: v })),
    setOutcome: (v) => setState((s) => ({ ...s, outcome: v })),
    setTone: (v) => setState((s) => ({ ...s, tone: v })),
    setFullResponse: (v) => setState((s) => ({ ...s, fullResponse: v })),
    setPersona: (p) => setState((s) => ({ ...s, persona: p })),
    setRpMessages: (msgs) => setState((s) => ({ ...s, rpMessages: msgs })),
    setRpSystemContext: (ctx) => setState((s) => ({ ...s, rpSystemContext: ctx })),
    setScores: (sc) => setState((s) => ({ ...s, scores: sc })),
    saveSession,
    updateSessionScores,
    updateSessionDebrief,
    loadSession,
    resetCurrentSession,
    getSessions: () => state.sessions,
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
