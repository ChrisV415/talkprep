import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

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
  sessionsLoaded: boolean;
  isPro: boolean;
  isProLoaded: boolean;
}

interface AppContextType extends AppState {
  refreshProStatus: () => void;
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
  saveSession: (response: string) => Promise<string>;
  updateSessionScores: (id: string, scores: Scores) => Promise<void>;
  updateSessionDebrief: (id: string, debrief: Session["debrief"]) => Promise<void>;
  loadSession: (session: Session) => void;
  resetCurrentSession: () => void;
  getSessions: () => Session[];
}

const AppContext = createContext<AppContextType | null>(null);

const SESSIONS_KEY = "tp_sessions";

function dbRowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    date: row.sessionDate as string,
    scenario: row.scenario as string,
    who: row.who as string,
    situation: (row.situation as string) ?? "",
    response: (row.response as string) ?? "",
    scores:
      row.scoresClarity != null
        ? {
            clarity: row.scoresClarity as number,
            composure: row.scoresComposure as number,
            outcome_score: row.scoresOutcome as number,
          }
        : undefined,
    debrief:
      row.debriefOutcome != null
        ? {
            outcome: row.debriefOutcome as string,
            happened: (row.debriefHappened as string) ?? "",
            different: (row.debriefDifferent as string) ?? "",
            text: (row.debriefText as string) ?? "",
          }
        : undefined,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth();

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
    sessionsLoaded: false,
    isPro: false,
    isProLoaded: false,
  });

  const authFetch = useCallback(
    async (path: string, method: string, body?: object) => {
      const token = await getToken();
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [getToken],
  );

  const refreshProStatus = useCallback(() => {
    if (!isSignedIn) return;
    authFetch("api/user/pro-status", "GET")
      .then((data: { isPro: boolean }) => {
        setState((s) => ({ ...s, isPro: !!data?.isPro, isProLoaded: true }));
      })
      .catch(() => {
        setState((s) => ({ ...s, isPro: false, isProLoaded: true }));
      });
  }, [isSignedIn, authFetch]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      refreshProStatus();
      authFetch("api/sessions", "GET")
        .then((rows: Record<string, unknown>[]) => {
          const sessions = rows.map(dbRowToSession);
          setState((s) => ({ ...s, sessions, sessionsLoaded: true }));
        })
        .catch(() => {
          AsyncStorage.getItem(SESSIONS_KEY).then((raw) => {
            if (raw) {
              try {
                setState((s) => ({
                  ...s,
                  sessions: JSON.parse(raw) as Session[],
                  sessionsLoaded: true,
                }));
              } catch {
                setState((s) => ({ ...s, sessionsLoaded: true }));
              }
            } else {
              setState((s) => ({ ...s, sessionsLoaded: true }));
            }
          });
        });
    } else {
      AsyncStorage.removeItem(SESSIONS_KEY);
      setState({
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
        sessions: [],
        sessionsLoaded: true,
        isPro: false,
        isProLoaded: true,
      });
    }
  }, [isLoaded, isSignedIn, refreshProStatus]);

  const saveSessions = useCallback(async (sessions: Session[]) => {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }, []);

  const saveSession = useCallback(async (response: string): Promise<string> => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const newSession: Session = {
      id,
      date: sessionDate,
      scenario: state.scenario,
      who: state.who,
      situation: state.situation.slice(0, 120) + (state.situation.length > 120 ? "..." : ""),
      response,
    };

    if (isSignedIn) {
      authFetch("api/sessions", "POST", {
        id,
        sessionDate,
        scenario: state.scenario,
        who: state.who,
        situation: newSession.situation,
        response,
      }).catch(() => {});
    }

    const updated = [newSession, ...state.sessions].slice(0, 50);
    setState((s) => ({ ...s, sessions: updated, currentSessionId: id }));
    await saveSessions(updated);
    return id;
  }, [state, isSignedIn, authFetch, saveSessions]);

  const updateSessionScores = useCallback(
    async (id: string, scores: Scores) => {
      if (isSignedIn) {
        authFetch(`api/sessions/${id}`, "PATCH", {
          scoresClarity: scores.clarity,
          scoresComposure: scores.composure,
          scoresOutcome: scores.outcome_score,
        }).catch(() => {});
      }
      const updated = state.sessions.map((s) =>
        s.id === id ? { ...s, scores } : s,
      );
      setState((s) => ({ ...s, sessions: updated, scores }));
      await saveSessions(updated);
    },
    [state.sessions, isSignedIn, authFetch, saveSessions],
  );

  const updateSessionDebrief = useCallback(
    async (id: string, debrief: Session["debrief"]) => {
      if (isSignedIn && debrief) {
        authFetch(`api/sessions/${id}`, "PATCH", {
          debriefOutcome: debrief.outcome,
          debriefHappened: debrief.happened,
          debriefDifferent: debrief.different,
          debriefText: debrief.text,
        }).catch(() => {});
      }
      const updated = state.sessions.map((s) =>
        s.id === id ? { ...s, debrief } : s,
      );
      setState((s) => ({ ...s, sessions: updated }));
      await saveSessions(updated);
    },
    [state.sessions, isSignedIn, authFetch, saveSessions],
  );

  const loadSession = useCallback((session: Session) => {
    setState((s) => ({
      ...s,
      scenario: session.scenario,
      who: session.who,
      situation: session.situation,
      outcome: "",
      tone: "",
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
    refreshProStatus,
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
